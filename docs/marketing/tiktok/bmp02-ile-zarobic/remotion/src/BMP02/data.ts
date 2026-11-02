// Cała treść ekranowa odcinka. Liczby i warunki: pliki ofert w repozytorium (weryfikacja z regulaminami
// 7.10.2026, Alior II 18.10.2026, Millennium 360° 28.10.2026). PRZED PUBLIKACJĄ sprawdzić z aktualnymi regulaminami.
export type Effort = 1 | 2 | 3 | 4; // 1 Bardzo łatwa, 2 Łatwa, 3 Średnia, 4 Trudna

export type Offer = {
  bank: string;
  product: string;
  amount: number;
  extra?: string;
  effort: Effort;
  feeLine: string;
  deadline: string;
  deadlineUrgent?: boolean;
  lines: string[]; // warunki (kolejno podświetlane z lektorem)
  code?: string;
};

export const STAND_DATE = "1.11.2026";

export const HOOK = {
  prefix: "DO",
  amount: 2900,
  chips: ["4 konta", "1 pensja", "pół roku"],
  assumptionsTitle: "Założenia",
  assumptions: ["pensja min. 3 000 zł na jedno konto", "ok. 2 400 zł płatności kartą miesięcznie", "nie masz kont w tych bankach"],
};

export const OFFERS: Offer[] = [
  {
    bank: "Millennium",
    product: "Konto Millennium 360°",
    amount: 800,
    effort: 3,
    feeLine: "Bez opłat za prowadzenie",
    deadline: "Wniosek do 18.02.2027",
    lines: ["Tu wpływa pensja (min. 3 000 zł)", "Płatności kartą min. 1 000 zł/mies.", "Na start: 5 płatności telefonem w 14 dni"],
  },
  {
    bank: "Alior Bank",
    product: "Alior Konto z premią II",
    amount: 800,
    extra: "+ obrączka płatnicza (nagroda rzeczowa)",
    effort: 2,
    feeLine: "Bez opłat za prowadzenie",
    deadline: "Wniosek do 11.01.2027",
    lines: ["5 płatności kartą (3 do premii, 5 — karta za 0 zł)", "Przelew min. 1 000 zł z innego banku", "Logowanie do aplikacji"],
    code: "PREMIA800",
  },
  {
    bank: "Erste",
    product: "Konto Smart",
    amount: 700,
    effort: 3,
    feeLine: "0 zł opłat przy płatnościach min. 300 zł/mies.",
    deadline: "Wniosek tylko do 30.11.2026",
    deadlineUrgent: true,
    lines: ["3 miesiące: wpływ 1 000 zł i 7 płatności", "Cel w „Moje Cele” i logowanie", "Tylko „Załóż konto” online"],
  },
  {
    bank: "PKO Bank Polski",
    product: "PKO Konto za Zero",
    amount: 600,
    effort: 2,
    feeLine: "Bez opłat za prowadzenie",
    deadline: "Wniosek do 31.12.2026",
    lines: ["10% zwrotu za płatności kartą", "do 100 zł/mies. przez 5 miesięcy", "+ 100 zł za komplet"],
    code: "PROSTO",
  },
];

// Wypłaty najpóźniej do końca miesiąca, przy otwarciu wszystkich kont w listopadzie 2026
export const PAYOUTS: { month: string; amount: number }[] = [
  { month: "gru", amount: 400 },
  { month: "sty", amount: 500 },
  { month: "lut", amount: 400 },
  { month: "mar", amount: 500 },
  { month: "kwi", amount: 200 },
  { month: "maj", amount: 300 },
  { month: "cze", amount: 600 },
];

export const CATCH = { title: "HACZYK?", sub: "Co miesiąc warunki w 4 bankach", months: ["gru", "sty", "lut", "mar", "kwi", "maj"] };

export const END = {
  cardTitle: "Plan: 4 konta, do 2 900 zł",
  cardRows: ["Millennium 360° — pensja i 1 000 zł kartą", "Alior — 5 płatności, przelew 1 000 zł", "Erste — wniosek do 30.11", "PKO — 10% zwrotu, kod PROSTO"],
  url: "bankmiplaci.pl",
  cta: "Plan krok po kroku — link w bio",
  small: `Stan na ${STAND_DATE} · konta otwarte w listopadzie · wypłaty do 30.06.2027 · nagrody po spełnieniu warunków z regulaminów banków`,
  adTag: "REKLAMA",
};
