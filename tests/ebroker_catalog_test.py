"""Offline unit tests for scripts/ebroker_catalog.py (Python 3 stdlib only).

No network, no database: every feed is an inline fixture and every run()
call injects a fake fetcher. Run from the repository root:

    python tests/ebroker_catalog_test.py
"""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("ebroker_catalog", ROOT / "scripts" / "ebroker_catalog.py")
ec = importlib.util.module_from_spec(_spec)
sys.modules["ebroker_catalog"] = ec
_spec.loader.exec_module(ec)

SECRET_LINK = "https://partner.example/track?aff=SECRET123&oid=13870"
NEW_SECRET_LINK = "https://partner.example/track?aff=SECRET456&oid=13870"
T1 = datetime(2026, 10, 3, 8, 0, 0, tzinfo=timezone.utc)
T2 = datetime(2026, 10, 4, 8, 0, 0, tzinfo=timezone.utc)


def offer(oid, name="Konto", institution="Bank", url="https://partner.example/x", category="konta",
          description="Opis", subcategory="osobiste", logo="https://cdn.example/logo.png", extra=""):
    def el(tag, value):
        return f"<{tag}>{escape(value)}</{tag}>" if value is not None else ""
    return (
        "<offer>"
        + el("oid", oid) + el("name", name) + el("institution", institution) + el("logo", logo)
        + el("description", description) + el("url", url) + el("category", category)
        + el("subcategory", subcategory) + extra
        + "</offer>"
    )


def feed(*offers: str) -> bytes:
    return ('<?xml version="1.0" encoding="UTF-8"?><offers>' + "".join(offers) + "</offers>").encode("utf-8")


BASE_FEED = feed(
    offer("13870", name="mBank eKonto", institution="mBank", url=SECRET_LINK),
    offer("31", name="Konto A"),
    offer("200", name="Konto B"),
)


def fixed_fetcher(data: bytes):
    calls = []

    def fetch(url, timeout, max_bytes):
        calls.append(url)
        return data
    fetch.calls = calls
    return fetch


def failing_fetcher(url, timeout, max_bytes):
    raise ec.CatalogError("network error: simulated")


def run_cli(args, fetcher, now=T1):
    out, err = io.StringIO(), io.StringIO()
    code = ec.run(args, fetcher=fetcher, now=now, stdout=out, stderr=err)
    return code, out.getvalue(), err.getvalue()


class ParseCatalogTest(unittest.TestCase):
    def test_valid_feed_is_normalized_and_sorted(self):
        snap = ec.parse_catalog(BASE_FEED, read_at="2026-10-03T08:00:00Z")
        self.assertEqual(snap["schemaVersion"], ec.SCHEMA_VERSION)
        self.assertEqual(snap["readAt"], "2026-10-03T08:00:00Z")
        self.assertEqual(snap["offerCount"], 3)
        self.assertEqual([o["oid"] for o in snap["offers"]], ["31", "200", "13870"])
        mbank = snap["offers"][2]
        self.assertEqual(mbank["institution"], "mBank")
        self.assertEqual(mbank["url"], SECRET_LINK)
        self.assertEqual(set(ec.FIELDS) - set(mbank), set())

    def test_sha256_matches_raw_bytes(self):
        import hashlib
        snap = ec.parse_catalog(BASE_FEED)
        self.assertEqual(snap["sha256"], hashlib.sha256(BASE_FEED).hexdigest())
        self.assertEqual(snap["byteSize"], len(BASE_FEED))

    def test_terms_stay_unknown(self):
        snap = ec.parse_catalog(BASE_FEED)
        for o in snap["offers"]:
            self.assertEqual(set(o["campaignTerms"].values()), {"UNKNOWN"})
        self.assertNotIn("EXPIRED", json.dumps(snap))

    def test_text_entities_and_cdata(self):
        data = (
            b'<?xml version="1.0" encoding="UTF-8"?><offers><offer><oid>1</oid>'
            b"<name>Bank &amp; Co &#322;&#243;d&#378;</name>"
            b"<description><![CDATA[<p>Premia 300 z\xc5\x82 & wi\xc4\x99cej</p>]]></description>"
            b"</offer></offers>"
        )
        o = ec.parse_catalog(data)["offers"][0]
        self.assertEqual(o["name"], "Bank & Co łódź")
        self.assertEqual(o["description"], "<p>Premia 300 zł & więcej</p>")
        self.assertIsNone(o["url"])

    def test_oid_as_attribute(self):
        data = b"<offers><offer oid='7'><name>X</name></offer></offers>"
        self.assertEqual(ec.parse_catalog(data)["offers"][0]["oid"], "7")

    def test_conflicting_oid_attribute_rejected(self):
        data = b"<offers><offer oid='7'><oid>8</oid><name>X</name></offer></offers>"
        with self.assertRaises(ec.CatalogError):
            ec.parse_catalog(data)

    def test_extra_fields_recorded_by_name_only(self):
        data = feed(offer("5", extra="<validTo>2026-12-31</validTo>"))
        o = ec.parse_catalog(data)["offers"][0]
        self.assertEqual(o["extraFields"], ["validTo"])
        self.assertEqual(o["campaignTerms"]["endDate"], "UNKNOWN")
        self.assertNotIn("2026-12-31", json.dumps(o))

    def test_malformed_xml_rejected(self):
        with self.assertRaises(ec.CatalogError):
            ec.parse_catalog(b"<offers><offer><oid>1</oid><name>X</name></offer>")

    def test_doctype_and_entity_rejected(self):
        bomb = (
            b'<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">'
            b'<!ENTITY lol2 "&lol;&lol;&lol;">]>'
            b"<offers><offer><oid>1</oid><name>&lol2;</name></offer></offers>"
        )
        with self.assertRaisesRegex(ec.CatalogError, "DOCTYPE"):
            ec.parse_catalog(bomb)
        with self.assertRaises(ec.CatalogError):
            ec.parse_catalog(b'<!doctype offers SYSTEM "file:///etc/passwd"><offers/>')

    def test_wrong_root_rejected(self):
        with self.assertRaisesRegex(ec.CatalogError, "root"):
            ec.parse_catalog(b"<catalog><offer><oid>1</oid><name>X</name></offer></catalog>")
        with self.assertRaises(ec.CatalogError):
            ec.parse_catalog(b'<offers xmlns="urn:x"><offer><oid>1</oid><name>X</name></offer></offers>')

    def test_unexpected_child_rejected(self):
        with self.assertRaises(ec.CatalogError):
            ec.parse_catalog(feed(offer("1"), "<promo/>"))

    def test_duplicate_oid_rejected(self):
        with self.assertRaisesRegex(ec.CatalogError, "duplicate"):
            ec.parse_catalog(feed(offer("1"), offer("2"), offer("1", name="Inna")))

    def test_missing_empty_or_invalid_oid_rejected(self):
        for bad in (offer(None), offer("   "), offer("13 870"), offer("../x")):
            with self.subTest(bad=bad), self.assertRaises(ec.CatalogError):
                ec.parse_catalog(feed(offer("1"), bad))

    def test_missing_or_empty_name_is_preserved_as_unknown(self):
        snap = ec.parse_catalog(feed(offer("1", name=None), offer("2", name="")))
        self.assertEqual([o["name"] for o in snap["offers"]], [None, None])
        self.assertEqual(ec._safe_name(None), "(brak nazwy)")

    def test_empty_catalog_rejected(self):
        for data in (b"", b"<offers/>", b"<offers>  </offers>"):
            with self.subTest(data=data), self.assertRaises(ec.CatalogError):
                ec.parse_catalog(data)

    def test_oversize_rejected(self):
        with self.assertRaisesRegex(ec.CatalogError, "larger"):
            ec.parse_catalog(BASE_FEED, max_bytes=100)

    def test_utf16_rejected(self):
        with self.assertRaises(ec.CatalogError):
            ec.parse_catalog(BASE_FEED.decode("utf-8").replace("UTF-8", "UTF-16").encode("utf-16"))


class CompareCatalogsTest(unittest.TestCase):
    def setUp(self):
        self.base = ec.parse_catalog(BASE_FEED, read_at="2026-10-03T08:00:00Z")

    def test_first_read_is_baseline_without_alarms(self):
        cmp = ec.compare_catalogs(None, self.base)
        self.assertTrue(cmp["baseline"])
        self.assertEqual(cmp["events"], [])
        self.assertEqual(cmp["counts"]["new"], 0)
        self.assertEqual(cmp["counts"]["currentTotal"], 3)

    def test_reorder_is_not_a_change(self):
        reordered = feed(
            offer("200", name="Konto B"),
            offer("31", name="Konto A"),
            offer("13870", name="mBank eKonto", institution="mBank", url=SECRET_LINK),
        )
        nxt = ec.parse_catalog(reordered)
        self.assertNotEqual(nxt["sha256"], self.base["sha256"])
        cmp = ec.compare_catalogs(self.base, nxt)
        self.assertFalse(cmp["baseline"])
        self.assertEqual(cmp["events"], [])
        self.assertEqual(cmp["counts"]["unchanged"], 3)

    def test_new_changed_missing_are_distinguished_and_sorted(self):
        nxt = ec.parse_catalog(feed(
            offer("13870", name="mBank eKonto", institution="mBank", url=SECRET_LINK),
            offer("200", name="Konto B+", category="oszczednosci"),
            offer("9", name="Nowe konto"),
        ))
        cmp = ec.compare_catalogs(self.base, nxt)
        self.assertEqual(
            [(e["type"], e["oid"]) for e in cmp["events"]],
            [("NEW_IN_CATALOG", "9"), ("MISSING_FROM_CATALOG", "31"), ("CHANGED_IN_CATALOG", "200")],
        )
        changed = cmp["events"][2]
        self.assertEqual(changed["changedFields"], ["name", "category"])
        self.assertNotIn("linkChanged", changed)
        c = cmp["counts"]
        self.assertEqual((c["new"], c["changed"], c["missing"], c["unchanged"]), (1, 1, 1, 1))

    def test_missing_offer_is_never_expired(self):
        nxt = ec.parse_catalog(feed(offer("31", name="Konto A"), offer("200", name="Konto B")))
        cmp = ec.compare_catalogs(self.base, nxt)
        missing = [e for e in cmp["events"] if e["oid"] == "13870"]
        self.assertEqual(len(missing), 1)
        self.assertEqual(missing[0]["type"], "MISSING_FROM_CATALOG")
        self.assertTrue(missing[0]["requiresReview"])
        self.assertNotIn("status", missing[0])
        self.assertNotIn("EXPIRED", json.dumps(cmp))

    def test_link_change_is_review_signal_without_full_link(self):
        nxt = ec.parse_catalog(feed(
            offer("13870", name="mBank eKonto", institution="mBank", url=NEW_SECRET_LINK),
            offer("31", name="Konto A"),
            offer("200", name="Konto B"),
        ))
        cmp = ec.compare_catalogs(self.base, nxt)
        self.assertEqual(len(cmp["events"]), 1)
        ev = cmp["events"][0]
        self.assertEqual(ev["changedFields"], ["url"])
        self.assertTrue(ev["linkChanged"])
        self.assertEqual(ev["changes"]["url"]["after"]["host"], "partner.example")
        dumped = json.dumps(cmp)
        self.assertNotIn("SECRET", dumped)
        report = ec.format_report(cmp, nxt)
        self.assertNotIn("SECRET", report)
        self.assertNotIn("https://", report)
        self.assertIn("oid=13870", report)

    def test_incompatible_baseline_rejected(self):
        old = dict(self.base, schemaVersion=999)
        with self.assertRaises(ec.CatalogError):
            ec.compare_catalogs(old, self.base)


class RunCliTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.state = Path(self._tmp.name) / "state"

    def tearDown(self):
        self._tmp.cleanup()

    def snapshot_path(self):
        return self.state / ec.SNAPSHOT_NAME

    def test_first_run_writes_baseline_atomically(self):
        fetch = fixed_fetcher(BASE_FEED)
        code, out, err = run_cli(["--state-dir", str(self.state)], fetch)
        self.assertEqual(code, 0, err)
        self.assertEqual(fetch.calls, [ec.DEFAULT_URL])
        self.assertIn("BASELINE", out)
        self.assertNotIn("NEW_IN_CATALOG", out)
        self.assertNotIn("SECRET", out)
        snap = json.loads(self.snapshot_path().read_text(encoding="utf-8"))
        self.assertEqual(snap["offerCount"], 3)
        self.assertNotIn("<offers", self.snapshot_path().read_text(encoding="utf-8"))
        self.assertTrue((self.state / ec.COMPARISON_NAME).exists())
        self.assertEqual(len(list((self.state / ec.COMPARISONS_DIR).glob("*.json"))), 1)
        self.assertEqual(list(self.state.rglob("*.tmp")), [])

    def test_error_does_not_overwrite_baseline(self):
        self.assertEqual(run_cli(["--state-dir", str(self.state)], fixed_fetcher(BASE_FEED))[0], 0)
        before = self.snapshot_path().read_bytes()
        bad_inputs = [
            fixed_fetcher(b"<offers><offer>"),
            fixed_fetcher(b"<offers/>"),
            fixed_fetcher(feed(offer("1"), offer("1"))),
            fixed_fetcher(b'<!DOCTYPE x [<!ENTITY a "b">]><offers/>'),
            failing_fetcher,
        ]
        for fetch in bad_inputs:
            with self.subTest(fetch=fetch):
                code, out, err = run_cli(["--state-dir", str(self.state)], fetch, now=T2)
                self.assertEqual(code, 2)
                self.assertIn("nie została zmieniona", err)
                self.assertEqual(self.snapshot_path().read_bytes(), before)
                self.assertEqual(len(list((self.state / ec.COMPARISONS_DIR).glob("*.json"))), 1)

    def test_second_run_reports_changes_and_advances_baseline(self):
        run_cli(["--state-dir", str(self.state)], fixed_fetcher(BASE_FEED))
        changed = feed(
            offer("13870", name="mBank eKonto", institution="mBank", url=NEW_SECRET_LINK),
            offer("200", name="Konto B"),
        )
        code, out, err = run_cli(["--state-dir", str(self.state)], fixed_fetcher(changed), now=T2)
        self.assertEqual(code, 0, err)
        self.assertIn("CHANGED_IN_CATALOG oid=13870", out)
        self.assertIn("MISSING_FROM_CATALOG oid=31", out)
        self.assertIn("NIE oznacza wygaśnięcia", out)
        self.assertNotIn("SECRET", out)
        snap = json.loads(self.snapshot_path().read_text(encoding="utf-8"))
        self.assertEqual(snap["offerCount"], 2)
        latest = json.loads((self.state / ec.COMPARISON_NAME).read_text(encoding="utf-8"))
        self.assertEqual(latest["counts"]["missing"], 1)
        self.assertEqual(len(list((self.state / ec.COMPARISONS_DIR).glob("*.json"))), 2)

    def test_dry_run_writes_nothing(self):
        code, out, _ = run_cli(["--state-dir", str(self.state), "--dry-run"], fixed_fetcher(BASE_FEED))
        self.assertEqual(code, 0)
        self.assertIn("DRY-RUN", out)
        self.assertFalse(self.state.exists())

        run_cli(["--state-dir", str(self.state)], fixed_fetcher(BASE_FEED))
        before = {p: p.read_bytes() for p in self.state.rglob("*") if p.is_file()}
        changed = feed(offer("1", name="Nowa"))
        code, out, _ = run_cli(["--state-dir", str(self.state), "--dry-run"], fixed_fetcher(changed), now=T2)
        self.assertEqual(code, 0)
        self.assertIn("NEW_IN_CATALOG oid=1", out)
        after = {p: p.read_bytes() for p in self.state.rglob("*") if p.is_file()}
        self.assertEqual(before, after)

    def test_from_file_does_not_call_fetcher(self):
        src = Path(self._tmp.name) / "feed.xml"
        src.write_bytes(BASE_FEED)
        fetch = fixed_fetcher(b"")
        code, out, err = run_cli(["--state-dir", str(self.state), "--from-file", str(src)], fetch)
        self.assertEqual(code, 0, err)
        self.assertEqual(fetch.calls, [])

    def test_corrupted_baseline_is_not_replaced(self):
        self.state.mkdir(parents=True)
        self.snapshot_path().write_text("{not json", encoding="utf-8")
        code, _, err = run_cli(["--state-dir", str(self.state)], fixed_fetcher(BASE_FEED))
        self.assertEqual(code, 2)
        self.assertEqual(self.snapshot_path().read_text(encoding="utf-8"), "{not json")

    def test_state_dir_inside_repository_rejected(self):
        target = ROOT / "data" / "ebroker-state-test"
        fetch = fixed_fetcher(BASE_FEED)
        code, _, err = run_cli(["--state-dir", str(target)], fetch)
        self.assertEqual(code, 2)
        self.assertIn("outside the repository", err)
        self.assertEqual(fetch.calls, [])
        self.assertFalse(target.exists())

    def test_state_dir_is_required(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            ec.run([], fetcher=fixed_fetcher(BASE_FEED))


class FetchGuardTest(unittest.TestCase):
    """Only checks that run before any network access."""

    def test_non_https_and_credentials_rejected(self):
        for url in ("http://bankmiplaci.ebrokerpartner.pl/xml-file",
                    "file:///etc/passwd",
                    "https://user:pass@bankmiplaci.ebrokerpartner.pl/xml-file"):
            with self.subTest(url=url), self.assertRaises(ec.CatalogError):
                ec.fetch_feed(url)

    def test_default_url_is_official_feed(self):
        self.assertEqual(ec.DEFAULT_URL, "https://bankmiplaci.ebrokerpartner.pl/xml-file")


if __name__ == "__main__":
    unittest.main()
