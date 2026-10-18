/**
 * Small, framework-free pieces shared by the sign-in/sign-up forms, the
 * AuthModal and the /konto/* pages. Everything here is testable in plain Node
 * (tests/register-auth-flow.test.ts); only `postAuth` touches `fetch`.
 */

export type AuthMode = "login" | "register";

export const AUTH_TITLES: Record<AuthMode, string> = {
  login: "Zaloguj się",
  register: "Załóż konto"
};

/**
 * What an account is for, in one text for /konto/logowanie, /konto/rejestracja
 * and the sign-up tab of the modal. Every item exists: comments under offers
 * (PromotionComments), the "ściąga" of an offer (JoinChecklistButton) and the
 * eligibility check after a karencja (EligibilityBanner, from the bank history
 * the user types in). Nothing is read from a bank.
 */
export const ACCOUNT_BENEFITS =
  "Konto pozwala komentować promocje, prowadzić ściągę i sprawdzać, od kiedy można skorzystać po okresie karencji. Nie łączymy się z kontem bankowym – korzystamy tylko z danych wpisanych przez Ciebie (np. dat otwarcia i zamknięcia kont).";

export const AUTH_INTROS: Record<AuthMode, string> = {
  login: "Zaloguj się, żeby dokończyć. Zostaniesz na tej samej stronie.",
  register: ACCOUNT_BENEFITS
};

/** A form message is a full sentence: adds the final full stop when a message has none. */
export function finishSentence(message: string): string {
  const text = message.trim();
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

const SAFE_ORIGIN = "http://redirect-check.invalid";

/**
 * The `?redirect=` parameter comes from the address bar, so it is user input:
 * only a path on THIS site is accepted ("/promocje/xyz?utm=1"). Absolute URLs,
 * protocol-relative ("//evil.example"), backslash and control-character tricks
 * ("/\evil", "/\t/evil") all fall back to `fallback`.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== "string" || raw === "") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, SAFE_ORIGIN);
    if (url.origin !== SAFE_ORIGIN) return fallback;
    const out = `${url.pathname}${url.search}${url.hash}`;
    // Dot-segments can normalise to a protocol-relative URL ("/.//evil.example" -> "//evil.example").
    if (!out.startsWith("/") || out.startsWith("//") || out.startsWith("/\\")) return fallback;
    return out;
  } catch {
    return fallback;
  }
}

/** Query value from Next's `searchParams` (string | string[] | undefined) -> first string. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/* ------------------------------------------------------------------ */
/* Backdrop click: close ONLY when the press AND the release are on it */
/* ------------------------------------------------------------------ */

export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** True when the point lies outside the rectangle (the backdrop around a modal dialog). */
export function isOutsideRect(point: { x: number; y: number }, rect: RectLike): boolean {
  return point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom;
}

/**
 * A text selection that starts inside the dialog and ends on the backdrop
 * (or the other way round) must NOT close it. Feed `down()` on mousedown and
 * `up()` on mouseup with "was the pointer on the backdrop?"; `up()` returns
 * true only when both were.
 */
export function createBackdropCloseTracker() {
  let pressedOnBackdrop = false;
  return {
    down(onBackdrop: boolean) {
      pressedOnBackdrop = onBackdrop;
    },
    up(onBackdrop: boolean): boolean {
      const shouldClose = pressedOnBackdrop && onBackdrop;
      pressedOnBackdrop = false;
      return shouldClose;
    },
    reset() {
      pressedOnBackdrop = false;
    }
  };
}

/* ------------------------------------------------------------------ */
/* Talking to /api/account/*                                           */
/* ------------------------------------------------------------------ */

export type AuthResult = { ok: true } | { ok: false; error: string; field?: string };

/** POST JSON to an account endpoint. Never throws: network problems become an error result. */
export async function postAuth(url: string, body: unknown, fallbackError: string): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    return { ok: false, error: "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie." };
  }
  if (res.ok) return { ok: true };

  const data = (await res.json().catch(() => null)) as { error?: unknown; field?: unknown } | null;
  return {
    ok: false,
    error: finishSentence(typeof data?.error === "string" && data.error ? data.error : fallbackError),
    field: typeof data?.field === "string" ? data.field : undefined
  };
}
