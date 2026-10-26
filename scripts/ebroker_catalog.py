#!/usr/bin/env python3
"""Pilot collector for the official eBroker partner XML catalog.

Operational tool (Python 3 stdlib only), not part of the Next.js runtime.
It downloads the catalog feed once, validates it, stores a normalized
snapshot and a comparison with the previous valid snapshot.

What the feed is NOT: the XML schema (oid, name, institution, logo,
description, url, category, subcategory) has no campaign dates, edit dates,
fees, tariffs or affiliate status. Those stay UNKNOWN here. Presence in the
catalog does not prove the bank's conditions, and disappearance does not
prove expiry -- MISSING_FROM_CATALOG is only a review signal. This module
never produces CampaignSnapshot objects and never opens url/logo links
found inside offers.

Usage: see docs/ebroker-catalog-pilot.md
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_URL = "https://bankmiplaci.ebrokerpartner.pl/xml-file"
SCHEMA_VERSION = 1
SOURCE_ID = "ebroker-xml-catalog"
DEFAULT_TIMEOUT_S = 20
# The feed was ~92 KB (113 offers) on 2026-10-03; 2 MiB leaves ample headroom.
MAX_BYTES = 2 * 1024 * 1024
READ_CHUNK = 64 * 1024
USER_AGENT = "bank-promo-comparator-catalog-pilot/1 (+manual review tool)"

FIELDS = ("oid", "name", "institution", "logo", "description", "url", "category", "subcategory")
COMPARED_FIELDS = FIELDS[1:] + ("extraFields",)
# Fields whose values are partner links / remote assets: never printed in full.
LINK_FIELDS = ("url", "logo")
UNKNOWN = "UNKNOWN"
UNKNOWN_TERMS = ("startDate", "endDate", "lastEditedAt", "fees", "affiliateStatus")
OID_RE = re.compile(r"^[0-9A-Za-z_-]{1,64}$")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]+")

REPO_ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_NAME = "latest-snapshot.json"
COMPARISON_NAME = "latest-comparison.json"
COMPARISONS_DIR = "comparisons"

EVENT_NEW = "NEW_IN_CATALOG"
EVENT_CHANGED = "CHANGED_IN_CATALOG"
EVENT_MISSING = "MISSING_FROM_CATALOG"

NOTES = (
    "Catalog has no dates, edits, fees or affiliate status; those remain UNKNOWN.",
    "Presence in the catalog does not prove the bank's current conditions.",
    "MISSING_FROM_CATALOG requires manual review; it is not an expiry.",
    "Changed links are review signals only; the collector never opens them.",
)


class CatalogError(Exception):
    """Invalid feed, unsafe input or unusable state. Nothing is written."""


# --------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------

def _utc_stamp(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _element_text(el: ET.Element) -> str | None:
    # itertext() covers CDATA and any nested markup; entities are already decoded.
    text = "".join(el.itertext()).strip()
    return text or None


def _oid_sort_key(oid: str) -> tuple:
    return (0, int(oid), "") if oid.isdigit() else (1, 0, oid)


def _parse_offer(el: ET.Element, position: int) -> dict:
    values: dict[str, str | None] = {}
    extra: set[str] = set()
    for child in el:
        tag = child.tag
        if tag in FIELDS:
            if tag in values:
                raise CatalogError(f"offer #{position}: repeated <{tag}>")
            values[tag] = _element_text(child)
        else:
            # Unknown elements (e.g. future date fields) are recorded by name only;
            # their values are not interpreted as campaign terms.
            extra.add(str(tag))

    attr_oid = (el.get("oid") or "").strip() or None
    child_oid = values.get("oid")
    if attr_oid and child_oid and attr_oid != child_oid:
        raise CatalogError(f"offer #{position}: oid attribute and <oid> element differ")
    oid = child_oid or attr_oid
    if not oid:
        raise CatalogError(f"offer #{position}: missing oid")
    if not OID_RE.match(oid):
        raise CatalogError(f"offer #{position}: invalid oid format")

    offer: dict = {"oid": oid}
    for field in FIELDS[1:]:
        offer[field] = values.get(field)
    offer["extraFields"] = sorted(extra)
    offer["campaignTerms"] = {term: UNKNOWN for term in UNKNOWN_TERMS}
    return offer


def parse_catalog(data: bytes, read_at: str | None = None, max_bytes: int = MAX_BYTES) -> dict:
    """Parse raw feed bytes into a normalized snapshot. Pure: no I/O.

    Raises CatalogError for anything that is not a complete, unambiguous catalog.
    """
    if not isinstance(data, (bytes, bytearray)):
        raise CatalogError("feed must be bytes")
    data = bytes(data)
    if not data:
        raise CatalogError("empty response")
    if len(data) > max_bytes:
        raise CatalogError(f"feed larger than {max_bytes} bytes")
    if b"\x00" in data:
        raise CatalogError("NUL bytes found (UTF-16/32 or binary data is not supported)")
    upper = data.upper()
    if b"<!DOCTYPE" in upper or b"<!ENTITY" in upper:
        raise CatalogError("DOCTYPE/ENTITY declarations are rejected")

    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise CatalogError(f"malformed XML: {exc}") from None

    if root.tag != "offers":
        raise CatalogError(f"unexpected root element <{str(root.tag)[:60]}>")

    offers: list[dict] = []
    seen: set[str] = set()
    for position, el in enumerate(root, start=1):
        if el.tag != "offer":
            raise CatalogError(f"unexpected element <{str(el.tag)[:60]}> at position {position}")
        offer = _parse_offer(el, position)
        if offer["oid"] in seen:
            raise CatalogError(f"duplicate oid {offer['oid']}")
        seen.add(offer["oid"])
        offers.append(offer)

    if not offers:
        raise CatalogError("catalog contains no offers")

    offers.sort(key=lambda o: _oid_sort_key(o["oid"]))
    return {
        "schemaVersion": SCHEMA_VERSION,
        "source": SOURCE_ID,
        "readAt": read_at or _utc_stamp(),
        "sha256": hashlib.sha256(data).hexdigest(),
        "byteSize": len(data),
        "offerCount": len(offers),
        "offers": offers,
    }


# --------------------------------------------------------------------------
# Comparison
# --------------------------------------------------------------------------

def _fingerprint(value: str | None) -> dict | None:
    if value is None:
        return None
    host = urllib.parse.urlsplit(value).hostname if "://" in value else None
    return {"host": host, "sha256_12": hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]}


def _describe_change(field: str, before, after) -> dict:
    if field in LINK_FIELDS:
        return {"before": _fingerprint(before), "after": _fingerprint(after)}
    if field == "description":
        return {
            "beforeLength": len(before or ""),
            "afterLength": len(after or ""),
            "before": _fingerprint(before),
            "after": _fingerprint(after),
        }
    if isinstance(before, str) or isinstance(after, str):
        return {"before": before[:200] if before else before, "after": after[:200] if after else after}
    return {"before": before, "after": after}


def _check_snapshot(snapshot: dict, label: str) -> None:
    if not isinstance(snapshot, dict) or snapshot.get("schemaVersion") != SCHEMA_VERSION:
        raise CatalogError(f"{label} snapshot has incompatible schemaVersion")
    if not isinstance(snapshot.get("offers"), list):
        raise CatalogError(f"{label} snapshot has no offers list")


def compare_catalogs(prev: dict | None, nxt: dict) -> dict:
    """Compare two snapshots by oid. Pure: no I/O.

    prev=None means first valid read: a baseline with no alarms.
    Missing offers are never marked EXPIRED; they only require review.
    """
    _check_snapshot(nxt, "current")
    next_by = {o["oid"]: o for o in nxt["offers"]}
    result: dict = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "ebroker-catalog-comparison",
        "source": SOURCE_ID,
        "readAt": nxt["readAt"],
        "sha256": nxt["sha256"],
        "previousReadAt": None,
        "previousSha256": None,
        "baseline": prev is None,
        "notes": list(NOTES),
    }
    if prev is None:
        result["counts"] = {
            "new": 0, "changed": 0, "missing": 0, "unchanged": 0,
            "previousTotal": 0, "currentTotal": len(next_by),
        }
        result["events"] = []
        return result

    _check_snapshot(prev, "previous")
    prev_by = {o["oid"]: o for o in prev["offers"]}
    result["previousReadAt"] = prev.get("readAt")
    result["previousSha256"] = prev.get("sha256")

    events: list[dict] = []
    counts = {"new": 0, "changed": 0, "missing": 0, "unchanged": 0}
    for oid in sorted(set(prev_by) | set(next_by), key=_oid_sort_key):
        before, after = prev_by.get(oid), next_by.get(oid)
        if before is None:
            counts["new"] += 1
            events.append({"type": EVENT_NEW, "oid": oid, "name": after.get("name"), "requiresReview": True})
        elif after is None:
            counts["missing"] += 1
            events.append({
                "type": EVENT_MISSING,
                "oid": oid,
                "name": before.get("name"),
                "requiresReview": True,
                "note": "Not in the current catalog; verify with the bank. Not an expiry.",
            })
        else:
            changed = [f for f in COMPARED_FIELDS if before.get(f) != after.get(f)]
            if not changed:
                counts["unchanged"] += 1
                continue
            counts["changed"] += 1
            event = {
                "type": EVENT_CHANGED,
                "oid": oid,
                "name": after.get("name"),
                "changedFields": changed,
                "requiresReview": True,
                "changes": {f: _describe_change(f, before.get(f), after.get(f)) for f in changed},
            }
            if "url" in changed:
                event["linkChanged"] = True
            events.append(event)

    counts["previousTotal"] = len(prev_by)
    counts["currentTotal"] = len(next_by)
    result["counts"] = counts
    result["events"] = events
    return result


# --------------------------------------------------------------------------
# Report (stdout): ids, names, changed field names, counts. No links, no XML.
# --------------------------------------------------------------------------

def _safe_name(name: str | None, limit: int = 80) -> str:
    text = CONTROL_RE.sub(" ", name or "").strip()
    if not text:
        return "(brak nazwy)"
    return text if len(text) <= limit else text[: limit - 1] + "…"


def format_report(comparison: dict, snapshot: dict) -> str:
    counts = comparison["counts"]
    lines = [
        f"eBroker XML: {snapshot['offerCount']} ofert, sha256 {snapshot['sha256'][:12]}, odczyt {snapshot['readAt']}"
    ]
    if comparison["baseline"]:
        lines.append("BASELINE: pierwszy poprawny odczyt zapisany jako punkt odniesienia; brak alarmów.")
    else:
        lines.append(
            f"Zmiany: nowe={counts['new']} zmienione={counts['changed']} brakujące={counts['missing']} "
            f"bez zmian={counts['unchanged']} (poprzednio {counts['previousTotal']}, teraz {counts['currentTotal']})"
        )
        for ev in comparison["events"]:
            line = f'{ev["type"]} oid={ev["oid"]} "{_safe_name(ev.get("name"))}"'
            if ev["type"] == EVENT_CHANGED:
                line += " pola: " + ", ".join(ev["changedFields"])
                if ev.get("linkChanged"):
                    line += " [link zmieniony: tylko przegląd ręczny, nie otwierać automatycznie]"
            elif ev["type"] == EVENT_MISSING:
                line += " [wymaga przeglądu; NIE oznacza wygaśnięcia]"
            lines.append(line)
        if not comparison["events"]:
            lines.append("Brak różnic w katalogu względem poprzedniej poprawnej kopii.")
    lines.append("UWAGA: daty, edycja, opłaty i status afiliacji = UNKNOWN (brak w schemacie XML).")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# I/O: network fetch, local file, state directory, atomic writes
# --------------------------------------------------------------------------

class _RefuseRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise CatalogError(f"redirect (HTTP {code}) refused; the feed must answer directly")


def fetch_feed(url: str = DEFAULT_URL, timeout: float = DEFAULT_TIMEOUT_S, max_bytes: int = MAX_BYTES) -> bytes:
    """Single GET of the feed. No cookies, no credentials, no redirects.

    Only the feed itself is fetched; url/logo values inside offers are never requested.
    """
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or not parts.hostname:
        raise CatalogError("only https:// feed URLs are allowed")
    if parts.username or parts.password:
        raise CatalogError("credentials in the feed URL are not allowed")

    opener = urllib.request.build_opener(_RefuseRedirect)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/xml, text/xml;q=0.9"},
        method="GET",
    )
    deadline = time.monotonic() + timeout
    try:
        with opener.open(request, timeout=timeout) as resp:
            status = getattr(resp, "status", None) or resp.getcode()
            if status != 200:
                raise CatalogError(f"unexpected HTTP status {status}")
            ctype = (resp.headers.get("Content-Type") or "").lower()
            if "xml" not in ctype:
                raise CatalogError(f"unexpected Content-Type {ctype[:60]!r}")
            declared = (resp.headers.get("Content-Length") or "").strip()
            if declared.isdigit() and int(declared) > max_bytes:
                raise CatalogError(f"declared size exceeds {max_bytes} bytes")
            chunks: list[bytes] = []
            total = 0
            while True:
                if time.monotonic() > deadline:
                    raise CatalogError(f"download exceeded {timeout}s")
                chunk = resp.read(READ_CHUNK)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise CatalogError(f"feed larger than {max_bytes} bytes")
                chunks.append(chunk)
    except CatalogError:
        raise
    except urllib.error.HTTPError as exc:
        raise CatalogError(f"HTTP error {exc.code}") from None
    except urllib.error.URLError as exc:
        raise CatalogError(f"network error: {str(exc.reason)[:120]}") from None
    except (OSError, ValueError) as exc:
        raise CatalogError(f"network error: {type(exc).__name__}") from None
    return b"".join(chunks)


def read_local_feed(path: str, max_bytes: int = MAX_BYTES) -> bytes:
    p = Path(path)
    try:
        if p.stat().st_size > max_bytes:
            raise CatalogError(f"file larger than {max_bytes} bytes")
        return p.read_bytes()
    except OSError as exc:
        raise CatalogError(f"cannot read input file: {type(exc).__name__}") from None


def _is_within(child: Path, parent: Path) -> bool:
    c = os.path.normcase(str(child))
    p = os.path.normcase(str(parent))
    try:
        return os.path.commonpath([c, p]) == p
    except ValueError:  # different drives on Windows
        return False


def resolve_state_dir(raw: str | None, repo_root: Path = REPO_ROOT) -> Path:
    """State must live outside the repository (data/new-promotions.json, prisma, build output)."""
    if not raw or not raw.strip():
        raise CatalogError("--state-dir is required")
    state = Path(raw).expanduser().resolve()
    if _is_within(state, repo_root.resolve()):
        raise CatalogError("--state-dir must be outside the repository (no data/, prisma/ or production paths)")
    if state.exists() and not state.is_dir():
        raise CatalogError("--state-dir exists and is not a directory")
    return state


def load_snapshot(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        snapshot = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise CatalogError(f"stored snapshot unreadable ({type(exc).__name__}); fix or move it manually") from None
    _check_snapshot(snapshot, "stored")
    return snapshot


def atomic_write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Single read of the eBroker XML catalog and comparison with the last valid snapshot.",
    )
    parser.add_argument("--state-dir", required=True,
                        help="explicit directory for snapshots, outside the repository")
    parser.add_argument("--url", default=DEFAULT_URL, help="feed URL (https only); default: official feed")
    parser.add_argument("--from-file", help="parse a local XML file instead of downloading")
    parser.add_argument("--dry-run", action="store_true", help="read and compare, write nothing")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_S, help="total download time limit (s)")
    parser.add_argument("--max-bytes", type=int, default=MAX_BYTES, help="maximum feed size")
    return parser


def run(argv=None, fetcher=None, now: datetime | None = None, stdout=None, stderr=None,
        repo_root: Path = REPO_ROOT) -> int:
    """Returns 0 on success, 2 when nothing was written because of an error."""
    stdout = stdout or sys.stdout
    stderr = stderr or sys.stderr
    args = build_parser().parse_args(argv)
    fetcher = fetcher or fetch_feed

    try:
        if args.timeout <= 0 or args.max_bytes <= 0:
            raise CatalogError("--timeout and --max-bytes must be positive")
        state_dir = resolve_state_dir(args.state_dir, repo_root)
        snapshot_path = state_dir / SNAPSHOT_NAME
        previous = load_snapshot(snapshot_path)
        if args.from_file:
            data = read_local_feed(args.from_file, args.max_bytes)
        else:
            data = fetcher(args.url, args.timeout, args.max_bytes)
        snapshot = parse_catalog(data, read_at=_utc_stamp(now), max_bytes=args.max_bytes)
        comparison = compare_catalogs(previous, snapshot)
    except CatalogError as exc:
        print(f"BŁĄD: {exc}. Ostatnia poprawna kopia nie została zmieniona.", file=stderr)
        return 2

    print(format_report(comparison, snapshot), file=stdout)
    if args.dry_run:
        print("DRY-RUN: nic nie zapisano.", file=stdout)
        return 0

    stamp = snapshot["readAt"].replace("-", "").replace(":", "")
    history_path = state_dir / COMPARISONS_DIR / f"{stamp}-{snapshot['sha256'][:8]}.json"
    # Comparison first, snapshot last: the baseline only advances after the
    # comparison that justifies it is safely on disk.
    atomic_write_json(history_path, comparison)
    atomic_write_json(state_dir / COMPARISON_NAME, comparison)
    atomic_write_json(snapshot_path, snapshot)
    print(f"Zapisano: {SNAPSHOT_NAME}, {COMPARISON_NAME}, {COMPARISONS_DIR}/{history_path.name}", file=stdout)
    return 0


if __name__ == "__main__":
    sys.exit(run())
