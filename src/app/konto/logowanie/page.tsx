import type { Metadata } from "next";
import { AuthCard } from "./AuthCard";
import { LoginPageForm } from "./LoginPageForm";
import { firstParam } from "./authFlow";

// Indexing is already blocked for the whole /konto tree (konto/layout.tsx).
export const metadata: Metadata = { title: "Logowanie" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect } = await searchParams;

  return (
    <AuthCard title="Zaloguj się" intro="Zaloguj się, aby komentować promocje i zapisywać swoją historię bankową.">
      <LoginPageForm redirect={firstParam(redirect)} />
    </AuthCard>
  );
}
