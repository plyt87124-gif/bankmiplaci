import { z } from "zod";

// Cała treść ekranowa filmu w jednym miejscu — podmiana promocji = edycja tego obiektu
// (albo pól w panelu Props w Remotion Studio) + nowe nagranie lektora w timeline.ts.
// Stan sprawdzony 2026-10-04: regulamin „Alior Konto z Premią” (obowiązuje od 13.07.2026),
// strona produktu Alior Konto (stan na 13.07.2026), Taryfa od 1.06.2026.

export const promoSchema = z.object({
  hook: z.object({
    prefix: z.string(),
    amount: z.string(),
    subline: z.string(),
    footnote: z.string(),
  }),
  ring: z.object({
    title: z.string(),
    value: z.string(),
    note: z.string(),
    illustration: z.string(),
    check: z.string(),
  }),
  payout: z.object({
    product: z.string(),
    steps: z.array(z.object({ amount: z.string(), label: z.string(), detail: z.string() })),
    totalPrefix: z.string(),
    total: z.string(),
    note: z.string(),
  }),
  conditions: z.object({
    question: z.string(),
    header: z.string(),
    headerSub: z.string(),
    cards: z.array(z.object({ title: z.string(), detail: z.string() })),
    feeTitle: z.string(),
    feeNote: z.string(),
  }),
  form: z.object({
    title: z.string(),
    product: z.string(),
    codeLabel: z.string(),
    code: z.string(),
    consent: z.string(),
    consentNote: z.string(),
    illustration: z.string(),
  }),
  eligibility: z.object({
    title: z.string(),
    who: z.string(),
    deadline: z.string(),
    deadlineSub: z.string(),
    terms: z.string(),
  }),
  end: z.object({
    screenshot: z.string(),
    screenshotCssWidth: z.number(),
    scrollToCssY: z.number(),
    url: z.string(),
    cta: z.string(),
    small: z.string(),
  }),
});

export type Promo = z.infer<typeof promoSchema>;

export const ALIOR_2026_10: Promo = {
  hook: {
    prefix: "DO",
    amount: "800 ZŁ",
    subline: "I OBRĄCZKA DO PŁACENIA?",
    footnote: "*premia po spełnieniu warunków",
  },
  ring: {
    title: "OBRĄCZKA PŁATNICZA",
    value: "Nagroda rzeczowa o wartości 500 zł",
    note: "Tylko przy wniosku online • kod odbioru SMS-em, ważny 14 dni",
    illustration: "Ilustracja poglądowa",
    check: "SPRAWDŹMY.",
  },
  payout: {
    product: "ALIOR KONTO Z PREMIĄ",
    steps: [
      { amount: "200 zł", label: "na start", detail: "wniosek online z kodem" },
      { amount: "200 zł", label: "za pierwszy miesiąc aktywności", detail: "1. pełny miesiąc po otwarciu konta" },
      { amount: "4 × 100 zł", label: "za kolejne miesiące", detail: "po 100 zł za każdy miesiąc z aktywnością" },
    ],
    totalPrefix: "DO",
    total: "800 ZŁ",
    note: "Wypłaty w etapach, po spełnieniu warunków",
  },
  conditions: {
    question: "Co trzeba **zrobić?**",
    header: "CO MIESIĄC PRZEZ 5 MIESIĘCY",
    headerSub: "od miesiąca po otwarciu konta",
    cards: [
      { title: "3 płatności kartą/BLIKIEM", detail: "dowolna kwota" },
      { title: "Wpływ min. 1000 zł z innego banku", detail: "jednym przelewem, w każdym miesiącu" },
      { title: "Logowanie do Alior Mobile", detail: "co najmniej raz w miesiącu" },
    ],
    feeTitle: "Koszt karty",
    feeNote: "3 płatności dotyczą premii. Karta: 0 zł przy min. 5 płatnościach kartą/BLIKIEM w miesiącu, inaczej 7 zł/mies.",
  },
  form: {
    title: "Wniosek online",
    product: "Konto + karta online",
    codeLabel: "Kod promocji",
    code: "PREMIA2026",
    consent: "Wymagane zgody marketingowe",
    consentNote: "e-mail, SMS, telefon • nie cofaj ich do wypłaty nagród",
    illustration: "Ilustracja",
  },
  eligibility: {
    title: "OFERTA DLA NOWYCH KLIENTÓW",
    who: "18+ • Bez konta osobistego w Aliorze przez ostatnie 3 lata",
    deadline: "Umowa do 13.10.2026",
    deadlineSub: "lub do wcześniejszego wyczerpania nagród",
    terms: "Konto, kartę i zgody utrzymaj do wypłaty nagród. Nie liczą się m.in. płatności za transport, media i zakłady.",
  },
  end: {
    screenshot: "bmp01/page_full.png",
    screenshotCssWidth: 390, // zrzut 390 px CSS × DPR 3 (playwright, widok mobilny, bez logowania)
    scrollToCssY: 1830, // nagłówek „Co musisz zrobić?”
    url: "bankmiplaci.pl",
    cta: "SPRAWDŹ WARUNKI — LINK W BIO",
    // regulamin cz. 4 pkt 2 ppkt 1: w terminie trzeba ZAWRZEĆ umowę, samo złożenie wniosku nie wystarcza
    small: "Umowa do 13.10.2026 lub do wcześniejszego wyczerpania nagród",
  },
};
