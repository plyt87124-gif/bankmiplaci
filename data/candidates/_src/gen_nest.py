import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

steps = open_steps([
    "Złóż wniosek o Nest Konto (1.10.2026–31.03.2027): na stronie, na stronie promocyjnej lub w aplikacji — zaznacz udział w promocji",
    "Wyraź zgodę marketingową co najmniej na SMS/MMS oraz bankowość internetową i aplikację (najpóźniej w dniu otwarcia)",
    "Zawrzyj umowę ramową w ciągu 14 dni od wniosku",
    "Sprawdź kwotę wynagrodzenia: 1500 zł (do 26 lat) albo 3000 zł (od 26 lat) — wpływ musi być oznaczony jako wynagrodzenie",
])
for m in range(1, 13):
    base = m * 10
    lbl = "Miesiąc 1 (po otwarciu konta)" if m == 1 else f"Miesiąc {m}"
    steps += [
        {"order": base, "monthLabel": lbl, "title": "Zapewnij wpływ wynagrodzenia na Nest Konto (min. 1500 zł do 26 lat, 3000 zł od 26 lat)"},
        {"order": base + 1, "monthLabel": lbl, "title": "Zrób min. 1 płatność kartą lub BLIKIEM (zwrot 2%) i utrzymaj zgodę marketingową przez cały miesiąc"},
    ]
    if m == 1:
        steps.append({"order": base + 2, "monthLabel": lbl, "title": "Odbierz premię powitalną: 200 zł (za pierwszy wpływ wynagrodzenia; najpóźniej do końca 2. pełnego miesiąca)", "rewardCents": 20000})
    elif m <= 11:
        steps.append({"order": base + 2, "monthLabel": lbl, "title": "Odbierz premię miesięczną: 50 zł (do 10 miesięcy)", "rewardCents": 5000})
    steps.append({"order": base + 3, "monthLabel": lbl, "title": "Odbierz zwrot 2% za zakupy: do 30 zł (do końca następnego miesiąca)", "rewardCents": 3000})

d = {
    "_comment": "Nest Bank — „Zyskaj do 1060 zł za wynagrodzenie i aktywność” (Nest Konto, przystąpienie 1.10.2026–31.03.2027). Źródło: regulamin promocji + dokument dotyczący opłat + strona oferty. Ściąga zakłada wpływ wynagrodzenia w każdym miesiącu od pierwszego pełnego. Kampania eBroker 12455.",
    "bankSlug": "nest", "ebrokerOid": "12455",
    "promotion": {
        "slug": "nest-konto-zyskaj-do-1060-zl-za-wynagrodzenie",
        "name": "Nest Konto: do 1060 zł za wynagrodzenie i aktywność",
        "accountType": "PERSONAL", "maxBonusCents": 106000, "difficulty": "MEDIUM", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-10-01", "endDate": "2027-03-31", "affiliateLinkEnabled": True,
        "sourceUrl": "https://nestbank.pl/assets/gen/regulamin-promocji-zyskaj-do-1060-zl-za-wynagrodzenie-i-aktywnosc.pdf",
        "additionalSourceUrls": ["https://nestbank.pl/assets/gen/57-57-01-dokument_dotyczacy_oplat_nest_konto.pdf"],
        "lastVerifiedAt": "2026-10-07",
        "eligibleFor": "Pełnoletnie osoby mieszkające w Polsce, z pełną zdolnością prawną, które od 1.01.2026 do dnia złożenia wniosku nie były posiadaczem ani współposiadaczem konta osobistego w Nest Banku.",
        "notEligibleFor": "Osoby, które od 1.01.2026 miały w banku konto osobiste. Wykluczenie z promocji grozi za używanie konta do działalności gospodarczej, odstąpienie od umowy lub jej wypowiedzenie. Bank może zakończyć okres przystąpienia wcześniej, zapowiadając to 7 dni wcześniej.",
        "cooldownMonths": None, "cooldownCutoffDate": "2026-01-01",
        "summary": "Do 1060 zł: 200 zł premii powitalnej za pierwsze wynagrodzenie, 10 × 50 zł premii miesięcznej i 12 × do 30 zł (2%) zwrotu za zakupy. Konto, karta i przelewy 0 zł na stałe.",
        "conditions": [
            {"title": "Złóż wniosek o Nest Konto w okresie 1.10.2026–31.03.2027", "description": "Na stronie banku lub stronie promocyjnej (z zaznaczoną chęcią udziału w promocji), w aplikacji przed zalogowaniem lub po zalogowaniu. Umowę ramową zawierasz w ciągu 14 dni od wniosku.", "type": "account_opening", "order": 0},
            {"title": "Zgoda marketingowa na SMS/MMS oraz bankowość internetową i aplikację", "description": "Potrzebna najpóźniej w dniu otwarcia konta i musisz ją mieć przez cały miesiąc, za który chcesz premię lub zwrot. Choćby jeden dzień odwołanej zgody w miesiącu oznacza utratę nagrody za ten miesiąc.", "type": "other", "order": 1},
            {"title": "Wpływ wynagrodzenia: 1500 zł (do 26 lat) lub 3000 zł (od 26 lat)", "description": "Premia powitalna 200 zł za pierwszy wpływ wynagrodzenia najpóźniej do końca drugiego pełnego miesiąca po miesiącu otwarcia konta (inaczej tracisz premię za wynagrodzenie). Potem 50 zł za każdy miesiąc z wpływem wynagrodzenia, maksymalnie przez 10 miesięcy; łącznie do 700 zł.", "type": "inflow", "order": 2},
            {"title": "Zwrot 2% za zakupy kartą i BLIKIEM: do 30 zł miesięcznie przez 12 miesięcy", "description": "Za płatności za towary i usługi kartą lub BLIKIEM (bez przelewów BLIK na telefon, wypłat, zasileń portfeli i hazardu) w miesiącu z wpływem wynagrodzenia. Pierwszy miesiąc zwrotu najpóźniej do końca drugiego pełnego miesiąca po otwarciu konta; razem do 360 zł.", "type": "card_payments", "order": 3},
            {"title": "Wypłata do końca następnego miesiąca", "description": "Premie i zwroty wpływają na Nest Konto najpóźniej do ostatniego dnia miesiąca następującego po miesiącu spełnienia warunków. Łącznie max 1060 zł. Nagrody są zwolnione z podatku (sprzedaż premiowa).", "type": "deadline", "order": 4},
        ],
        "bonusParts": [
            {"label": "Premia powitalna za pierwszy wpływ wynagrodzenia — 200 zł", "amountCents": 20000, "order": 0},
            {"label": "Premia miesięczna za wynagrodzenie — 10 × 50 zł (500 zł)", "amountCents": 50000, "order": 1},
            {"label": "Zwrot 2% za zakupy — 12 × do 30 zł (360 zł)", "amountCents": 36000, "order": 2},
        ],
        "fees": {
            "accountFeeCents": 0,
            "cardFeeCents": 0,
            "otherFee": "Według dokumentu dotyczącego opłat (Nest Konto): prowadzenie rachunku 0 zł, pierwsza karta plastikowa w ramach umowy ramowej 0 zł, przelewy ELIXIR przez bankowość internetową i aplikację 0 zł. Prowizja za przewalutowanie 4,9% przy transakcjach w obcej walucie.",
            "sourceUrl": "https://nestbank.pl/assets/gen/57-57-01-dokument_dotyczacy_oplat_nest_konto.pdf",
        },
    },
    "checklistSteps": steps,
}
write("data/candidates/nest-konto-1060.json", d)
