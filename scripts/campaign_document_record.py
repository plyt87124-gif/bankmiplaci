"""Structural validator for campaign document records (regulations / tariffs).

IMPORTANT - what this module does NOT do:

* It does not verify that a regulation or tariff is true, current, binding or
  legally correct. An empty error list means only that the record's STRUCTURE
  is consistent. There is no automated legal verification here.
* It never assigns ``reviewed`` nor any VERIFIED state by itself. Only an
  explicit ``reviewed=True`` together with a non-empty ``verifiedBy`` and
  ``verifiedAt`` identifies a recorded human/review confirmation, and even
  that is only a declaration stored for later audit.
* An ``extension`` block is a record of a declared piece of evidence for a
  later check. It does not confirm that a signup period was extended.
* ``signupEnd`` is the end of signups only. Nothing here infers the end of an
  affiliate programme from it.
* ``null`` (None) amounts and dates mean UNKNOWN. They never mean "free"
  (0 is a distinct, known value).

Pure stdlib, no IO, no network, no environment access, no database. The input
is never mutated. Error messages are deterministic and never echo secrets or
full URLs.
"""

from __future__ import annotations

import ipaddress
import re
from datetime import date, datetime
from typing import Any
from urllib.parse import urlsplit

KINDS = ("REGULATIONS", "TARIFF")
CURRENCY = "PLN"
AMOUNT_FIELDS = ("maxBonusCents", "accountFeeCents", "cardFeeCents")
EXTENSION_FIELDS = ("oldSignupEnd", "newSignupEnd", "campaignId", "editionId", "documentId")

_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
_HASH_RE = re.compile(r"[0-9a-fA-F]{64}")
_DATETIME_RE = re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}")


def _type_name(value: Any) -> str:
    return "null" if value is None else type(value).__name__


def _is_nonempty_text(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


def _parse_date(value: Any) -> date | None:
    if not isinstance(value, str) or not _DATE_RE.fullmatch(value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _parse_aware_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not _DATETIME_RE.match(value):
        return None
    text = value[:-1] + "+00:00" if value.endswith(("Z", "z")) else value
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed


def _check_text_id(record: dict, field: str, errors: list) -> None:
    if field not in record:
        errors.append(f"{field}: missing")
    elif not _is_nonempty_text(record[field]):
        errors.append(f"{field}: must be a non-empty string (got {_type_name(record[field])})")


def _check_source_url(record: dict, errors: list) -> None:
    if "sourceUrl" not in record:
        errors.append("sourceUrl: missing")
        return
    value = record["sourceUrl"]
    if not _is_nonempty_text(value):
        errors.append(f"sourceUrl: must be a non-empty string (got {_type_name(value)})")
        return
    if any(ord(c) < 32 or ord(c) == 127 for c in value):
        errors.append("sourceUrl: must not contain control characters")
        return
    if value != value.strip() or any(c.isspace() for c in value):
        errors.append("sourceUrl: must not contain whitespace")
        return
    try:
        parts = urlsplit(value)
        hostname = parts.hostname
        username = parts.username
        password = parts.password
        _ = parts.port
    except ValueError:
        errors.append("sourceUrl: malformed URL")
        return
    if parts.scheme.lower() != "https":
        errors.append("sourceUrl: scheme must be https")
    if username is not None or password is not None or "@" in parts.netloc:
        errors.append("sourceUrl: must not contain login or password")
    if not hostname:
        errors.append("sourceUrl: missing host")
        return
    if hostname == "localhost" or hostname.endswith(".localhost") or "." not in hostname:
        errors.append("sourceUrl: host must be public")
        return
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return
    if not ip.is_global:
        errors.append("sourceUrl: host must be public")


def _check_nullable_date(record: dict, field: str, errors: list, label: str | None = None) -> None:
    name = label or field
    if field not in record:
        errors.append(f"{name}: missing")
        return
    value = record[field]
    if value is None:
        return
    if not isinstance(value, str):
        errors.append(f"{name}: must be YYYY-MM-DD or null (got {_type_name(value)})")
    elif _parse_date(value) is None:
        errors.append(f"{name}: must be an existing calendar date in YYYY-MM-DD format")


def _check_amount(record: dict, field: str, errors: list) -> None:
    if field not in record:
        errors.append(f"{field}: missing")
        return
    value = record[field]
    if value is None:
        return
    if isinstance(value, bool) or not isinstance(value, int):
        errors.append(f"{field}: must be an integer >= 0 or null (got {_type_name(value)})")
    elif value < 0:
        errors.append(f"{field}: must be >= 0")


def _review_state(record: dict, errors: list) -> bool:
    """Validate review fields; return True only for an explicit complete review record."""
    reviewed = record.get("reviewed", False)
    if not isinstance(reviewed, bool):
        errors.append(f"reviewed: must be a boolean (got {_type_name(reviewed)})")
        reviewed = False

    by_ok = at_ok = False
    if "verifiedBy" not in record:
        errors.append("verifiedBy: missing (use null when not reviewed)")
    else:
        by = record["verifiedBy"]
        if by is not None and not _is_nonempty_text(by):
            errors.append(f"verifiedBy: must be a non-empty string or null (got {_type_name(by)})")
        by_ok = _is_nonempty_text(by)
    if "verifiedAt" not in record:
        errors.append("verifiedAt: missing (use null when not reviewed)")
    else:
        at = record["verifiedAt"]
        if at is not None and _parse_aware_datetime(at) is None:
            errors.append("verifiedAt: must be an ISO-8601 datetime with explicit timezone or null")
        at_ok = _parse_aware_datetime(at) is not None

    if reviewed and not (by_ok and at_ok):
        errors.append("reviewed: true requires non-empty verifiedBy and verifiedAt")
    if not reviewed and (by_ok or at_ok):
        errors.append("verifiedBy/verifiedAt: set without explicit reviewed=true")
    return reviewed is True and by_ok and at_ok


def _check_extension(record: dict, has_review: bool, errors: list) -> None:
    ext = record.get("extension")
    if ext is None:
        return
    if not isinstance(ext, dict):
        errors.append(f"extension: must be an object or absent (got {_type_name(ext)})")
        return
    if any(key not in EXTENSION_FIELDS for key in ext):
        errors.append("extension: unexpected field")
    for field in ("campaignId", "editionId", "documentId"):
        if field not in ext:
            errors.append(f"extension.{field}: missing")
        elif not _is_nonempty_text(ext[field]):
            errors.append(f"extension.{field}: must be a non-empty string")
        elif ext[field] != record.get(field):
            errors.append(f"extension.{field}: does not exactly match record {field}")
    old = new = None
    for field in ("oldSignupEnd", "newSignupEnd"):
        if field not in ext:
            errors.append(f"extension.{field}: missing")
            continue
        parsed = _parse_date(ext[field])
        if parsed is None:
            errors.append(f"extension.{field}: must be an existing calendar date in YYYY-MM-DD format")
        elif field == "oldSignupEnd":
            old = parsed
        else:
            new = parsed
    if old is not None and new is not None and not new > old:
        errors.append("extension: newSignupEnd must be later than oldSignupEnd")
    signup_end = record.get("signupEnd")
    if signup_end is None:
        errors.append("extension: requires record signupEnd (not null)")
    elif new is not None and ext.get("newSignupEnd") != signup_end:
        errors.append("extension: newSignupEnd must equal record signupEnd")
    if record.get("kind") != "REGULATIONS":
        errors.append("extension: only a REGULATIONS document may declare an extension")
    if not has_review:
        errors.append("extension: requires reviewed=true with verifiedBy and verifiedAt")


def validate_document_record(record: Any) -> list:
    """Return a deterministic list of STRUCTURAL errors for a document record.

    An empty list means only that the record is structurally consistent. It
    does NOT prove that the regulation/tariff is true, valid or current, does
    NOT mark the record as reviewed or VERIFIED, and does NOT confirm any
    signup extension. ``reviewed=True`` with non-empty ``verifiedBy`` and
    ``verifiedAt`` is merely the explicit record of a human/review
    confirmation supplied by the caller. ``None`` means unknown, never free.
    The input is not mutated; no IO, network or environment access occurs.
    """
    if not isinstance(record, dict):
        return [f"record: must be an object (got {_type_name(record)})"]

    errors: list = []
    for field in ("campaignId", "editionId", "documentId"):
        _check_text_id(record, field, errors)

    if "kind" not in record:
        errors.append("kind: missing")
    elif record["kind"] not in KINDS:
        errors.append("kind: must be REGULATIONS or TARIFF")

    _check_source_url(record, errors)

    if "contentHash" not in record:
        errors.append("contentHash: missing")
    elif not isinstance(record["contentHash"], str) or not _HASH_RE.fullmatch(record["contentHash"]):
        errors.append("contentHash: must be 64 hexadecimal characters")

    if "retrievedAt" not in record:
        errors.append("retrievedAt: missing")
    elif _parse_aware_datetime(record["retrievedAt"]) is None:
        errors.append("retrievedAt: must be an ISO-8601 datetime with explicit timezone")

    has_review = _review_state(record, errors)

    _check_nullable_date(record, "signupEnd", errors)
    for field in AMOUNT_FIELDS:
        _check_amount(record, field, errors)

    if "currency" not in record:
        errors.append("currency: missing")
    elif record["currency"] != CURRENCY:
        errors.append("currency: must be PLN")

    _check_extension(record, has_review, errors)
    return errors
