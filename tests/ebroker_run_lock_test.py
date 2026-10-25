"""Offline unit tests for scripts/ebroker_run_lock.py (Python 3 stdlib only).

Every test works inside its own TemporaryDirectory; no real snapshots or personal
paths are touched. Run from the repository root:

    python tests/ebroker_run_lock_test.py
"""
from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("ebroker_run_lock", ROOT / "scripts" / "ebroker_run_lock.py")
rl = importlib.util.module_from_spec(_spec)
sys.modules["ebroker_run_lock"] = rl
_spec.loader.exec_module(rl)

TOKEN_A = "run-20261004T080000Z-a1b2"
TOKEN_B = "run-20261004T081500Z-c3d4"


class RunLockTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.base = Path(self._tmp.name)
        self.lock = self.base / "ebroker.lock"

    def tearDown(self):
        self._tmp.cleanup()

    def owner_bytes(self):
        return (self.lock / rl.OWNER_FILENAME).read_bytes()

    def test_first_acquire_creates_dir_and_owner(self):
        result = rl.acquire_lock(self.lock, TOKEN_A)
        self.assertEqual(result, self.lock)
        self.assertTrue(self.lock.is_dir())
        self.assertEqual(os.listdir(self.lock), [rl.OWNER_FILENAME])
        self.assertEqual(self.owner_bytes(), f"bankmiplaci-run-lock v1\nowner={TOKEN_A}\n".encode("utf-8"))

    def test_second_acquire_is_busy_and_keeps_owner(self):
        rl.acquire_lock(self.lock, TOKEN_A)
        before = self.owner_bytes()
        for token in (TOKEN_B, TOKEN_A):
            with self.assertRaises(rl.LockBusyError):
                rl.acquire_lock(self.lock, token)
        self.assertEqual(self.owner_bytes(), before)

    def test_foreign_token_release_refused_and_lock_kept(self):
        rl.acquire_lock(self.lock, TOKEN_A)
        with self.assertRaises(rl.LockOwnershipMismatchError):
            rl.release_lock(self.lock, TOKEN_B)
        self.assertEqual(os.listdir(self.lock), [rl.OWNER_FILENAME])
        self.assertIn(TOKEN_A.encode(), self.owner_bytes())

    def test_correct_release_then_acquire_again(self):
        rl.acquire_lock(self.lock, TOKEN_A)
        rl.release_lock(self.lock, TOKEN_A)
        self.assertFalse(os.path.lexists(self.lock))
        rl.acquire_lock(self.lock, TOKEN_B)
        self.assertIn(TOKEN_B.encode(), self.owner_bytes())
        rl.release_lock(self.lock, TOKEN_B)
        self.assertFalse(os.path.lexists(self.lock))

    def test_release_without_lock_refused(self):
        with self.assertRaises(rl.LockReleaseRefusedError):
            rl.release_lock(self.lock, TOKEN_A)

    def test_incomplete_lock_without_owner(self):
        self.lock.mkdir()
        with self.assertRaises(rl.LockBusyError):
            rl.acquire_lock(self.lock, TOKEN_A)
        with self.assertRaises(rl.LockReleaseRefusedError):
            rl.release_lock(self.lock, TOKEN_A)
        self.assertTrue(self.lock.is_dir())

    def test_incomplete_or_unexpected_owner_content(self):
        self.lock.mkdir()
        owner = self.lock / rl.OWNER_FILENAME
        bad_contents = [
            b"",
            b"bankmiplaci-run-lock v1\nowner=" + TOKEN_A.encode(),  # truncated, no newline
            b"bankmiplaci-run-lock v1\n",
            TOKEN_A.encode() + b"\n",
            b"bankmiplaci-run-lock v1\nowner=" + TOKEN_A.encode() + b"\nextra\n",
            b"\xff\xfe" + TOKEN_A.encode(),
            b"x" * (rl.MAX_OWNER_BYTES + 10),
        ]
        for content in bad_contents:
            with self.subTest(content=content[:40]):
                owner.write_bytes(content)
                with self.assertRaises(rl.LockReleaseRefusedError) as ctx:
                    rl.release_lock(self.lock, TOKEN_A)
                self.assertNotIsInstance(ctx.exception, rl.LockOwnershipMismatchError)
                self.assertEqual(owner.read_bytes(), content)
                with self.assertRaises(rl.LockBusyError):
                    rl.acquire_lock(self.lock, TOKEN_A)

    def test_extra_foreign_file_untouched(self):
        rl.acquire_lock(self.lock, TOKEN_A)
        foreign = self.lock / "notes.txt"
        foreign.write_text("keep me", encoding="utf-8")
        owner_before = self.owner_bytes()
        with self.assertRaises(rl.LockReleaseRefusedError):
            rl.release_lock(self.lock, TOKEN_A)
        self.assertEqual(foreign.read_text(encoding="utf-8"), "keep me")
        self.assertEqual(self.owner_bytes(), owner_before)

    def test_owner_write_error_cleans_up_own_files(self):
        with mock.patch.object(rl, "_write_all", side_effect=OSError("disk full")):
            with self.assertRaises(rl.LockOwnerWriteError) as ctx:
                rl.acquire_lock(self.lock, TOKEN_A)
        self.assertFalse(ctx.exception.lock_dir_remains)
        self.assertIn("disk full", str(ctx.exception))
        self.assertFalse(os.path.lexists(self.lock))
        rl.acquire_lock(self.lock, TOKEN_A)
        rl.release_lock(self.lock, TOKEN_A)

    def test_owner_write_error_reports_remaining_lock(self):
        real_rmdir = os.rmdir

        def failing_rmdir(path, *args, **kwargs):
            if Path(path) == self.lock:
                raise OSError("rmdir denied")
            return real_rmdir(path, *args, **kwargs)

        with mock.patch.object(rl, "_write_all", side_effect=OSError("disk full")), \
                mock.patch.object(rl.os, "rmdir", side_effect=failing_rmdir):
            with self.assertRaises(rl.LockOwnerWriteError) as ctx:
                rl.acquire_lock(self.lock, TOKEN_A)
        self.assertTrue(ctx.exception.lock_dir_remains)
        self.assertTrue(self.lock.is_dir())
        with self.assertRaises(rl.LockBusyError):
            rl.acquire_lock(self.lock, TOKEN_A)

    def test_invalid_tokens_rejected_without_side_effects(self):
        bad_tokens = ["", " ", "a b", "tok\n", "../x", "a/b", "a\\b", "-lead", ".lead",
                      "x" * 129, "zażółć", None, 123, b"bytes"]
        for token in bad_tokens:
            with self.subTest(token=token):
                with self.assertRaises(rl.InvalidOwnerTokenError):
                    rl.acquire_lock(self.lock, token)
                self.assertFalse(os.path.lexists(self.lock))
        rl.acquire_lock(self.lock, TOKEN_A)
        for token in ("", "a/b", None):
            with self.subTest(release_token=token):
                with self.assertRaises(rl.InvalidOwnerTokenError):
                    rl.release_lock(self.lock, token)
        self.assertIn(TOKEN_A.encode(), self.owner_bytes())

    def test_regular_file_at_lock_path(self):
        self.lock.write_text("not a lock", encoding="utf-8")
        with self.assertRaises(rl.LockBusyError):
            rl.acquire_lock(self.lock, TOKEN_A)
        with self.assertRaises(rl.LockReleaseRefusedError):
            rl.release_lock(self.lock, TOKEN_A)
        self.assertEqual(self.lock.read_text(encoding="utf-8"), "not a lock")

    def test_missing_parent_is_io_error(self):
        with self.assertRaises(rl.LockIOError):
            rl.acquire_lock(self.base / "missing" / "ebroker.lock", TOKEN_A)

    def _symlink_or_skip(self, target, link, target_is_directory):
        try:
            os.symlink(target, link, target_is_directory=target_is_directory)
        except (OSError, NotImplementedError, AttributeError) as exc:
            self.skipTest(f"symlinks not supported in this environment: {exc}")

    def test_lock_dir_symlink_refused(self):
        real = self.base / "real_lock"
        rl.acquire_lock(real, TOKEN_A)
        self._symlink_or_skip(real, self.lock, True)
        with self.assertRaises(rl.LockBusyError):
            rl.acquire_lock(self.lock, TOKEN_A)
        with self.assertRaises(rl.LockReleaseRefusedError):
            rl.release_lock(self.lock, TOKEN_A)
        self.assertTrue(os.path.islink(self.lock))
        self.assertEqual(os.listdir(real), [rl.OWNER_FILENAME])

    def test_owner_symlink_refused(self):
        target = self.base / "elsewhere.txt"
        target.write_bytes(rl.owner_record(TOKEN_A))
        self.lock.mkdir()
        self._symlink_or_skip(target, self.lock / rl.OWNER_FILENAME, False)
        with self.assertRaises(rl.LockReleaseRefusedError):
            rl.release_lock(self.lock, TOKEN_A)
        self.assertTrue(os.path.islink(self.lock / rl.OWNER_FILENAME))
        self.assertEqual(target.read_bytes(), rl.owner_record(TOKEN_A))


if __name__ == "__main__":
    unittest.main()
