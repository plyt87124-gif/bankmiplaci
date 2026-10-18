import type { Metadata } from "next";
import { AuthCard } from "./AuthCard";
import { LoginPageForm } from "./LoginPageForm";
import { ACCOUNT_BENEFITS, firstParam } from "./authFlow";

// Indexing is already blocked for the whole /konto tree (konto/layout.tsx).
export const metadata: Metadata = { title: "Zaloguj się" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect } = await searchParams;

  return (
    <AuthCard title="Zaloguj się" intro={ACCOUNT_BENEFITS}>
      <LoginPageForm redirect={firstParam(redirect)} />
    </AuthCard>
  );
}
