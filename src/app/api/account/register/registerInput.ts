import { z } from "zod";
import { registerSchema } from "@/lib/validation/account";

/**
 * Registration input: ONE definition used by the route (server, authoritative)
 * and by the sign-up forms (client, only to show errors sooner). Pure - no
 * database, no cookies - so it is unit-tested in tests/register-consent.test.ts.
 */

/**
 * Version of the Regulamin + Polityka prywatnosci the user accepts while
 * signing up (saved as User.termsVersion). The ONLY place that knows it: bump
 * it when the terms change materially (same value as the "Data wejscia w
 * zycie" of the new terms, month precision is enough). Older accounts keep
 * the version they accepted; accounts created before this field existed have
 * NULL ("no recorded acceptance") and are never blocked by it.
 */
export const TERMS_VERSION = "2026-10";

export const ACCEPT_TERMS_MESSAGE =
  "Aby założyć konto, zaakceptuj Regulamin i potwierdź zapoznanie się z Polityką prywatności.";

export type RegisterField = "name" | "username" | "email" | "password" | "acceptTerms";

const REGISTER_FIELDS: readonly RegisterField[] = ["name", "username", "email", "password", "acceptTerms"];

export const registerRequestSchema = registerSchema.extend({
  name: z.string().trim().max(80, "Imię może mieć max. 80 znaków").optional(),
  // Exactly `true`: a missing, false or string value never counts as consent.
  acceptTerms: z.literal(true, { errorMap: () => ({ message: ACCEPT_TERMS_MESSAGE }) })
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export type RegisterFieldErrors = Partial<Record<RegisterField, string>>;

function isRegisterField(value: unknown): value is RegisterField {
  return typeof value === "string" && (REGISTER_FIELDS as readonly string[]).includes(value);
}

/** First message per field, in the order zod reported them. */
export function fieldErrorsFromIssues(issues: readonly { path: readonly (string | number)[]; message: string }[]): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (isRegisterField(key) && errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
}

export type ParsedRegister =
  | { success: true; data: RegisterRequest }
  | { success: false; error: string; field?: RegisterField; fieldErrors: RegisterFieldErrors };

/** Validates an unknown request body. `error`/`field` describe the first problem. */
export function parseRegisterRequest(body: unknown): ParsedRegister {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { success: false, error: "Nieprawidłowe dane.", fieldErrors: {} };
  }
  const parsed = registerRequestSchema.safeParse(body);
  if (parsed.success) return { success: true, data: parsed.data };

  const fieldErrors = fieldErrorsFromIssues(parsed.error.issues);
  const first = parsed.error.issues[0];
  const key = first?.path[0];
  return {
    success: false,
    error: first?.message ?? "Nieprawidłowe dane.",
    field: isRegisterField(key) ? key : undefined,
    fieldErrors
  };
}

/** Raw values of the sign-up form (strings from inputs, boolean from the checkbox). */
export interface RegisterFormValues {
  name: string;
  username: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

/** Client-side check of the form values with the very same rules as the server. */
export function validateRegisterValues(values: RegisterFormValues): RegisterFieldErrors {
  const result = parseRegisterRequest({
    name: values.name,
    username: values.username.trim(),
    email: values.email.trim(),
    password: values.password,
    acceptTerms: values.acceptTerms
  });
  return result.success ? {} : result.fieldErrors;
}
