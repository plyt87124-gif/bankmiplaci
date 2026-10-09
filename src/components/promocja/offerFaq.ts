/**
 * FAQ of one offer, generated from the offer's own database fields
 * (docs/redesign-v2/03-content-and-seo-plan.md; layout-spec: 4-6 questions,
 * "brak danych -> sprawdź regulamin banku").
 *
 * Rules:
 *  - every number, date and condition comes from the arguments; when a field is
 *    empty the answer says so and sends the reader to the bank's regulation;
 *  - no relative time ("zostało 5 dni"): the FAQ is also written to the FAQPage
 *    JSON-LD and may be cached, so it states dates, not countdowns;
 *  - plain text only (the same string is rendered and put into the JSON-LD).
 */
import type { FaqAccordionItem } from "@/components/FaqAccordion";
import { formatDatePL, formatPLN } from "@/lib/format";
import {
  COOLDOWN_EXPLAINER,
  cooldownSentences,
  describeFee,
  feeFaqText,
  splitLines,
  type CooldownRule
} from "./offerModel";

export interface OfferFaqInput {
  name: string;
  bankName: string;
  maxBonusCents: number;
  /** Bonus parts a NEW participant can still join (already filtered). */
  bonusParts: readonly { label: string; amountCents: number }[];
  /** Conditions in their display order. */
  conditions: readonly { title: string }[];
  endDate: Date | string;
  /** The whole last sign-up day is over. */
  ended: boolean;
  cooldown: CooldownRule | null;
  eligibleFor: string | null;
  fees: {
    accountFeeCents: number | null;
    accountFeeWaiverCondition: string | null;
    cardFeeCents: number | null;
    cardFeeWaiverCondition: string | null;
  } | null;
  lastVerifiedAt: Date | string | null;
  /** Where "Jak liczymy ocenę" / "Co znaczy Zweryfikowano" lead (methodology page or its fallback). */
  verificationHref: string;
}

const NO_DATA_TAIL = "Sprawdź to w regulaminie banku.";

function stripTrailingPunctuation(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.;,:\s]+$/, "");
}

function questionBonus(input: OfferFaqInput): FaqAccordionItem {
  const question = `Ile można zyskać w promocji „${input.name}”?`;
  if (input.maxBonusCents <= 0) {
    return {
      question,
      answer:
        "Ta oferta nie ma premii gotówkowej – korzyść opisują warunki promocji (sekcja „Warunki promocji” wyżej). " +
        NO_DATA_TAIL
    };
  }
  const parts =
    input.bonusParts.length > 1
      ? ` Części premii: ${input.bonusParts.map((p) => `${stripTrailingPunctuation(p.label)} – ${formatPLN(p.amountCents)}`).join("; ")}.`
      : "";
  return {
    question,
    answer:
      `Maksymalnie ${formatPLN(input.maxBonusCents)}.${parts} To kwota maksymalna: nie jest gwarantowana ` +
      "i przysługuje po spełnieniu wszystkich warunków z regulaminu banku."
  };
}

function questionSteps(input: OfferFaqInput): FaqAccordionItem {
  const question = "Co trzeba zrobić, żeby dostać premię?";
  const titles = input.conditions.map((c) => stripTrailingPunctuation(c.title)).filter(Boolean);
  if (titles.length === 0) {
    return { question, answer: `Nie mamy jeszcze rozpisanych warunków tej promocji. ${NO_DATA_TAIL}` };
  }
  const steps = titles.map((title, index) => `${index + 1}) ${title}`).join("; ");
  return {
    question,
    answer: `Według regulaminu: ${steps}. Opisy kroków znajdziesz w sekcji „Warunki promocji”.`
  };
}

function questionDeadline(input: OfferFaqInput): FaqAccordionItem {
  const date = formatDatePL(input.endDate);
  if (input.ended) {
    return {
      question: "Czy ta promocja jeszcze trwa?",
      answer: date
        ? `Nie, zapisy zakończyły się ${date}. Aktualne promocje tego banku znajdziesz niżej na tej stronie.`
        : `Nie, ta promocja się zakończyła. ${NO_DATA_TAIL}`
    };
  }
  return {
    question: "Do kiedy można skorzystać z promocji?",
    answer: date
      ? `Do ${date} – to ostatni dzień zapisów według regulaminu banku. Przed założeniem konta sprawdź w regulaminie, czy promocja nie została zakończona wcześniej.`
      : `Nie mamy zweryfikowanego terminu zapisów. ${NO_DATA_TAIL}`
  };
}

function questionEligibility(input: OfferFaqInput): FaqAccordionItem {
  const question = "Czy mogę skorzystać, jeśli miałem(-am) już konto w tym banku?";
  if (input.cooldown) {
    const sentences = cooldownSentences(input.cooldown, input.bankName).join(" ");
    const explainer = input.cooldown.months !== null && input.cooldown.months > 0 ? ` ${COOLDOWN_EXPLAINER}` : "";
    return {
      question,
      answer: `${sentences}${explainer} Zawsze sprawdź pełne warunki uczestnictwa w regulaminie banku.`
    };
  }
  const who = splitLines(input.eligibleFor).join(" ");
  return {
    question,
    answer:
      "W naszych danych nie ma informacji o karencji ani dacie granicznej dla tej promocji." +
      (who ? ` Kto może skorzystać: ${who}` : "") +
      ` ${NO_DATA_TAIL}`
  };
}

function questionCost(input: OfferFaqInput): FaqAccordionItem {
  const question = "Ile kosztuje konto w tej promocji?";
  const account = describeFee(input.fees?.accountFeeCents, input.fees?.accountFeeWaiverCondition);
  const card = describeFee(input.fees?.cardFeeCents, input.fees?.cardFeeWaiverCondition);
  return {
    question,
    answer:
      `Opłata za konto: ${feeFaqText(account)}. Opłata za kartę: ${feeFaqText(card)}. ` +
      "Warunki zwolnienia z opłat i inne opłaty opisujemy w sekcji „Opłaty za konto i kartę”."
  };
}

function questionSource(input: OfferFaqInput): FaqAccordionItem {
  const verified = formatDatePL(input.lastVerifiedAt ?? "");
  return {
    question: "Skąd mamy te informacje i jak są aktualne?",
    answer:
      "Warunki spisujemy z regulaminu promocji na stronie banku." +
      (verified ? ` Ostatnia weryfikacja: ${verified}.` : " Nie mamy zapisanej daty ostatniej weryfikacji.") +
      " Warunki może jednak zmienić bank – przed założeniem konta zawsze sprawdź aktualny regulamin.",
    link: { href: input.verificationHref, label: "Co znaczy „Zweryfikowano”?" }
  };
}

/** Six questions, each with an answer built only from the arguments. */
export function buildOfferFaq(input: OfferFaqInput): FaqAccordionItem[] {
  return [
    questionBonus(input),
    questionSteps(input),
    questionDeadline(input),
    questionEligibility(input),
    questionCost(input),
    questionSource(input)
  ];
}
