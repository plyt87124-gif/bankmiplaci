import type { Metadata } from "next";

// Applies to /konto and every nested route (logowanie, rejestracja,
// reset-hasla, zapomniane-haslo) — Next.js metadata cascades down the
// segment tree, so this one file covers the whole account area. These
// pages have no unique search value and shouldn't appear in results.
export const metadata: Metadata = {
  robots: { index: false, follow: true }
};

export default function KontoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
