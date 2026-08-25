import type { Metadata } from "next";
import { FaqAccordion } from "@/components/FaqAccordion";

export const metadata: Metadata = {
  title: "FAQ — najczęstsze pytania",
  description: "Odpowiedzi na najczęstsze pytania o Premię, promocje bankowe i sposób ich weryfikacji.",
  alternates: { canonical: "/faq" }
};

const FAQ_ITEMS = [
  {
    question: "Czy korzystanie z serwisu jest darmowe?",
    answer: "Tak. Przeglądanie i porównywanie promocji na Premii jest całkowicie bezpłatne dla użytkowników."
  },
  {
    question: "Jak zarabiacie?",
    answer:
      "Zarabiamy dzięki marketingowi afiliacyjnemu — jeśli przejdziesz do banku przez nasz link i skorzystasz z promocji, możemy otrzymać wynagrodzenie od banku. Szczegóły znajdziesz na stronie „Jak zarabiamy”."
  },
  {
    question: "Czy promocje są aktualne?",
    answer:
      "Każda promocja ma widoczną datę ostatniej weryfikacji oraz termin ważności. Promocje po terminie są automatycznie oznaczane jako wygasłe i nie są prezentowane jako aktywne. Zawsze zalecamy sprawdzenie aktualnego regulaminu na stronie banku przed podjęciem decyzji."
  },
  {
    question: "Czy muszę korzystać z linku na stronie?",
    answer:
      "Nie musisz. Możesz otworzyć konto bezpośrednio na stronie banku — warunki promocji będą takie same. Skorzystanie z naszego linku pozwala nam jedynie otrzymać wynagrodzenie od banku, nie wpływa to na Twoją ofertę."
  },
  {
    question: "Co zrobić, jeśli nie otrzymam premii?",
    answer:
      "W pierwszej kolejności skontaktuj się z bankiem, w którym otworzyłeś konto — to bank realizuje wypłatę premii i jest w stanie zweryfikować spełnienie warunków po Twojej stronie. Nie mamy dostępu do Twojego konta bankowego ani wglądu w realizację promocji."
  },
  {
    question: "Czy można korzystać z kilku promocji?",
    answer:
      "Zależy to od regulaminu konkretnych promocji i banków — część promocji wyklucza jednoczesny udział w innych ofertach tego samego banku lub dotyczy wyłącznie nowych klientów. Sprawdź warunki „Dla kogo jest promocja?” na stronie każdej oferty."
  },
  {
    question: "Jak sprawdzacie warunki promocji?",
    answer:
      "Warunki, kwoty i terminy pochodzą z oficjalnych regulaminów promocji publikowanych przez banki. Każda promocja w bazie ma podane źródło oraz datę ostatniej weryfikacji."
  }
];

export default function FaqPage() {
  return (
    <div className="container-page max-w-2xl py-14">
      <h1 className="text-3xl font-semibold">Najczęstsze pytania</h1>
      <p className="mt-3 text-ink-500">
        Odpowiedzi mają charakter ogólnoinformacyjny i nie stanowią porady prawnej ani finansowej.
      </p>
      <div className="mt-8">
        <FaqAccordion items={FAQ_ITEMS} />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer }
            }))
          })
        }}
      />
    </div>
  );
}
