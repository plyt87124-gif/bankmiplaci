import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/app/konto/logowanie/AuthCard";
import { firstParam } from "@/app/konto/logowanie/authFlow";
import { FormMessage } from "@/components/ui/FormMessage";
import { ResetPasswordForm } from "./ResetPasswordForm";

// Indexing is already blocked for the whole /konto tree (konto/layout.tsx).
export const metadata: Metadata = { title: "Ustaw nowe hasło" };

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = firstParam((await searchParams).token) ?? "";

  if (!token) {
    return (
      <AuthCard title="Ustaw nowe hasło">
        <FormMessage className="!mt-0 text-small">
          Brak tokenu resetu hasła w adresie. Poproś o nowy link.
        </FormMessage>
        <Link href="/konto/zapomniane-haslo" className="link-inline mt-4 inline-flex min-h-11 items-center text-small">
          Wyślij nowy link resetujący
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Ustaw nowe hasło">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
