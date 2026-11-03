import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

REG = "https://www.aliorbank.pl/dam/jcr:578b935a-b5e6-4328-80fe-73393486f9df/regulamin-promocji-szybki-bonus-dla-firm.pdf"
LP = "https://www.aliorbank.pl/wlasna-dzialalnosc/rachunki/ikonto-biznes.html"
TARYFA = "https://www.aliorbank.pl/dam/jcr:700e105b-bdde-4d9d-8f6e-0dd52e1dad2f/taryfa_oplat-i-prowizji-iKonto-Biznes.pdf"

steps = open_steps([
    "Między 1.11.2026 a 31.01.2027 zawrzyj z Alior Bankiem umowę ramową i złóż wniosek o iKonto Biznes (jednoosobowa działalność)",
    "Wyraź zgody marketingowe dla danych firmowych (e-mail, SMS/MMS, bankowość, telefon) i nie wycofuj ich do końca promocji",
])
steps += [
    {"order": 10, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "W pierwszym pełnym miesiącu po otwarciu konta: wpływy na konto firmowe min. 2000 zł (nie z Twoich kont w Aliorze)"},
    {"order": 11, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "W tym samym miesiącu: min. 1 przelew do ZUS z konta firmowego w bankowości internetowej lub mobilnej"},
    {"order": 12, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "Odbierz Bonus na start: 1000 zł (wypłata w pierwszych 15 dniach roboczych drugiego miesiąca po otwarciu)", "rewardCents": 100000},
]
for m in range(2, 7):
    base = m * 10
    label = f"Miesiąc {m}"
    steps += [
        {"order": base, "monthLabel": label, "title": "W tym miesiącu: wpływy na konto firmowe min. 2000 zł"},
        {"order": base + 1, "monthLabel": label, "title": "Płać kartą Mastercard z Plusem lub BLIK-iem (10% zwrotu, maks. 250 zł; pełny zwrot od 2500 zł płatności)"},
        {"order": base + 2, "monthLabel": label, "title": "Zrób min. 1 przelew do ZUS z konta firmowego (250 zł zwrotu)"},
        {"order": base + 3, "monthLabel": label, "title": "Odbierz Premię Moneyback: do 500 zł (do 250 zł za płatności + 250 zł za ZUS)", "rewardCents": 50000},
    ]

parts = [
    {"label": "Bonus na start — 1000 zł (wpływy 2000 zł + przelew do ZUS w pierwszym pełnym miesiącu)", "amountCents": 100000, "order": 0},
    {"label": "Moneyback za płatności kartą/BLIK — 10%, do 250 zł miesięcznie przez 5 miesięcy", "amountCents": 125000, "order": 1},
    {"label": "Moneyback za przelew do ZUS — 250 zł miesięcznie przez 5 miesięcy", "amountCents": 125000, "order": 2},
]

d = {
    "_comment": "Alior Bank — promocja „Szybki Bonus dla firm” (iKonto Biznes / 4x4), przystąpienie 1.11.2026–31.01.2027, regulamin z aliorbank.pl (odczyt 3.11.2026). Bonus na start 1000 zł w pierwszym pełnym miesiącu po otwarciu + Premia Moneyback przez 5 kolejnych miesięcy (od drugiego miesiąca po otwarciu): 10% płatności kartą z Plusem/BLIK maks. 250 zł + 250 zł za przelew do ZUS, przy wpływach min. 2000 zł. Opłaty: z poprzedniej promocji iKonto Biznes (taryfa od 1.04.2026). Kampanie: eBroker 13039 (450 zł CPS), Comperia 1068 (450,01 zł CPS).",
    "bankSlug": "alior",
    "ebrokerOid": "13039",
    "promotion": {
        "slug": "alior-szybki-bonus-dla-firm-ikonto-biznes",
        "name": "Szybki Bonus dla firm: do 3500 zł z iKontem Biznes",
        "accountType": "BUSINESS",
        "maxBonusCents": 350000, "difficulty": "MEDIUM", "rating": 9.0, "status": "DRAFT",
        "startDate": "2026-11-01", "endDate": "2027-01-31", "affiliateLinkEnabled": True,
        "sourceUrl": REG, "additionalSourceUrls": [LP],
        "lastVerifiedAt": "2026-11-03",
        "eligibleFor": "Jednoosobowa działalność gospodarcza (także wspólnik spółki cywilnej), która od 1.09.2025 do 31.10.2026 nie miała w Alior Banku żadnego rachunku dla przedsiębiorców ani karty debetowej do takiego rachunku.",
        "notEligibleFor": "Firmy, które między 1.09.2025 a 31.10.2026 miały w Alior Banku rachunek firmowy lub firmową kartę debetową. Spółki inne niż cywilna.",
        "cooldownMonths": None, "cooldownCutoffDate": "2025-09-01",
        "summary": "Do 3500 zł: 1000 zł na start za wpływy 2000 zł i przelew do ZUS w pierwszym pełnym miesiącu, potem przez 5 miesięcy do 500 zł miesięcznie (10% płatności kartą/BLIK do 250 zł + 250 zł za przelew do ZUS).",
        "conditions": [
            {"title": "Otwórz iKonto Biznes między 1.11.2026 a 31.01.2027", "description": "Zawrzyj umowę ramową i złóż wniosek o rachunek firmowy w okresie przystąpienia. Promocja dla JDG, które od 1.09.2025 do 31.10.2026 nie miały w Aliorze rachunku firmowego ani firmowej karty debetowej. Przez cały czas utrzymuj zgody marketingowe dla danych firmowych — bez nich bank nie wypłaci premii.", "type": "account_opening", "order": 0},
            {"title": "Bonus na start 1000 zł: wpływy min. 2000 zł i przelew do ZUS", "description": "W pierwszym pełnym miesiącu kalendarzowym po miesiącu otwarcia konta (np. konto w listopadzie – warunki w grudniu). Wpływy z Twoich własnych kont w Aliorze, zakończonych lokat i kredytów się nie liczą. Wypłata w pierwszych 15 dniach roboczych drugiego miesiąca po otwarciu.", "type": "inflow", "order": 1},
            {"title": "Premia Moneyback do 500 zł miesięcznie przez 5 miesięcy", "description": "Od drugiego miesiąca po miesiącu otwarcia, przez 5 kolejnych miesięcy: przy wpływach min. 2000 zł w miesiącu bank zwraca 10% płatności kartą Mastercard z Plusem lub BLIK-iem (maks. 250 zł) oraz 250 zł za przelew do ZUS zrobiony w tym miesiącu. Łącznie do 1250 + 1250 zł.", "type": "card_payments", "order": 2},
            {"title": "Nie zamykaj konta do wypłaty premii", "description": "W dniu wypłaty konto nie może być zamknięte ani przekształcone, umowa nie może być wypowiedziana, a firma nie może mieć zaległości wobec banku. Premia jest przychodem firmy do rozliczenia w podatku.", "type": "other", "order": 3},
        ],
        "bonusParts": parts,
        "fees": {
            "accountFeeCents": 0, "accountFeeWaiverCondition": None,
            "cardFeeCents": 800,
            "cardFeeWaiverCondition": "min. 4 transakcje bezgotówkowe w danym miesiącu (do 21:00 ostatniego dnia miesiąca, liczone osobno dla każdej karty)",
            "atmFeeCents": 0,
            "otherFee": "Prowadzenie rachunku podstawowego iKonto Biznes: 0 zł miesięcznie, bez warunków. Opłata za kartę dotyczy kart ze statusem „Aktywna”. Źródło: Tabela opłat i prowizji dla rachunku iKonto Biznes (od 1.04.2026).",
            "sourceUrl": TARYFA,
        },
    },
    "checklistSteps": steps,
}
write("data/candidates/alior-szybki-bonus-dla-firm.json", d)
