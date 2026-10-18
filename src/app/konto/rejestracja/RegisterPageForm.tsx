"use client";

import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { AuthSwitch } from "@/app/konto/logowanie/AuthCard";
import { safeRedirectPath } from "@/app/konto/logowanie/authFlow";
import { RegisterForm } from "./RegisterForm";

/** Client part of /konto/rejestracja: the form plus what happens after success. */
export function RegisterPageForm({ redirect }: { redirect?: string }) {
  const router = useRouter();
  // A redirect param means they were sent here from somewhere specific (e.g. a
  // promotion page): honour it instead of the onboarding step, which only
  // makes sense for an organic sign-up. Only paths on this site are accepted.
  const safeParam = safeRedirectPath(redirect, "");
  const target = safeParam || "/konto?onboarding=1";
  const query = safeParam ? `?redirect=${encodeURIComponent(safeParam)}` : "";

  return (
    <>
      <RegisterForm
        onSuccess={() => {
          router.push(target);
          router.refresh();
        }}
      />
      <AuthSwitch question="Masz już konto?">
        <ButtonLink href={`/konto/logowanie${query}`} variant="secondary" fullWidth>
          Zaloguj się
        </ButtonLink>
      </AuthSwitch>
    </>
  );
}
