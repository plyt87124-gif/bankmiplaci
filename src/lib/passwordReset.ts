import crypto from "crypto";
import { db } from "@/lib/db";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a password-reset token for a user and returns the raw (unhashed)
 * value to embed in the reset link — only the SHA-256 hash is stored.
 * Shared by the public "zapomniałem hasła" flow (api/account/forgot-password)
 * and the admin "wyślij link do resetu hasła" action, so both produce
 * tokens the same /konto/reset-hasla page can redeem.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) }
  });
  return rawToken;
}

export function passwordResetUrl(rawToken: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}/konto/reset-hasla?token=${rawToken}`;
}
