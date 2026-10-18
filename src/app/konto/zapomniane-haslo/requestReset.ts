export const NETWORK_ERROR = "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.";
export const GENERIC_ERROR = "Nie udało się wysłać linku. Spróbuj ponownie.";

export type ForgotResult = { ok: true; devResetUrl?: string } | { ok: false; error: string };

/**
 * POST /api/account/forgot-password. Its own helper (not postAuth): outside
 * production the API adds a `devResetUrl` to the body, which postAuth does not
 * expose. Never throws:
 *  - network failure                      -> NETWORK_ERROR
 *  - non-2xx, body is not JSON / no error -> GENERIC_ERROR
 *  - non-2xx with a text `error`          -> that text
 *  - 2xx                                  -> ok, with `devResetUrl` only when it is a non-empty string
 */
export async function requestReset(email: string): Promise<ForgotResult> {
  let res: Response;
  try {
    res = await fetch("/api/account/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
  const data = (await res.json().catch(() => null)) as { error?: unknown; devResetUrl?: unknown } | null;
  if (!res.ok) {
    return { ok: false, error: typeof data?.error === "string" && data.error ? data.error : GENERIC_ERROR };
  }
  const devResetUrl = typeof data?.devResetUrl === "string" && data.devResetUrl ? data.devResetUrl : undefined;
  return { ok: true, devResetUrl };
}
