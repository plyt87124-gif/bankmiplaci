import {
  validateRegisterValues,
  type RegisterFieldErrors,
  type RegisterFormValues
} from "@/app/api/account/register/registerInput";
import { finishSentence } from "@/app/konto/logowanie/authFlow";

/** Empty required fields: they are asked for, not reported as "too short". */
export const REGISTER_REQUIRED_MESSAGES = {
  username: "Podaj nazwę użytkownika.",
  email: "Podaj adres e-mail.",
  password: "Podaj hasło."
} as const;

/**
 * The client check of the sign-up form. The rules are the server's
 * (validateRegisterValues, which stays the authority); this layer only fixes
 * the wording of the messages shown under the fields:
 *   - an EMPTY username / e-mail / password says what to fill in
 *     ("Podaj nazwę użytkownika."), not "min. 3 znaki";
 *   - a filled but wrong value keeps the rule's own message (length, characters,
 *     a valid address);
 *   - every message is a full sentence with a full stop, the same as in the
 *     sign-in form.
 */
export function validateRegisterForm(values: RegisterFormValues): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  for (const [field, message] of Object.entries(validateRegisterValues(values)) as [keyof RegisterFieldErrors, string][]) {
    errors[field] = finishSentence(message);
  }
  if (!values.username.trim()) errors.username = REGISTER_REQUIRED_MESSAGES.username;
  if (!values.email.trim()) errors.email = REGISTER_REQUIRED_MESSAGES.email;
  if (!values.password) errors.password = REGISTER_REQUIRED_MESSAGES.password;
  return errors;
}
