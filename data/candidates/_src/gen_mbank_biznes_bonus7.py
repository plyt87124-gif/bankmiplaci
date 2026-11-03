import json
import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

REG = "https://bonus.ebrokerpartner.pl/strona/regulamin-mbank-firmowe-edycja7"
LP = "https://bonus.ebrokerpartner.pl/akcja/mbank-firmowe-edycja7/"
base = json.load(open("data/candidates/mbank-zaloz-firme-i-konto.json", encoding="utf-8"))
bp = base["promotion"]

steps = open_steps([
    "Zarejestruj Profil Uczestnika w Bonus eBrokerPartner i zaakceptuj regulamin akcji oraz zgodę na ujawnienie tajemnicy bankowej",
    "Do 16.11.2026 złóż przez Stronę Akcji wniosek o mBiznes Konto Standard z kartą Mastercard Debit Business / Business WOŚP / WOŚP Mobilna (lub wniosek o rejestrację firmy przez mBank)",
    "Zawrzyj umowę o konto w 30 dni od wniosku, najpóźniej do 16.12.2026",
])
steps += [
    {"order": 10, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "Od dnia umowy do końca pierwszego pełnego miesiąca po jej zawarciu wykonaj min. 1 transakcję kartą Mastercard (nie BLIK)"},
    {"order": 11, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "Odbierz pierwszą część bonusu: 500 zł", "rewardCents": 50000},
    {"order": 20, "monthLabel": "Miesiąc 2", "title": "W drugim pełnym miesiącu po miesiącu zawarcia umowy wykonaj min. 3 transakcje kartą Mastercard"},
    {"order": 21, "monthLabel": "Miesiąc 2", "title": "Odbierz drugą część bonusu: 500 zł (wypłata do 23.04.2027; w e-mailu do 5.04.2027 wskaż numer konta w Profilu Uczestnika do 12.04.2027)", "rewardCents": 50000},
]
parts = [
    {"label": "Bonus część 1 — 500 zł (1 transakcja kartą w pierwszym pełnym miesiącu)", "amountCents": 50000, "order": 0},
    {"label": "Bonus część 2 — 500 zł (3 transakcje kartą w drugim pełnym miesiącu)", "amountCents": 50000, "order": 1},
]
d = {
    "_comment": "mBank dla firm — akcja „Konto firmowe mBiznes z BONUSEM – edycja 7” organizowana przez Rankomat.pl (serwis Bonus eBrokerPartner) z mBankiem: 2 × 500 zł (przystąpienie 1.09–16.11.2026, umowa do 16.12.2026, wypłata do 23.04.2027). Wniosek WYŁĄCZNIE przez Stronę Akcji. Dodatkowa, osobna promocja banku (do 500 zł premii za transakcje na 1000 zł w 30 dni) jest opisana w kandydacie mbank-zaloz-firme-i-konto i NIE wlicza się do kwoty. Opłata za konto 19 zł bez zwolnienia — wg istniejącego kandydata mBiznes Konto Standard (regulamin banku); nie weryfikowane ponownie dla firm starszych niż 12 miesięcy. Kampania eBroker 13868.",
    "bankSlug": base["bankSlug"], "ebrokerOid": "13868",
    "promotion": {
        "slug": "mbank-biznes-konto-standard-bonus-ebroker-edycja-7",
        "name": "mBiznes Konto Standard z bonusem 1000 zł (edycja 7)",
        "accountType": bp["accountType"],
        "maxBonusCents": 100000, "difficulty": "EASY", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-09-01", "endDate": "2026-11-16", "affiliateLinkEnabled": True,
        "sourceUrl": REG, "additionalSourceUrls": [LP],
        "lastVerifiedAt": "2026-10-24",
        "eligibleFor": "Pełnoletnie osoby fizyczne z miejscem zamieszkania w Polsce, które prowadzą działalność gospodarczą w Polsce albo rejestrują jednoosobową firmę przez mBank razem z kontem. W ciągu 12 miesięcy przed wnioskiem nie miały w mBanku konta firmowego przypisanego do tego samego NIP (dla innego NIP można przystąpić).",
        "notEligibleFor": "Osoby, które w ostatnich 12 miesiącach miały w mBanku konto firmowe na ten sam NIP. Wniosek złożony poza Stroną Akcji lub karta wybrana poza wnioskiem o konto — bez bonusu. Rozwiązanie umowy lub rezygnacja z akcji przed wypłatą — utrata bonusu.",
        "cooldownMonths": 12, "cooldownCutoffDate": None,
        "summary": "1000 zł (2 × 500 zł) za mBiznes Konto Standard z kartą Mastercard: 1 transakcja w pierwszym i 3 transakcje w drugim pełnym miesiącu. Wniosek tylko przez Stronę Akcji do 16.11.2026.",
        "conditions": [
            {"title": "Złóż wniosek o mBiznes Konto Standard przez Stronę Akcji do 16.11.2026", "description": "Wymagany Profil Uczestnika w Bonus eBrokerPartner, akceptacja regulaminu akcji i zgoda na ujawnienie tajemnicy bankowej. Kartę (Mastercard Debit Business, Business WOŚP lub WOŚP Mobilna) wybierasz wyłącznie we wniosku o konto lub rejestrację firmy. Umowa w 30 dni od wniosku, najpóźniej do 16.12.2026.", "type": "account_opening", "order": 0},
            {"title": "Część 1 (500 zł): min. 1 transakcja kartą Mastercard w pierwszym pełnym miesiącu", "description": "Od dnia zawarcia umowy do końca pierwszego pełnego miesiąca kalendarzowego po miesiącu zawarcia umowy. BLIK i przelewy nie są transakcjami kartą.", "type": "card_payments", "order": 1},
            {"title": "Część 2 (500 zł): min. 3 transakcje kartą w drugim pełnym miesiącu", "description": "W drugim pełnym miesiącu kalendarzowym po miesiącu zawarcia umowy (np. umowa we wrześniu 2026 – listopad 2026). Wypłata tylko po spełnieniu warunku części 1.", "type": "card_payments", "order": 2},
            {"title": "Wypłata do 23.04.2027: wskaż numer konta w Profilu Uczestnika do 12.04.2027", "description": "Rankomat wyśle e-mail do 5.04.2027 z linkiem do formularza; brak wypełnienia formularza do 12.04.2027 oznacza utratę bonusu. Konto musi być otwarte w akcji i utrzymane do wypłaty, a zgoda na ujawnienie tajemnicy bankowej ważna do końca akcji.", "type": "deadline", "order": 3},
        ],
        "bonusParts": parts,
        "fees": dict(bp["fees"], sourceUrl=bp["fees"]["sourceUrl"]),
    },
    "checklistSteps": steps,
}
write("data/candidates/mbank-biznes-konto-standard-bonus-ebroker-edycja-7.json", d)
