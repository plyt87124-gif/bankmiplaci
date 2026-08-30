import type { Metadata } from "next";

// kontakt/page.tsx is a Client Component and can't export `metadata` itself —
// this thin server layout supplies it without touching the form logic.
export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Zauważyłeś nieaktualną promocję bankową albo błąd w warunkach? Napisz do nas — każde zgłoszenie trafia do weryfikacji przed aktualizacją bazy.",
  alternates: { canonical: "/kontakt" }
};

export default function KontaktLayout({ children }: { children: React.ReactNode }) {
  return children;
}
