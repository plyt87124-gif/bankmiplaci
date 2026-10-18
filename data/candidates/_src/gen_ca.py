import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

G = "2026-11-30"  # last day to join the "Smaczne zwroty II" part

steps = open_steps([
    "Otwórz Konto dla Ciebie MAX (lub MOVE / Prime) z kartą w placówce albo w aplikacji CA24 Mobile — do 30.11.2026 dla „Smacznych zwrotów II”, do 31.12.2026 dla zwrotów za zakupy",
    "Zamów kartę do konta",
    "Wyraź zgody marketingowe (telefoniczne i elektroniczne) i nie odwołuj ich do wypłaty zwrotów",
    "Opcjonalnie: otwórz razem z kontem Rachunek Oszczędzam Plus (6,5% przez 100 dni do 100 000 zł; konto otwarte 1.10–30.11.2026)",
])
for m in range(1, 11):
    base = m * 10
    lbl = "Miesiąc 1 (po otwarciu konta)" if m == 1 else f"Miesiąc {m}"
    steps += [
        {"order": base, "monthLabel": lbl, "title": "Płać kartą lub BLIKIEM w restauracjach, kawiarniach i lokalach gastronomicznych (zwrot 10 zł za każde 50 zł, do 100 zł mies.)", "availableUntil": G},
        {"order": base + 1, "monthLabel": lbl, "title": "Zrób min. 10 płatności kartą lub BLIKIEM (zwrot 3% z zakupów, do 50 zł mies.)"},
        {"order": base + 2, "monthLabel": lbl, "title": "Odbierz zwrot za gastronomię: do 100 zł (do końca następnego miesiąca)", "rewardCents": 10000, "availableUntil": G},
        {"order": base + 3, "monthLabel": lbl, "title": "Odbierz zwrot za zakupy: do 50 zł (do końca następnego miesiąca)", "rewardCents": 5000},
    ]

d = {
    "_comment": "Credit Agricole — Konto dla Ciebie MAX: „Smaczne zwroty II” (do 1000 zł za gastronomię, przystąpienie do 30.11.2026) + „Zyskaj do 500 zł zwrotów za zakupy” (do 31.12.2026); strona oferty pokazuje je jako uzupełniające się, a regulaminy wzajemnie ich nie wykluczają (zastrzeżenie dotyczy promocji za samo otwarcie konta) — do ręcznego potwierdzenia, czy zwroty sumują się na jednym koncie. Promocja Rachunek Oszczędzam Plus 6,5% opisana, ale poza kwotą. Kampania eBroker 12505.",
    "bankSlug": "creditagricole", "ebrokerOid": "12505",
    "promotion": {
        "slug": "creditagricole-konto-dla-ciebie-max-smaczne-zwroty-ii",
        "name": "Konto dla Ciebie MAX: do 1000 zł zwrotu za gastronomię i do 500 zł za zakupy",
        "accountType": "PERSONAL", "maxBonusCents": 150000, "difficulty": "EASY", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-10-01", "endDate": "2026-12-31", "affiliateLinkEnabled": True,
        "sourceUrl": "https://static.credit-agricole.pl/asset/r/e/g/regulamin-promocji-smaczne-zwroty-ii_36919.pdf",
        "additionalSourceUrls": [
            "https://static.credit-agricole.pl/asset/r/e/g/regulamin-promocji-zyskaj-do-500-zl-zwrotow-za-zakupy_36920.pdf",
            "https://static.credit-agricole.pl/asset/r/e/g/regulamin-promocji-na-start-nawet-6-i-pol_37004.pdf"],
        "lastVerifiedAt": "2026-10-07",
        "eligibleFor": "Osoby, które od 1.01.2025 nie mają konta osobistego w Credit Agricole (także jako współposiadacz konta wspólnego). W promocji biorą udział Konto dla Ciebie MAX, MOVE i Prime; MAX jest dla osób powyżej 18 lat.",
        "notEligibleFor": "Osoby, które od 1.01.2025 miały w banku konto osobiste. Promocji nie łączysz z innymi promocjami wyłącznie za otwarcie konta. Przy kontach wspólnych zwroty się nie podwajają.",
        "cooldownMonths": None, "cooldownCutoffDate": "2025-01-01",
        "summary": "Do 1000 zł zwrotu za płatności w gastronomii (10 zł za każde 50 zł, do 100 zł miesięcznie przez 10 miesięcy) i do 500 zł za zakupy (3%, min. 10 płatności mies.). Konto MAX bez opłaty za prowadzenie.",
        "conditions": [
            {"title": "Otwórz Konto dla Ciebie MAX z kartą w placówce lub w CA24 Mobile", "description": "„Smaczne zwroty II”: konto otwarte od 1.10 do 30.11.2026. „Zyskaj do 500 zł zwrotów za zakupy”: do 31.12.2026. Zamawiasz kartę do konta i nie masz konta w banku od 1.01.2025.", "type": "account_opening", "order": 0},
            {"title": "Wyraź zgody marketingowe i utrzymuj je do wypłaty zwrotów", "description": "Zgody na kontakt telefoniczny i elektroniczny (e-mail, SMS). Odwołanie zgody albo rozwiązanie umowy konta przed wypłatą oznacza utratę zwrotu.", "type": "other", "order": 1},
            {"title": "Smaczne zwroty II: 10 zł za każde 50 zł wydane w gastronomii", "description": "Płatności kartą do konta lub BLIKIEM w restauracjach (MCC 5812), fast foodach (5814) i cateringu (5811), także zamówienia online u placówek z tymi kodami. Nie liczą się bary i kluby (5813), sklepy spożywcze (5411), gastronomia na stacjach paliw, w hotelach i za granicą. Do 100 zł miesięcznie przez 10 miesięcy (do 1000 zł). Zwroty od pierwszego pełnego miesiąca po otwarciu konta.", "type": "card_payments", "order": 2},
            {"title": "Zyskaj do 500 zł zwrotów za zakupy: 3%, min. 10 płatności miesięcznie", "description": "3% wartości transakcji w miesiącu, do 50 zł miesięcznie przez 10 miesięcy (do 500 zł). W każdym miesiącu z nagrodą wykonaj min. 10 transakcji kartą (także w portfelu mobilnym) lub BLIKIEM. Nie liczą się m.in. kasyna, instytucje finansowe i przekazy pieniężne.", "type": "card_payments", "order": 3},
            {"title": "Wypłata zwrotów do końca następnego miesiąca", "description": "Zwroty wpływają co miesiąc na konto biorące udział w promocji najpóźniej do końca kolejnego miesiąca kalendarzowego. Miesiąc bez spełnionych warunków nie kończy promocji. Zwroty są zwolnione z podatku.", "type": "deadline", "order": 4},
        ],
        "bonusParts": [
            {"label": "Smaczne zwroty II — do 1000 zł (10 × do 100 zł za płatności w gastronomii)", "amountCents": 100000, "order": 0, "availableUntil": G},
            {"label": "Zyskaj do 500 zł zwrotów za zakupy — 10 × do 50 zł", "amountCents": 50000, "order": 1},
        ],
        "fees": {
            "accountFeeCents": 0,
            "cardFeeCents": 1000,
            "cardFeeWaiverCondition": "w poprzednim miesiącu wpływ min. 1500 zł i min. 5 transakcji bezgotówkowych kartą lub BLIKIEM",
            "otherFee": "Cennik kont (obowiązuje od 18.08.2026): prowadzenie Konta dla Ciebie MAX 0 zł; korzystanie z karty 10 zł miesięcznie (0 zł przy wpływie min. 1500 zł w poprzednim miesiącu i min. 5 płatnościach); karta ze standardowym wizerunkiem 0 zł, z wizerunkiem z katalogu 15 zł.",
            "sourceUrl": "https://www.credit-agricole.pl/dokumenty/konta/toip-indywidualni",
        },
    },
    "checklistSteps": steps,
}
write("data/candidates/creditagricole-konto-max.json", d)
