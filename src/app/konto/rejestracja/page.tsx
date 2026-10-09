import type { Metadata } from "next";
import { AuthCard } from "@/app/konto/logowanie/AuthCard";
import { firstParam } from "@/app/konto/logowanie/authFlow";
import { RegisterPageForm } from "./RegisterPageForm";

// Indexing is already blocked for the whole /konto tree (konto/layout.tsx).
export const metadata: Metadata = { title: "Zakładanie konta" };

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const { redirect } = await searchParams;

  return (
    <AuthCard title="Załóż konto" intro="Darmowe konto pozwala komentować promocje i śledzić okresy karencji.">
      <RegisterPageForm redirect={firstParam(redirect)} />
    </AuthCard>
  );
}
