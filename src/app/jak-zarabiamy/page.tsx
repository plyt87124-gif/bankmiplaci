import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo";
import { TextPage, type TocEntry } from "../jak-to-dziala/TextPage";

export const metadata: Metadata = staticPageMetadata("jakZarabiamy");

const TOC: TocEntry[] = [
  { id: "afiliacja", label: "Czym jest afiliacja" },
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
        <p>
          Korzystanie z Bankmiplaci jest bezpłatne dla użytkowników. Możemy otrzymywać wynagrodzenie od banków lub sieci
          partnerskich za polecenie ich ofert.
        </p>
      }
      toc={TOC}
    >
      <h2 id="afiliacja" className="!mt-0">
        Czym jest afiliacja
      </h2>
      <p id="polecane">
        Gdy przechodzisz do banku przez link oznaczony jako partnerski (przycisk „Przejdź do promocji”, pod którym
        piszemy „Link partnerski”), a potem otwierasz konto i spełniasz warunki promocji, bank – bezpośrednio albo przez
        sieć partnerską – może wypłacić nam wynagrodzenie. Nie pochodzi ono od Ciebie. Warunki promocji ustala bank.
      </p>

      <h2 id="ocena">Jak liczymy ocenę</h2>
      <p>
        Ocena serwisu (np. 9,4/10) to nasz wewnętrzny wskaźnik do szybkiego porównania ofert, a nie porada finansowa.
      </p>

      <h2 id="czego-nie-robimy">Czego nie robimy</h2>
      <ul>
        <li>Nie przyjmujemy płatności za wyższą ocenę serwisu ani za zmianę opisu oferty.</li>
        <li>Nie zmieniamy warunków, kwot ani opłat pod wpływem banku – dane pochodzą z regulaminu banku.</li>
        <li>Nie pobieramy opłat od użytkowników za korzystanie z porównywarki.</li>
        <li>Nie udajemy banku ani doradcy – nie doradzamy, tylko porównujemy.</li>
      </ul>
    </TextPage>
  );
}
