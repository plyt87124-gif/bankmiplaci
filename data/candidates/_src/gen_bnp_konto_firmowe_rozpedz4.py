import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

# Link partnerski Comperii (kampania 1166) podawany jako argument: nie trzymamy go w kodzie generatora.
LINK = sys.argv[1] if len(sys.argv) > 1 else ""
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/candidates/bnp-konto-otwarte-na-biznes-rozpedz-swoj-biznes-4.json"
REG = "https://lp.bnpparibas.pl/rozpedzswojbiznes2/regulamin.pdf"
LP = "https://lp.bnpparibas.pl/rozpedzswojbiznes4"
FUEL = "Zapłać kartą Mastercard Business wydaną jako pierwsza do rachunku w PLN na stacjach paliw lub ładowania (MCC 5172, 5541, 5542, 5552, 5983). Moneyback 10% od transakcji, maks. 200 zł w miesiącu"

steps = open_steps([
    "W terminie 01.07–31.12.2026 otwórz rachunek Konto Otwarte na Biznes (PLN) wraz z kartą Mastercard Business, dostępem do bankowości internetowej i zgodami marketingowymi",
    "Przystąp do promocji, podpisując Regulamin Promocji w Oddziale BNP Paribas",
])
for m in range(1, 13):
    label = "Miesiąc 1 (po otwarciu konta)" if m == 1 else f"Miesiąc {m}"
    steps.append({"order": m * 10, "monthLabel": label, "title": FUEL})
    steps.append({"order": m * 10 + 1, "monthLabel": label, "title": "Odbierz moneyback za paliwo (do 200 zł; wypłata do 10. dnia kolejnego miesiąca)", "rewardCents": 20000})
steps.append({"order": 130, "monthLabel": "Kredyt lub leasing (opcjonalnie)", "title": "Złóż w Oddziale wniosek o kredyt (nieodnawialny obrotowy, w rachunku bieżącym, inwestycyjny) lub leasing; umowa w czasie promocji, uruchomienie do 30 dni po jej końcu"})
steps.append({"order": 131, "monthLabel": "Kredyt lub leasing (opcjonalnie)", "title": "Odbierz moneyback za kredyt/leasing: 100 zł za każde pełne 10 000 zł (maks. 2600 zł, wypłata do 60 dni od końca promocji)", "rewardCents": 260000})

parts = [
    {"label": "Moneyback 10% za płatności kartą na stacjach paliw: maks. 200 zł miesięcznie przez 12 miesięcy", "amountCents": 240000, "order": 0},
    {"label": "Moneyback za kredyt i/lub leasing w Oddziale: 100 zł za każde pełne 10 000 zł, maks. 2600 zł", "amountCents": 260000, "order": 1},
]
d = {
    "_comment": "BNP Paribas — „Rozpędź swój biznes – 4. edycja” (Konto Otwarte na Biznes). Źródło: regulamin promocji (01.07–31.12.2026). Kampania tylko w Comperii (id 1166), brak w eBroker; affiliateUrl = link partnerski Comperii. Opłaty z taryfy nie weryfikowane: pola null, do sprawdzenia. Przypis: wnioski o kredyt złożone przez pośredników finansowych nie są objęte moneybackiem.",
    "bankSlug": "bnp",
    "promotion": {
        "slug": "bnp-paribas-konto-otwarte-na-biznes-rozpedz-swoj-biznes-4-do-5000-zl",
        "name": "Rozpędź swój biznes (4. edycja): do 5000 zł z Kontem Otwartym na Biznes",
        "accountType": "BUSINESS", "maxBonusCents": 500000, "difficulty": "HARD", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-07-01", "endDate": "2026-12-31", "affiliateLinkEnabled": True,
        "affiliateUrl": LINK,
        "sourceUrl": REG, "additionalSourceUrls": [LP],
        "lastVerifiedAt": "2026-11-15",
        "eligibleFor": "Przedsiębiorcy (JDG, spółka cywilna, jawna, z o.o., partnerska, komandytowa, prosta spółka akcyjna) z przychodem netto ze sprzedaży za ostatni rok obrotowy poniżej 8 mln zł, którzy w okresie 01.07.2025–30.06.2026 nie mieli w BNP Paribas żadnego rachunku bieżącego w PLN.",
        "notEligibleFor": "Klienci, którzy w okresie 01.07.2025–30.06.2026 mieli w banku otwarty (lub w okresie wypowiedzenia) rachunek bieżący w PLN w jakimkolwiek planie. Zmiana planu taryfowego z Konta Otwartego na Biznes oznacza utratę warunków promocji. Wnioski o kredyt złożone przez pośredników finansowych nie są objęte promocją.",
        "cooldownMonths": None, "cooldownCutoffDate": "2025-07-01",
        "summary": "Do 5000 zł: 10% moneybacku na stacjach paliw (maks. 200 zł miesięcznie przez 12 miesięcy = 2400 zł) i do 2600 zł za kredyt lub leasing w Oddziale. 0 zł za konto i kartę przez 3 lata.",
        "conditions": [
            {"title": "Otwórz Konto Otwarte na Biznes z kartą i bankowością internetową, wyraź zgody marketingowe", "description": "Umowa ramowa w terminie promocji 01.07.2026–31.12.2026. Rachunek bieżący w PLN, karta Mastercard Business wydana jako pierwsza do rachunku.", "type": "account_opening", "order": 0},
            {"title": "Przystąp do promocji, podpisując Regulamin Promocji w Oddziale Banku", "description": "Podpis regulaminu promocji w Oddziale Banku jest warunkiem przystąpienia.", "type": "other", "order": 1},
            {"title": "Moneyback 10% za płatności kartą na stacjach paliw, maks. 200 zł miesięcznie przez 12 miesięcy", "description": "Liczą się tylko bezgotówkowe transakcje pierwszą kartą z rachunku w PLN na stacjach o kodach MCC 5172, 5541, 5542, 5552 i 5983 (paliwo, ładowanie), niezwrócone i niesporne. Wypłata do 10. dnia kolejnego miesiąca. Maksymalnie 2400 zł.", "type": "card_payments", "order": 2},
            {"title": "Kredyt lub leasing: 100 zł za każde pełne 10 000 zł (maks. 2600 zł)", "description": "Wniosek o kredyt lub leasing musi być złożony w Oddziale Banku (wnioski od pośredników nie są objęte promocją). Umowa w czasie promocji, uruchomienie do 30 dni po jej zakończeniu, wypłata do 60 dni od końca promocji. Zależne od zdolności kredytowej.", "type": "other", "order": 3},
            {"title": "Moneyback to przychód firmy", "description": "Wartość moneybacku zwiększa przychód firmy; podatek rozliczasz samodzielnie.", "type": "other", "order": 4},
        ],
        "bonusParts": parts,
        "fees": {
            "accountFeeCents": None, "cardFeeCents": None, "atmFeeCents": None,
            "accountFeeWaiverCondition": "0 zł przez 3 lata od zawarcia umowy ramowej dla uczestników promocji (po tym czasie opłaty z Taryfy Prowizji i Opłat). Stawki z taryfy: do sprawdzenia.",
            "cardFeeWaiverCondition": "0 zł przez 3 lata za pierwszą kartę wydaną do rachunku, bez warunków z taryfy. Stawka z taryfy: do sprawdzenia.",
            "otherFee": "Opłaty i prowizje poza wskazanymi: wg Taryfy Prowizji i Opłat dla klientów biznesowych (do sprawdzenia). 0% prowizji za udzielenie kredytu lub opłaty manipulacyjnej przy leasingu w promocji.",
            "sourceUrl": REG,
        },
    },
    "checklistSteps": steps,
}
write(OUT, d)
