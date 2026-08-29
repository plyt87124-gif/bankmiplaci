import { createHash } from "crypto";

/**
 * Deterministic bigint key for pg_advisory_xact_lock, derived from the
 * given parts (promotionId + visitor hash). Two requests with the same
 * parts always hash to the same key, so Postgres serializes them —
 * that's what makes the click-dedup check in /out/[slug] race-safe
 * (a plain SELECT-then-INSERT is not, under two truly concurrent
 * identical requests).
 */
export function advisoryLockKey(...parts: string[]): bigint {
  const hash = createHash("sha256").update(parts.join(":")).digest();
  return hash.readBigInt64BE(0);
}
