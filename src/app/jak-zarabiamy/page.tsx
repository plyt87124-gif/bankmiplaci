import type { Metadata } from "next";
import Link from "next/link";
import { staticPageMetadata } from "@/lib/seo";
import { TextPage, type TocEntry } from "../jak-to-dziala/TextPage";

export const metadata: Metadata = staticPageMetadata("jakZarabiamy");

const TOC: TocEntry[] = [
  { id: "ocena", label: "Jak liczymy ocenę" },
  { id: "czego-nie-robimy", label: "Czego nie robimy" }
];

export default function HowWeEarnPage() {
  return (
    <TextPage
      path="/jak-zarabiamy"
      breadcrumbLabel="Jak zarabiamy"
      title="Jak zarabiamy"
      lead={
        <p id="polecane">
          Korzystanie z Bankmiplaci jest bezpłatne dla użytkowników. Możemy otrzymywać wynagrodzenie, jeśli otworzysz konto
          przez naszą stronę.
        </p>
      }
      toc={TOC}
    >
      <h2 id="ocena" className="!mt-0">
        Jak liczymy ocenę
      </h2>
      <p>
        Ocena serwisu (np. 9,4/10) to nasz wewnętrzny wskaźnik do szybkiego porównania ofert, a nie porada finansowa. Z czego się
        składa i który składnik wpływa najmocniej, opisuje <Link href="/metodologia">metodologia</Link>.
      </p>

      <h2 id="czego-nie-robimy">Czego nie robimy</h2>
      <ul>
        <li>Nie zmieniamy ręcznie oceny serwisu ani opisu oferty na prośbę banku.</li>
        <li>Nie zmieniamy warunków, kwot ani opłat pod wpływem banku – dane pochodzą z regulaminu banku.</li>
        <li>Nie pobieramy opłat od użytkowników za korzystanie z porównywarki.</li>
        <li>Nie udajemy banku ani doradcy – nie doradzamy, tylko porównujemy.</li>
      </ul>
    </TextPage>
  );
}
