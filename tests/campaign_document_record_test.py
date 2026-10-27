"""Unit tests for scripts/campaign_document_record.py (structural validation only)."""

from __future__ import annotations

import copy
import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location(
    "campaign_document_record", ROOT / "scripts" / "campaign_document_record.py"
)
cdr = importlib.util.module_from_spec(_spec)
sys.modules["campaign_document_record"] = cdr
_spec.loader.exec_module(cdr)

validate = cdr.validate_document_record

HASH = "a" * 64


def minimal_record(**overrides):
    record = {
        "campaignId": "camp-1",
        "editionId": "camp-1-2026-10",
        "documentId": "doc-1",
        "kind": "REGULATIONS",
        "sourceUrl": "https://bank.example.pl/promocja/regulamin.pdf",
        "contentHash": HASH,
        "retrievedAt": "2026-10-04T10:00:00+02:00",
        "verifiedBy": None,
        "verifiedAt": None,
        "signupEnd": None,
        "maxBonusCents": None,
        "accountFeeCents": None,
        "cardFeeCents": None,
        "currency": "PLN",
    }
    record.update(overrides)
    return record


def reviewed_record(**overrides):
    base = {
        "reviewed": True,
        "verifiedBy": "reviewer-1",
        "verifiedAt": "2026-10-04T12:00:00Z",
        "signupEnd": "2026-11-30",
    }
    base.update(overrides)
    return minimal_record(**base)


def extension(**overrides):
    ext = {
        "oldSignupEnd": "2026-10-31",
        "newSignupEnd": "2026-11-30",
        "campaignId": "camp-1",
        "editionId": "camp-1-2026-10",
        "documentId": "doc-1",
    }
    ext.update(overrides)
    return ext


def has_error(errors, prefix):
    return any(e.startswith(prefix) for e in errors)


class MinimalRecordTests(unittest.TestCase):
    def test_minimal_complete_record_is_structurally_valid(self):
        self.assertEqual(validate(minimal_record()), [])

    def test_tariff_kind_is_valid(self):
        self.assertEqual(validate(minimal_record(kind="TARIFF")), [])

    def test_non_dict_input(self):
        self.assertEqual(validate(None), ["record: must be an object (got null)"])
        self.assertEqual(validate([]), ["record: must be an object (got list)"])

    def test_missing_required_fields_reported(self):
        errors = validate({})
        for field in ("campaignId", "editionId", "documentId", "kind", "sourceUrl",
                      "contentHash", "retrievedAt", "verifiedBy", "verifiedAt",
                      "signupEnd", "maxBonusCents", "accountFeeCents", "cardFeeCents",
                      "currency"):
            self.assertTrue(has_error(errors, f"{field}: missing"), field)

    def test_unknown_kind_and_currency(self):
        errors = validate(minimal_record(kind="FAQ", currency="EUR"))
        self.assertIn("kind: must be REGULATIONS or TARIFF", errors)
        self.assertIn("currency: must be PLN", errors)

    def test_deterministic_output(self):
        bad = minimal_record(kind="X", contentHash="z", maxBonusCents=-1)
        self.assertEqual(validate(bad), validate(copy.deepcopy(bad)))


class IdentityTests(unittest.TestCase):
    def test_empty_ids_rejected(self):
        errors = validate(minimal_record(campaignId="", editionId="  ", documentId=None))
        self.assertTrue(has_error(errors, "campaignId: must be a non-empty string"))
        self.assertTrue(has_error(errors, "editionId: must be a non-empty string"))
        self.assertTrue(has_error(errors, "documentId: must be a non-empty string"))

    def test_coincidentally_equal_ids_are_accepted(self):
        for record in (minimal_record(editionId="camp-1"),
                       minimal_record(editionId="doc-1"),
                       minimal_record(campaignId="x", editionId="x", documentId="x")):
            self.assertEqual(validate(record), [])

    def test_coincidentally_equal_ids_accepted_with_matching_extension(self):
        record = reviewed_record(editionId="camp-1",
                                 extension=extension(editionId="camp-1"))
        self.assertEqual(validate(record), [])


class AmountTests(unittest.TestCase):
    def test_null_amounts_mean_unknown_and_are_accepted(self):
        self.assertEqual(validate(minimal_record()), [])

    def test_zero_is_distinct_known_value(self):
        record = minimal_record(maxBonusCents=0, accountFeeCents=0, cardFeeCents=0)
        self.assertEqual(validate(record), [])
        self.assertIsNot(record["accountFeeCents"], None)

    def test_bool_amounts_rejected(self):
        errors = validate(minimal_record(maxBonusCents=True, cardFeeCents=False))
        self.assertIn("maxBonusCents: must be an integer >= 0 or null (got bool)", errors)
        self.assertIn("cardFeeCents: must be an integer >= 0 or null (got bool)", errors)

    def test_negative_amount_rejected(self):
        self.assertIn("accountFeeCents: must be >= 0", validate(minimal_record(accountFeeCents=-1)))

    def test_text_and_float_amounts_rejected(self):
        errors = validate(minimal_record(maxBonusCents="30000", accountFeeCents=1.5))
        self.assertIn("maxBonusCents: must be an integer >= 0 or null (got str)", errors)
        self.assertIn("accountFeeCents: must be an integer >= 0 or null (got float)", errors)


class DateTests(unittest.TestCase):
    def test_valid_signup_end(self):
        self.assertEqual(validate(minimal_record(signupEnd="2028-02-29")), [])

    def test_nonexistent_day_rejected(self):
        for bad in ("2026-02-30", "2027-02-29", "2026-13-01", "2026-1-01", "31.10.2026"):
            errors = validate(minimal_record(signupEnd=bad))
            self.assertTrue(has_error(errors, "signupEnd: must be an existing calendar date"), bad)

    def test_retrieved_at_without_timezone_rejected(self):
        errors = validate(minimal_record(retrievedAt="2026-10-04T10:00:00"))
        self.assertIn("retrievedAt: must be an ISO-8601 datetime with explicit timezone", errors)

    def test_retrieved_at_date_only_rejected(self):
        self.assertTrue(has_error(validate(minimal_record(retrievedAt="2026-10-04")), "retrievedAt:"))

    def test_retrieved_at_utc_z_accepted(self):
        self.assertEqual(validate(minimal_record(retrievedAt="2026-10-04T08:00:00Z")), [])


class UrlAndHashTests(unittest.TestCase):
    def test_url_with_credentials_rejected_without_leaking(self):
        url = "https://user:s3cretPass@bank.example.pl/regulamin.pdf"
        errors = validate(minimal_record(sourceUrl=url))
        self.assertIn("sourceUrl: must not contain login or password", errors)
        joined = " ".join(errors)
        self.assertNotIn("s3cretPass", joined)
        self.assertNotIn("bank.example.pl", joined)

    def test_http_scheme_rejected(self):
        errors = validate(minimal_record(sourceUrl="http://bank.example.pl/r.pdf"))
        self.assertIn("sourceUrl: scheme must be https", errors)

    def test_non_public_hosts_rejected(self):
        for url in ("https://localhost/r.pdf", "https://192.168.1.10/r.pdf", "https://intranet/r.pdf"):
            self.assertIn("sourceUrl: host must be public", validate(minimal_record(sourceUrl=url)), url)

    def test_bad_hash_rejected(self):
        for bad in ("a" * 63, "g" * 64, "a" * 65, None, 123):
            errors = validate(minimal_record(contentHash=bad))
            self.assertIn("contentHash: must be 64 hexadecimal characters", errors)


class ReviewTests(unittest.TestCase):
    def test_reviewed_record_valid(self):
        self.assertEqual(validate(reviewed_record()), [])

    def test_reviewed_true_without_review_data_rejected(self):
        errors = validate(minimal_record(reviewed=True))
        self.assertIn("reviewed: true requires non-empty verifiedBy and verifiedAt", errors)

    def test_verified_fields_without_reviewed_rejected(self):
        errors = validate(minimal_record(verifiedBy="reviewer-1", verifiedAt="2026-10-04T12:00:00Z"))
        self.assertIn("verifiedBy/verifiedAt: set without explicit reviewed=true", errors)

    def test_reviewed_must_be_bool(self):
        errors = validate(reviewed_record(reviewed="true"))
        self.assertTrue(has_error(errors, "reviewed: must be a boolean"))

    def test_verified_at_without_timezone_rejected(self):
        errors = validate(reviewed_record(verifiedAt="2026-10-04T12:00:00"))
        self.assertTrue(has_error(errors, "verifiedAt: must be an ISO-8601 datetime"))


class ExtensionTests(unittest.TestCase):
    def test_valid_extension_structure(self):
        self.assertEqual(validate(reviewed_record(extension=extension())), [])

    def test_identity_must_match_exactly(self):
        for field, value in (("campaignId", "camp-2"), ("editionId", "camp-1-2026-11"),
                             ("documentId", "DOC-1")):
            errors = validate(reviewed_record(extension=extension(**{field: value})))
            self.assertIn(f"extension.{field}: does not exactly match record {field}", errors)

    def test_tariff_cannot_extend(self):
        errors = validate(reviewed_record(kind="TARIFF", extension=extension()))
        self.assertIn("extension: only a REGULATIONS document may declare an extension", errors)

    def test_identity_mismatch_rejected_even_when_ids_coincide(self):
        record = reviewed_record(editionId="camp-1", extension=extension())
        errors = validate(record)
        self.assertIn("extension.editionId: does not exactly match record editionId", errors)

    def test_later_date_without_review_data_rejected(self):
        errors = validate(minimal_record(signupEnd="2026-11-30", extension=extension()))
        self.assertIn("extension: requires reviewed=true with verifiedBy and verifiedAt", errors)

    def test_new_date_must_be_later(self):
        for new in ("2026-10-31", "2026-10-30"):
            errors = validate(reviewed_record(signupEnd=new, extension=extension(newSignupEnd=new)))
            self.assertIn("extension: newSignupEnd must be later than oldSignupEnd", errors)

    def test_new_date_must_equal_signup_end(self):
        for signup_end in ("2026-10-31", "2026-12-01"):
            errors = validate(reviewed_record(signupEnd=signup_end, extension=extension()))
            self.assertIn("extension: newSignupEnd must equal record signupEnd", errors)

    def test_null_signup_end_with_extension_rejected(self):
        errors = validate(reviewed_record(signupEnd=None, extension=extension()))
        self.assertIn("extension: requires record signupEnd (not null)", errors)

    def test_matching_signup_end_accepted_without_auto_review(self):
        record = reviewed_record(signupEnd="2026-11-30", extension=extension())
        snapshot = copy.deepcopy(record)
        self.assertEqual(validate(record), [])
        self.assertEqual(record, snapshot)
        self.assertNotIn("status", record)

    def test_unreviewed_matching_extension_is_not_auto_reviewed(self):
        record = minimal_record(signupEnd="2026-11-30", extension=extension())
        errors = validate(record)
        self.assertIn("extension: requires reviewed=true with verifiedBy and verifiedAt", errors)
        self.assertNotIn("reviewed", record)
        self.assertIsNone(record["verifiedBy"])

    def test_extension_invalid_dates_and_extra_fields(self):
        ext = extension(oldSignupEnd="2026-02-30", note="x")
        errors = validate(reviewed_record(extension=ext))
        self.assertTrue(has_error(errors, "extension.oldSignupEnd: must be an existing calendar date"))
        self.assertIn("extension: unexpected field", errors)

    def test_extension_must_be_object(self):
        errors = validate(reviewed_record(extension="2026-11-30"))
        self.assertIn("extension: must be an object or absent (got str)", errors)


class PurityTests(unittest.TestCase):
    def test_input_not_mutated(self):
        for record in (reviewed_record(extension=extension()),
                       minimal_record(maxBonusCents=-5, sourceUrl="http://u:p@x"), {}):
            snapshot = copy.deepcopy(record)
            validate(record)
            self.assertEqual(record, snapshot)

    def test_result_is_only_structural(self):
        record = minimal_record()
        result = validate(record)
        self.assertEqual(result, [])
        self.assertIsInstance(result, list)
        self.assertNotIn("reviewed", record)
        self.assertNotIn("status", record)
        self.assertNotIn("VERIFIED", repr(record))

    def test_unreviewed_valid_structure_is_not_review(self):
        record = minimal_record(signupEnd="2026-10-31")
        self.assertEqual(validate(record), [])
        self.assertIsNone(record["verifiedBy"])
        self.assertIsNone(record["verifiedAt"])


class DiagnosticTests(unittest.TestCase):
    def test_control_characters_in_source_url_rejected(self):
        for url in ("\x00https://bank.example.pl/r.pdf",
                    "https://bank\x00.example.pl/r.pdf",
                    "https://bank.example.pl/\x7fr.pdf"):
            with self.subTest(url=repr(url)):
                errors = validate(minimal_record(sourceUrl=url))
                self.assertIn("sourceUrl: must not contain control characters", errors)

    def test_unknown_extension_field_name_not_echoed(self):
        unknown = "https://u:syntheticSecret@x.test"
        errors = validate(reviewed_record(extension=extension(**{unknown: True})))
        self.assertIn("extension: unexpected field", errors)
        self.assertNotIn(unknown, " ".join(errors))
        self.assertNotIn("syntheticSecret", " ".join(errors))


if __name__ == "__main__":
    unittest.main()
