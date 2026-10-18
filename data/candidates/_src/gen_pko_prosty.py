import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

SRC = "https://www.pkobp.pl/api/public/8ff7445c-099e-4885-ba7a-a73cb5ecc16b.pdf"

steps = open_steps([
    "Otwórz online PKO Konto za Zero z kartą Visa (lub PKO Konto dla Młodych 18–25 lat) w okresie 1.10–31.12.2026",
    "We wniosku wpisz kod promocji PROSTO i wyraź zgodę na marketing elektroniczny banku",
    "Opcjonalnie: otwórz online konto dla swojego dziecka (PKO Konto Dziecka / dla Młodych), wpisz kod PROSTO i wyraź zgodę na marketing",
])
for m in range(1, 6):
    base = m * 10
    lbl = "Miesiąc 1 (po otwarciu konta)" if m == 1 else f"Miesiąc {m}"
    steps += [
        {"order": base, "monthLabel": lbl, "title": "Zaloguj się min. 1 raz do aplikacji mobilnej banku"},
        {"order": base + 1, "monthLabel": lbl, "title": "Zrób min. 1 transakcję bezgotówkową kartą (bez BLIK, bez wypłat) — 10% jej wartości wraca na konto"},
        {"order": base + 2, "monthLabel": lbl, "title": "Odbierz nagrodę I: 10% transakcji kartą, do 100 zł (do końca następnego miesiąca)", "rewardCents": 10000},
    ]
    if m <= 3:
        steps += [
            {"order": base + 3, "monthLabel": lbl, "title": "Opcjonalnie (konto dziecka): zasil konto dziecka min. 100 zł i zrób min. 10 transakcji kartą dziecka lub swoją"},
            {"order": base + 4, "monthLabel": lbl, "title": "Opcjonalnie (konto dziecka): odbierz nagrodę 100 zł za miesiąc", "rewardCents": 10000},
        ]
steps.append({"order": 53, "monthLabel": "Miesiąc 5", "title": "Odbierz nagrodę II: 100 zł (jeśli nagrodę I dostałeś(aś) we wszystkich 5 miesiącach)", "rewardCents": 10000})

d = {
    "_comment": "PKO BP — „Prosty zwrot” (kod PROSTO, przystąpienie 1.10–31.12.2026 lub do 12 000 kont). Źródło: regulamin promocji + strona oferty. Kampania eBroker 8629. Następca promocji „Letni bonus do 900 zł” (do 30.09.2026).",
    "bankSlug": "pko", "ebrokerOid": "8629",
    "promotion": {
        "slug": "pko-konto-za-zero-prosty-zwrot-do-900-zl",
        "name": "PKO Konto za Zero: Prosty zwrot — do 900 zł (kod PROSTO)",
        "accountType": "PERSONAL", "maxBonusCents": 90000, "difficulty": "EASY", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-10-01", "endDate": "2026-12-31", "affiliateLinkEnabled": True,
        "sourceUrl": SRC,
        "additionalSourceUrls": ["https://www.pkobp.pl/k/k/900-pp"],
        "lastVerifiedAt": "2026-10-07",
        "eligibleFor": "Osoby fizyczne (konsumenci) z adresem w Polsce, które od 1.04.2025 do 30.09.2026 nie miały w PKO Banku Polskim rachunku oszczędnościowo-rozliczeniowego w złotych (poza kontami Inteligo). Konto otwierasz online. Dla dziecka: dziecko też nie mogło mieć takiego konta w tym okresie (poza Inteligo i SKO).",
        "notEligibleFor": "Osoby, które od 1.04.2025 do 30.09.2026 miały w banku konto w złotych. W promocji można otworzyć max 1 konto dla siebie i po 1 dla każdego dziecka. Konto wspólne — tylko jedna nagroda. Promocja nie łączy się z „Bankuj z Samsung”. Limit 12 000 otwartych kont.",
        "cooldownMonths": None, "cooldownCutoffDate": "2025-04-01",
        "summary": "Do 600 zł z PKO Kontem za Zero (10% wartości transakcji kartą co miesiąc przez 5 miesięcy, do 100 zł, plus 100 zł) i do 300 zł za konto dla dziecka. Kod PROSTO. Do 31.12.2026.",
        "conditions": [
            {"title": "Otwórz online PKO Konto za Zero z kartą Visa i wpisz kod PROSTO", "description": "W okresie 1.10–31.12.2026 (lub do wyczerpania 12 000 kont) w aplikacji, serwisie internetowym lub przez stronę banku. We wniosku wpisujesz kod promocji PROSTO i wyrażasz zgodę na marketing elektroniczny banku.", "type": "account_opening", "order": 0},
            {"title": "Nagroda I: 10% transakcji kartą, do 100 zł miesięcznie przez 5 miesięcy", "description": "W każdym z 5 kolejnych miesięcy po miesiącu otwarcia konta: min. 1 logowanie do aplikacji mobilnej banku i min. 1 transakcja bezgotówkowa kartą. Zasilenie konta kwotą 10% wartości transakcji bezgotówkowych kartą w miesiącu (maks. 100 zł), łącznie do 500 zł. Nie liczą się wypłaty, przelewy z karty, kasyna i zakłady, BLIK ani transakcje z konta walutowego.", "type": "card_payments", "order": 1},
            {"title": "Nagroda II: 100 zł, jeśli dostałeś(aś) nagrodę I we wszystkich 5 miesiącach", "description": "Przyznawana po spełnieniu wszystkich warunków promocji.", "type": "other", "order": 2},
            {"title": "Do 300 zł za konto dla dziecka (3 × 100 zł)", "description": "Opcjonalnie: otwórz online konto dla swojego dziecka z kodem PROSTO i zgodą na marketing. W każdym z 3 kolejnych miesięcy: zasil konto dziecka min. 100 zł (13–17 lat), loguj się do aplikacji i rób min. 10 transakcji bezgotówkowych kartą (przy dzieciach 6–12 lat i 13–17 lat zasady różnią się szczegółami — sprawdź regulamin).", "type": "other", "order": 3},
            {"title": "Wypłata nagród do końca następnego miesiąca", "description": "Nagrody wpływają co miesiąc na konto biorące udział w promocji najpóźniej do końca miesiąca następującego po miesiącu spełnienia warunków (konta dzieci do 6 lat — na Twoje konto powiązane). Kwoty są brutto.", "type": "deadline", "order": 4},
        ],
        "bonusParts": [
            {"label": "Nagroda I — 10% transakcji kartą, do 100 zł miesięcznie przez 5 miesięcy (500 zł)", "amountCents": 50000, "order": 0},
            {"label": "Nagroda II — 100 zł za pięć miesięcy spełnionych warunków", "amountCents": 10000, "order": 1},
            {"label": "Konto dla dziecka — 3 × 100 zł", "amountCents": 30000, "order": 2},
        ],
        "fees": {
            "accountFeeCents": 0,
            "cardFeeCents": 1000,
            "cardFeeWaiverCondition": "min. 5 transakcji bezgotówkowych kartą lub BLIKIEM w okresie rozliczeniowym karty",
            "otherFee": "Według strony oferty: prowadzenie PKO Konta za Zero 0 zł miesięcznie, wypłaty BLIK 0 zł. Karta do konta 10 zł miesięcznie, 0 zł przy min. 5 transakcjach bezgotówkowych kartą lub BLIKIEM w okresie rozliczeniowym karty (strona PKO Konta za Zero).",
            "sourceUrl": "https://www.pkobp.pl/klient-indywidualny/konta/konto-za-zero",
        },
    },
    "checklistSteps": steps,
}
write("data/candidates/pko-konto-za-zero-prosty-zwrot.json", d)
