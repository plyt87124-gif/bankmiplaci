import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bonusFromName,
  commissionDeadline,
  commissionEligibility,
  describeNewClientRule,
  groupOffSiteItems,
  isAccountCampaign,
  normalizeBank,
  parseNewClientRule,
  promoRestrictions,
  suggestPromotions
} from "../src/lib/affiliateRules";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

test("Alior: dwa lata bez konta to okno 24 miesięcy", () => {
  const r = parseNewClientRule("nowego klienta, rozumianego jako osobę która w ciągu ostatnich dwóch lat od momentu złożenia wniosku nie posiadała rachunku osobistego w Alior Banku.");
  assert.deepEqual(r, { kind: "months", months: 24 });
  assert.equal(describeNewClientRule(r), "brak konta w banku przez 2 lata");
});

test("BNP 12 i 24 poprzedzających miesięcy", () => {
  assert.deepEqual(parseNewClientRule("nowego Klienta, który na dzień podpisania umowy nie posiadał konta BNP Paribas w ciągu 12 poprzedzających miesięcy."), { kind: "months", months: 12 });
  assert.deepEqual(parseNewClientRule("nie posiadał konta BNP Paribas w ciągu 24 poprzedzających miesięcy."), { kind: "months", months: 24 });
});

test("Erste: 12 miesięcy przed złożeniem wniosku", () => {
  assert.deepEqual(parseNewClientRule("nowego klienta banku, który nie posiadał żadnego produktu w okresie 12 miesięcy przed złożeniem wniosku."), { kind: "months", months: 12 });
});

test("mBank: stała data od 01.01.2023", () => {
  const r = parseNewClientRule("nowych klientów banku, rozumianych jako osoby które, od 01.01.2023 r. nie były i nadal nie są posiadaczami konta w mBanku.");
  assert.deepEqual(r, { kind: "since", date: d("2023-01-01") });
});

test("data słowna: od 6 października 2025", () => {
  const r = parseNewClientRule("Nowy klient (który nie posiadał jakiegokolwiek produktu w UniCredit od 6 października 2025 r.");
  assert.deepEqual(r, { kind: "since", date: d("2025-10-06") });
});

test("Revolut: nigdy nie posiadali konta", () => {
  assert.deepEqual(parseNewClientRule("tylko za nowych klientów, którzy nigdy nie posiadali konta Revolut"), { kind: "never" });
});

test("terminy bez związku z historią klienta nie dają reguły", () => {
  assert.equal(parseNewClientRule("w ciągu 30 dni od podpisania umowy wykona min. trzy płatności. Oferta ważna do 04.11.2026 r."), null);
  assert.equal(parseNewClientRule("Weryfikacja będzie prowadzona raz w m-cu, przez okres w ciągu (3) miesięcy."), null);
  assert.equal(parseNewClientRule(null), null);
});

test("prowizja: okno 2 lat liczone od zamknięcia konta, premia ma własną datę", () => {
  const rule = { kind: "months", months: 24 } as const;
  const hist = { hasRow: true, wasClientFrom: d("2015-01-01"), wasClientUntil: d("2025-06-01"), currentClient: false };
  const r = commissionEligibility(rule, hist, null, d("2026-11-02"));
  assert.equal(r.status, "no");
  assert.equal(r.from?.toISOString().slice(0, 10), "2027-06-01");
  const ok = commissionEligibility(rule, { ...hist, wasClientUntil: d("2024-01-01") }, null, d("2026-11-02"));
  assert.equal(ok.status, "yes");
});

test("prowizja: stała data - zamknięcie przed datą daje tak, po dacie nie", () => {
  const rule = { kind: "since", date: d("2023-01-01") } as const;
  const hist = { hasRow: true, wasClientFrom: d("2010-01-01"), currentClient: false };
  assert.equal(commissionEligibility(rule, { ...hist, wasClientUntil: d("2022-05-01") }, null, d("2026-11-02")).status, "yes");
  assert.equal(commissionEligibility(rule, { ...hist, wasClientUntil: d("2024-05-01") }, null, d("2026-11-02")).status, "no");
});

test("prowizja: zakaz wniosków własnych, obecny klient, brak danych", () => {
  const rule = { kind: "months", months: 12 } as const;
  assert.equal(commissionEligibility(rule, null, false).status, "no");
  assert.equal(commissionEligibility(rule, { hasRow: true, wasClientFrom: d("2020-01-01"), currentClient: true }, null).status, "no");
  assert.equal(commissionEligibility(rule, null, null).status, "unknown");
  assert.equal(commissionEligibility(null, null, null).status, "unknown");
});

test("dopasowanie: Millennium Mój Biznes 5000 do promocji 6000, z ostrzeżeniem o kwocie", () => {
  const promos = [
    { id: "p1", name: "Konto Mój Biznes: bonus do 6000 zł", bankName: "Millennium", accountType: "BUSINESS", status: "ACTIVE", maxBonusCents: 600000 },
    { id: "p2", name: "Konto 360 do 800 zł", bankName: "Millennium", accountType: "PERSONAL", status: "ACTIVE", maxBonusCents: 80000 },
    { id: "p3", name: "Stara", bankName: "Millennium", accountType: "BUSINESS", status: "EXPIRED", maxBonusCents: 500000 }
  ];
  const m = suggestPromotions({ bankName: "Bank Millennium", name: "Konto Mój Biznes - do 5000 zł", category: "dla firm konta firmowe" }, promos);
  assert.equal(m.length, 1);
  assert.equal(m[0]!.promotion.id, "p1");
  assert.deepEqual(m[0]!.amountMismatch, { campaignCents: 500000, promotionCents: 600000 });
});

test("nazwy banków z paneli sprowadzają się do jednego", () => {
  assert.equal(normalizeBank("mBank dla firm"), normalizeBank("mBank"));
  assert.equal(normalizeBank("PEKAO S.A"), normalizeBank("Bank Pekao"));
  assert.equal(normalizeBank("Bank Credit Agricole"), normalizeBank("Credit Agricole"));
  assert.equal(bonusFromName("Konto Biznes z Żubrem - zyskaj do 5000 zł"), 500000);
});

test("termin prowizji: najpóźniejszy z terminów w warunkach, liczony od dnia otwarcia", () => {
  const open = d("2026-11-03");
  const alior = commissionDeadline(
    "w ciągu 30 dni od wysłania Wniosku podpisze umowę i w ciągu 30 dni od podpisania umowy wykona min. trzy płatności kartą. Nowy klient: w ciągu ostatnich dwóch lat.",
    open
  );
  assert.equal(alior?.date.toISOString().slice(0, 10), "2026-12-03");
  assert.equal(commissionDeadline("transakcje na 200 zł najpóźniej do końca pierwszego pełnego miesiąca kalendarzowego po otwarciu rachunku", open)?.date.toISOString().slice(0, 10), "2026-12-31");
  assert.equal(commissionDeadline("co najmniej jedna transakcja w miesiącu otwarcia rachunku lub w jednym z dwóch pierwszych miesięcy po otwarciu rachunku", open)?.date.toISOString().slice(0, 10), "2027-01-31");
  assert.equal(commissionDeadline("6 transakcji w ciągu 60 dni od momentu otwarcia konta. Konto musi pozostać otwarte przez min. 60 dni.", open)?.date.toISOString().slice(0, 10), "2027-01-02");
  assert.equal(commissionDeadline("jednej transakcji kartą lub BLIKiem w ciągu miesiąca od daty otwarcia konta", open)?.date.toISOString().slice(0, 10), "2026-12-03");
});

test("termin prowizji: okno nowego klienta to nie termin, a sama umowa nie ma terminu", () => {
  const open = d("2026-11-03");
  assert.equal(commissionDeadline("nie posiadał konta BNP Paribas w ciągu 12 poprzedzających miesięcy", open), null);
  assert.equal(commissionDeadline("Wynagrodzenie przyznane będzie za sprzedaż konta, czyli podpisanie umowy przez klienta.", open), null);
});

test("zakazy promowania z opisu kampanii", () => {
  const erste =
    "Całkowicie zakazane są działania w wyszukiwarkach internetowych (SEM) polegające na używaniu nazwy banku jako słów kluczowych. Zakazane jest tworzenie i wykorzystywanie własnych kreacji graficznych.";
  assert.deepEqual(
    promoRestrictions(erste).map((r) => r.key),
    ["sem", "brand", "creatives"]
  );
  const alior =
    "Z jednego adresu IP może zostać złożony tylko jeden, unikalny wniosek. Zakaz wysyłania wniosków w imieniu klienta. We wszystkich kampaniach na rzecz Alior Banku panuje bezwzględny zakaz stosowania mailingów.";
  assert.deepEqual(
    promoRestrictions(alior).map((r) => r.key),
    ["mailing", "onBehalf", "ip"]
  );
  assert.deepEqual(
    promoRestrictions("Obowiązuje zakaz wykorzystywania skracaczy linków.").map((r) => r.key),
    ["shortener"]
  );
  assert.deepEqual(promoRestrictions(null), []);
});

test("to samo konto z dwóch sieci to jeden wiersz", () => {
  const items = [
    { network: "COMPERIA", bankName: "Erste", name: "ERSTE - Konto FIRMOWE ONLINE", category: "konto firmowe" },
    { network: "EBROKER", bankName: "Erste", name: "Konto Firmowe", category: "konto firmowe" },
    { network: "EBROKER", bankName: "VeloBank", name: "VeloKonto", category: "konto osobiste" },
    { network: "EBROKER", bankName: "VeloBank", name: "VeloKonto Gold - 5% na lokatach do 420 tys. zł", category: "konto osobiste" },
    { network: "EBROKER", bankName: "VeloBank", name: "VeloKonto dla młodych", category: "konto osobiste" },
    { network: "COMPERIA", bankName: "VeloBank", name: "Velo Bank - VeloKonto dla Młodych", category: "konto osobiste" },
    { network: "COMPERIA", bankName: "VeloBank", name: "Velo Bank - VeloKonto Firma", category: "konto firmowe" },
    { network: "EBROKER", bankName: "VeloBank", name: "VeloKonto Firma", category: "konto firmowe" },
    { network: "EBROKER", bankName: "PEKAO S.A", name: "Konto Przekorzystne - zyskaj do 300 zł", category: "konto osobiste" },
    { network: "EBROKER", bankName: "PEKAO S.A", name: "Konto Przekorzystne - zyskaj do 300 zł", category: "konto osobiste" },
    { network: "COMPERIA", bankName: "PEKAO S.A", name: "Pekao S.A. - Konto osobiste z bonusem", category: "konto osobiste" }
  ];
  const groups = groupOffSiteItems(items).map((g) => g.map((x) => `${x.network}:${x.name}`));
  assert.deepEqual(groups, [
    ["COMPERIA:ERSTE - Konto FIRMOWE ONLINE", "EBROKER:Konto Firmowe"],
    ["EBROKER:VeloKonto"],
    ["EBROKER:VeloKonto Gold - 5% na lokatach do 420 tys. zł"],
    ["EBROKER:VeloKonto dla młodych", "COMPERIA:Velo Bank - VeloKonto dla Młodych"],
    ["COMPERIA:Velo Bank - VeloKonto Firma", "EBROKER:VeloKonto Firma"],
    [
      "EBROKER:Konto Przekorzystne - zyskaj do 300 zł",
      "EBROKER:Konto Przekorzystne - zyskaj do 300 zł",
      "COMPERIA:Pekao S.A. - Konto osobiste z bonusem"
    ]
  ]);
});

test("panel prowizji: tylko konta osobiste i firmowe, bez lokat i oszczędności", () => {
  assert.equal(isAccountCampaign({ name: "VeloKonto Firma", category: "konto firmowe" }), true);
  assert.equal(isAccountCampaign({ name: "Konto Przekorzystne - zyskaj do 300 zł", category: "konto osobiste" }), true);
  assert.equal(isAccountCampaign({ name: "VeloKonto Gold - 5% na lokatach do 420 tys. zł", category: "konto osobiste" }), false);
  assert.equal(isAccountCampaign({ name: "Santander Consumer Bank - Rachunek oszczędnościowy", category: "konto oszczędnościowe" }), false);
  assert.equal(isAccountCampaign({ name: "eKonto standard - nawet 1010 zł oraz 5,3% w skali roku na oszczędnościach", category: "konto osobiste" }), true);
});

test("prowizja: obecny klient albo konto jeszcze otwarte to nie, także gdy panel nie podaje okna", () => {
  const now = d("2026-11-03");
  assert.equal(commissionEligibility(null, { hasRow: true, wasClientFrom: d("2026-10-19"), currentClient: true }, null, now).status, "no");
  const open = commissionEligibility(null, { hasRow: true, wasClientUntil: d("2026-11-11"), currentClient: false }, null, now);
  assert.equal(open.status, "no");
  assert.equal(open.text, "konto jeszcze otwarte do 11.11.2026");
  assert.equal(commissionEligibility(null, { hasRow: true, wasClientUntil: d("2024-11-11"), currentClient: false }, null, now).status, "unknown");
});
