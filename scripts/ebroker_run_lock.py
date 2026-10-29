"""Local single-run lock for the future eBroker catalog scheduler (Python 3 stdlib only).

Not wired into the collector or any scheduler yet. The host that integrates this
module generates ``owner_token`` (a non-secret, per-run identifier) and calls:

    acquire_lock(lock_dir, owner_token)   # before one catalog read
    release_lock(lock_dir, owner_token)   # after it, success or failure

Model and guarantees
--------------------
* Acquire is ``os.mkdir(lock_dir)`` (atomic, never ``exist_ok=True``). Only after
  that succeeds is ``lock_dir/owner`` created with ``O_CREAT|O_EXCL`` and a small
  UTF-8 record naming the token.
* Anything already at ``lock_dir`` (directory, file, symlink, half-written lock)
  means the lock is busy. There is NO time-based takeover: a stale lock stays
  until a human inspects and removes it.
* Release removes only a complete lock owned by the exact token: ``lock_dir``
  must be a real directory (no symlink / reparse point) containing exactly one
  regular, non-symlink ``owner`` file with the expected content. Only that file
  is unlinked and then the directory is removed with non-recursive ``rmdir``.
  Foreign files are never deleted; their presence makes release refuse.
* Every refusal raises a specific ``LockError`` subclass; nothing is silently
  ignored and a refusal never hides that a lock exists.

Limitations (read before integrating)
-------------------------------------
* Assumes cooperating processes on a local filesystem. It is not protection
  against a malicious process and is not meant for network filesystems.
* Release is check-then-act. ``owner`` identity (device, inode, size, mtime) and
  the directory listing are re-verified immediately before ``unlink``, but a
  manual change in the remaining tiny window (e.g. someone replacing ``owner``
  or adding a file at that instant) cannot be excluded. If a file is added after
  ``owner`` was unlinked, ``rmdir`` fails, the directory stays (so the lock still
  reads as busy) and ``LockReleaseRefusedError`` is raised for manual cleanup.
* Symlinks/junctions in *parent* directories of ``lock_dir`` are not checked;
  the host must pass a trusted path.
* If writing ``owner`` fails, the module removes only what it created in that
  call. If that cleanup fails too, ``LockOwnerWriteError.lock_dir_remains`` is
  True and the incomplete lock keeps blocking until removed manually.
"""
from __future__ import annotations

import os
import re
import stat
from pathlib import Path

OWNER_FILENAME = "owner"
OWNER_HEADER = "bankmiplaci-run-lock v1"
MAX_OWNER_BYTES = 512
_TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
_RECORD_RE = re.compile(re.escape(OWNER_HEADER) + r"\nowner=([^\n]*)\n")
_O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)
_O_BINARY = getattr(os, "O_BINARY", 0)
_REPARSE_POINT = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)


class LockError(Exception):
    """Base class for every lock failure."""


class InvalidOwnerTokenError(LockError, ValueError):
    """owner_token is not a non-empty safe ASCII identifier."""


class LockBusyError(LockError):
    """Something already exists at lock_dir; the lock is held or incomplete."""


class LockIOError(LockError):
    """lock_dir could not be created for a reason other than already existing."""


class LockOwnerWriteError(LockError):
    """lock_dir was created but the owner record could not be written."""

    def __init__(self, message: str, lock_dir_remains: bool):
        super().__init__(message)
        self.lock_dir_remains = lock_dir_remains


class LockReleaseRefusedError(LockError):
    """Release refused: lock missing, incomplete, unexpected or not a plain directory."""


class LockOwnershipMismatchError(LockReleaseRefusedError):
    """Release refused: the lock is complete but belongs to another token."""


def validate_owner_token(owner_token: object) -> str:
    if not isinstance(owner_token, str) or not _TOKEN_RE.fullmatch(owner_token):
        raise InvalidOwnerTokenError(
            "owner_token must be 1-128 chars of [A-Za-z0-9._-] starting with a letter or digit")
    return owner_token


def owner_record(owner_token: str) -> bytes:
    return f"{OWNER_HEADER}\nowner={validate_owner_token(owner_token)}\n".encode("utf-8")


def _write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        written = os.write(fd, view)
        if written <= 0:
            raise OSError("short write while writing lock owner")
        view = view[written:]
    os.fsync(fd)


def _is_link_like(st: os.stat_result) -> bool:
    return stat.S_ISLNK(st.st_mode) or bool(getattr(st, "st_file_attributes", 0) & _REPARSE_POINT)


def acquire_lock(lock_dir: str | os.PathLike, owner_token: str) -> Path:
    """Create lock_dir and its owner record. Returns the lock path or raises LockError."""
    record = owner_record(owner_token)
    path = Path(lock_dir)
    try:
        os.mkdir(path)
    except FileExistsError as exc:
        raise LockBusyError(f"lock busy: {path} already exists") from exc
    except OSError as exc:
        raise LockIOError(f"cannot create lock directory {path}: {exc}") from exc

    owner_path = path / OWNER_FILENAME
    created_owner = False
    try:
        fd = os.open(owner_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | _O_NOFOLLOW | _O_BINARY, 0o644)
        created_owner = True
        try:
            _write_all(fd, record)
        finally:
            os.close(fd)
    except OSError as exc:
        remains = True
        try:
            if created_owner:
                os.unlink(owner_path)
            os.rmdir(path)
            remains = False
        except OSError:
            pass
        state = "incomplete lock left in place (busy until removed manually)" if remains else "lock removed"
        raise LockOwnerWriteError(f"cannot write lock owner in {path}: {exc}; {state}", remains) from exc
    return path


def _verify_complete_lock(path: Path, owner_token: str) -> os.stat_result:
    """Check lock_dir holds exactly our owner record; return the owner file's stat."""
    try:
        dir_st = os.lstat(path)
    except FileNotFoundError as exc:
        raise LockReleaseRefusedError(f"no lock at {path}") from exc
    if _is_link_like(dir_st) or not stat.S_ISDIR(dir_st.st_mode):
        raise LockReleaseRefusedError(f"{path} is not a plain directory; refusing to touch it")

    entries = sorted(os.listdir(path))
    if entries != [OWNER_FILENAME]:
        raise LockReleaseRefusedError(
            f"lock {path} is incomplete or has foreign entries {entries!r}; refusing to remove")

    owner_path = path / OWNER_FILENAME
    owner_st = os.lstat(owner_path)
    if _is_link_like(owner_st) or not stat.S_ISREG(owner_st.st_mode):
        raise LockReleaseRefusedError(f"{owner_path} is not a regular file; refusing to remove")
    if owner_st.st_size > MAX_OWNER_BYTES:
        raise LockReleaseRefusedError(f"{owner_path} is unexpectedly large; refusing to remove")

    try:
        fd = os.open(owner_path, os.O_RDONLY | _O_NOFOLLOW | _O_BINARY)
    except OSError as exc:
        raise LockReleaseRefusedError(f"cannot open {owner_path}: {exc}") from exc
    try:
        fd_st = os.fstat(fd)
        data = os.read(fd, MAX_OWNER_BYTES + 1)
    finally:
        os.close(fd)
    if (fd_st.st_dev, fd_st.st_ino) != (owner_st.st_dev, owner_st.st_ino):
        raise LockReleaseRefusedError(f"{owner_path} changed while being read; refusing to remove")

    try:
        match = _RECORD_RE.fullmatch(data.decode("utf-8"))
    except UnicodeDecodeError:
        match = None
    if match is None:
        raise LockReleaseRefusedError(f"{owner_path} has incomplete or unexpected content; refusing to remove")
    if match.group(1) != owner_token:
        raise LockOwnershipMismatchError(f"lock {path} belongs to another owner; refusing to remove")
    return owner_st


def release_lock(lock_dir: str | os.PathLike, owner_token: str) -> None:
    """Remove a complete lock owned by exactly owner_token, or raise LockError."""
    validate_owner_token(owner_token)
    path = Path(lock_dir)
    try:
        owner_st = _verify_complete_lock(path, owner_token)
        owner_path = path / OWNER_FILENAME
        # Re-check right before acting to narrow the check-then-act window.
        again = os.lstat(owner_path)
        same = (again.st_dev, again.st_ino, again.st_size, again.st_mtime_ns) == (
            owner_st.st_dev, owner_st.st_ino, owner_st.st_size, owner_st.st_mtime_ns)
        if not same or _is_link_like(again) or sorted(os.listdir(path)) != [OWNER_FILENAME]:
            raise LockReleaseRefusedError(f"lock {path} changed during release; refusing to remove")
        os.unlink(owner_path)
    except LockError:
        raise
    except OSError as exc:
        raise LockReleaseRefusedError(f"cannot verify or remove lock {path}: {exc}") from exc
    try:
        os.rmdir(path)
    except OSError as exc:
        raise LockReleaseRefusedError(
            f"owner removed but {path} could not be removed (foreign entry added?): {exc}; "
            "directory left in place, lock still reads as busy") from exc
