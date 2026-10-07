import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

steps = open_steps(
    [
        "Złóż jeden wniosek: rejestracja jednoosobowej działalności przez mBank i otwarcie mBiznes Konto Standard (01.09–30.11.2026)",
        "Wybierz kartę Mastercard Debit Business, Mastercard Business WOŚP lub WOŚP Mobilna",
        "Zaakceptuj oświadczenie o zapoznaniu się z regulaminem promocji",
        "W ciągu 30 dni od złożenia wniosku podpisz umowę o prowadzenie rachunku",
        "W ciągu 30 dni od zawarcia umowy zrób kartą transakcje bezgotówkowe na łączną kwotę min. 1000 zł (rozliczone, nieanulowane)",
    ],
    reward=("Odbierz premię 500 zł (do ostatniego dnia 2. miesiąca po miesiącu spełnienia warunków)", 50000),
)
steps += [
    {"order": 10, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "Co miesiąc: wykonaj przelew do ZUS albo miej wpływ min. 1000 zł — inaczej opłata za konto to 19 zł (przez 24 miesiące)"},
]

d = {
    "_comment": "mBank — „Załóż firmę i konto z płatnościami od mBanku – edycja 1” (mBiznes Konto Standard, 1.09–30.11.2026). Źródło: regulamin promocji + strona oferty. Dotyczy osób, które w dniu wniosku NIE prowadzą działalności (rejestracja firmy razem z kontem). Kampania eBroker 13227. Kampania 7871 (konto firmowe bez premii) pominięta.",
    "bankSlug": "mbank", "ebrokerOid": "13227",
    "promotion": {
        "slug": "mbank-zaloz-firme-i-konto-z-platnosciami-500-zl",
        "name": "Załóż firmę i konto w mBanku: 500 zł premii i pakiet płatności",
        "accountType": "BUSINESS", "maxBonusCents": 50000, "difficulty": "EASY", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-09-01", "endDate": "2026-11-30", "affiliateLinkEnabled": True,
        "sourceUrl": "https://www.mbank.pl/pdf/firmy/promocje/zaloz-firme-i-konto-z-platnosciami-od-mBanku-edycja-1-01-09-26-30-11-26.pdf",
        "additionalSourceUrls": ["https://www.mbank.pl/pdf/firmy/promocje/rozwijaj-firme-z-platnosciami-od-mBanku-edycja-1-01-09-26-30-11-26.pdf"],
        "lastVerifiedAt": "2026-10-07",
        "eligibleFor": "Osoby fizyczne, które w dniu składania wniosku nie prowadziły działalności gospodarczej i zakładają jednoosobową firmę razem z kontem mBiznes Konto Standard (rejestracja firmy przez mBank, jeden wniosek).",
        "notEligibleFor": "Osoby, które w dniu wniosku już prowadziły działalność gospodarczą oraz osoby, które już raz skorzystały z tej promocji. Wniosek o zmianę typu rachunku lub dodatkowe produkty (np. kredyt w rachunku) w trakcie promocji oznacza utratę warunków promocyjnych.",
        "cooldownMonths": None, "cooldownCutoffDate": None,
        "summary": "500 zł premii za otwarcie mBiznes Konta Standard z firmą (transakcje kartą na 1000 zł w 30 dni) oraz pakiet na 24 miesiące: 0 zł za konto przy przelewie do ZUS lub wpływie 1000 zł, darmowe przelewy i bankomaty, terminal POS i bramka Paynow z 0% prowizji do 200 tys. zł.",
        "conditions": [
            {"title": "Złóż jeden wniosek: rejestracja firmy i konto mBiznes Konto Standard", "description": "W okresie 1.09–30.11.2026 składasz jeden wniosek o rejestrację jednoosobowej działalności za pośrednictwem banku i otwarcie rachunku bieżącego. Akceptujesz oświadczenie o regulaminie promocji i w ciągu 30 dni od wniosku podpisujesz umowę o prowadzenie rachunku.", "type": "account_opening", "order": 0},
            {"title": "Wybierz kartę Mastercard Debit Business lub Business WOŚP", "description": "Karta musi być wybrana na wniosku promocyjnym: Mastercard Debit Business, Mastercard Business WOŚP albo Mastercard Business WOŚP Mobilna. Pierwsza karta ma 0 zł opłaty miesięcznej.", "type": "other", "order": 1},
            {"title": "Premia 500 zł: transakcje kartą na min. 1000 zł w 30 dni", "description": "W ciągu 30 dni od zawarcia umowy płacisz wybraną kartą bezgotówkowo (bez wypłat z bankomatów i cashback) na łączną kwotę min. 1000 zł; transakcje muszą być rozliczone i nieanulowane. Premia wpływa na rachunek do ostatniego dnia drugiego miesiąca po miesiącu spełnienia warunków.", "type": "card_payments", "order": 2},
            {"title": "Pakiet na 24 miesiące: 0 zł za konto przy przelewie do ZUS lub wpływie 1000 zł", "description": "W miesiącu bez przelewu do ZUS i bez wpływu min. 1000 zł opłata za prowadzenie rachunku to 19 zł. Darmowe przelewy w PLN, SEPA, SWIFT i SORBNET, 3 przelewy ekspresowe dziennie, wypłaty z bankomatów i BLIK, raport MT940. Po 24 miesiącach część korzyści zostaje (20 darmowych przelewów PLN/ekspresowych i 20 SEPA miesięcznie, pierwsza karta, MT940).", "type": "other", "order": 3},
            {"title": "Terminal POS, POSapp i Paynow z 0% prowizji do 200 tys. zł", "description": "Opcjonalnie: terminal POS lub aplikacja POSapp za 0 zł przez 24 miesiące i 0% prowizji od transakcji kartami VISA i Mastercard do 200 tys. zł brutto; bramka Paynow dla sklepu internetowego z 0% prowizji do 200 tys. zł obrotu. mKsięgowość za 1 zł netto miesięcznie przez 3 miesiące (pakiet Komfort lub START PK).", "type": "other", "order": 4},
        ],
        "bonusParts": [
            {"label": "Premia za otwarcie rachunku i transakcje kartą na min. 1000 zł — 500 zł", "amountCents": 50000, "order": 0},
        ],
        "fees": {
            "accountFeeCents": 1900,
            "accountFeeWaiverCondition": "w danym miesiącu przelew do ZUS na dowolną kwotę albo wpływ min. 1000 zł (przez pierwsze 24 miesiące i dalej)",
            "cardFeeCents": 0,
            "otherFee": "Pierwsza karta debetowa wybrana na wniosku promocyjnym: 0 zł opłaty miesięcznej (także po 24 miesiącach). Pozostałe usługi według Taryfy prowizji i opłat dla firm.",
            "sourceUrl": "https://www.mbank.pl/pdf/firmy/promocje/zaloz-firme-i-konto-z-platnosciami-od-mBanku-edycja-1-01-09-26-30-11-26.pdf",
        },
    },
    "checklistSteps": steps,
}
write("data/candidates/mbank-zaloz-firme-i-konto.json", d)
