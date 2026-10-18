import type { Metadata } from "next";
import { AuthCard } from "@/app/konto/logowanie/AuthCard";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

// Indexing is already blocked for the whole /konto tree (konto/layout.tsx).
export const metadata: Metadata = { title: "Nie pamiętasz hasła?" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Nie pamiętasz hasła?" intro="Podaj adres e-mail, na który założono konto.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
