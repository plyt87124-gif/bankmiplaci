"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { AuthSwitch } from "./AuthCard";
import { LoginForm } from "./LoginForm";
import { safeRedirectPath } from "./authFlow";

/** Client part of /konto/logowanie: the form plus what happens after success. */
export function LoginPageForm({ redirect }: { redirect?: string }) {
  const router = useRouter();
  const target = safeRedirectPath(redirect, "/konto");
  // Keep the (validated) destination when hopping between sign-in and sign-up.
  const safeParam = safeRedirectPath(redirect, "");
  const query = safeParam ? `?redirect=${encodeURIComponent(safeParam)}` : "";

  return (
    <>
      <LoginForm
        onSuccess={() => {
          router.push(target);
          router.refresh();
        }}
      />
      <Link href="/konto/zapomniane-haslo" className="link-inline mt-2 inline-flex min-h-11 items-center text-small">
        Nie pamiętam hasła
      </Link>
      <AuthSwitch question="Nie masz jeszcze konta?">
        <ButtonLink href={`/konto/rejestracja${query}`} variant="secondary" fullWidth>
          Załóż darmowe konto
        </ButtonLink>
      </AuthSwitch>
    </>
  );
}
