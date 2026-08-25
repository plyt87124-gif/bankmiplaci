"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface Step {
  title: string;
  summary: string;
  details: string;
}

const STEPS: Step[] = [
  {
    title: 'Kliknij "Przejdź do promocji"',
    summary: "Zostaniesz przekierowany na stronę banku.",
    details:
      "Link partnerski pozwala nam zweryfikować, że to Twoje zgłoszenie skorzystało z promocji za naszym pośrednictwem — nie wpływa to na warunki oferty ani nie generuje dla Ciebie dodatkowych kosztów."
  },
  {
    title: "Otwórz konto zgodnie z zasadami promocji",
    summary: "Wypełnij wniosek na stronie banku, zwracając uwagę na wymagany kanał otwarcia konta.",
    details:
      "Niektóre promocje wymagają otwarcia konta wyłącznie online lub przez konkretną aplikację — sprawdź to w sekcji „Co musisz zrobić?” poniżej, zanim rozpoczniesz wniosek."
  },
  {
    title: "Spełnij wymagane warunki",
    summary: "Wykonaj płatności kartą, zapewnij wpływ lub inne czynności wskazane w regulaminie promocji.",
    details:
      "Terminy na spełnienie warunków są zwykle liczone od dnia otwarcia konta lub od konkretnej daty kalendarzowej — sprawdź dokładny harmonogram w warunkach promocji."
  },
  {
    title: "Odbierz premię",
    summary: "Bank nalicza premię automatycznie po weryfikacji spełnienia warunków.",
    details:
      "Czas oczekiwania na wypłatę premii zależy od banku i zwykle jest podany w regulaminie promocji — najczęściej to od kilku dni do kilku tygodni po spełnieniu ostatniego warunku."
  }
];

export function HowToGetBonus() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <ol className="space-y-3">
      {STEPS.map((step, i) => (
        <li key={step.title} className="rounded-xl2 border border-ink-100 bg-surface p-4">
          <button
            className="flex w-full items-start justify-between gap-4 text-left"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
          >
            <div className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 font-mono text-sm font-medium text-teal-700">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-ink-900">{step.title}</p>
                <p className="mt-1 text-sm text-ink-500">{step.summary}</p>
              </div>
            </div>
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-ink-300 transition-transform", openIndex === i && "rotate-180")} />
          </button>
          {openIndex === i && <p className="mt-3 pl-11 text-sm text-ink-500">{step.details}</p>}
        </li>
      ))}
    </ol>
  );
}
