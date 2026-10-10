import type { Metadata } from "next";
import { AuthCard } from "@/app/konto/logowanie/AuthCard";
import { ACCOUNT_BENEFITS, firstParam } from "@/app/konto/logowanie/authFlow";
import { RegisterPageForm } from "./RegisterPageForm";

// Indexing is already blocked for the whole /konto tree (konto/layout.tsx).
export const metadata: Metadata = { title: "Załóż konto" };

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect } = await searchParams;

  return (
    <AuthCard title="Załóż konto" intro={ACCOUNT_BENEFITS}>
      <RegisterPageForm redirect={firstParam(redirect)} />
    </AuthCard>
  );
}
