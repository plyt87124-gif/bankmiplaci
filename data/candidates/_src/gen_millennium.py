import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

SRC = "https://www.bankmillennium.pl/delegate/managedfiles/132001/latest"

steps = open_steps([
    "Zarejestruj JDG w CEIDG (lub miej wpis) i złóż wniosek o Konto Mój Biznes: w Millenecie/aplikacji (klient) albo online na stronie banku (nowy klient) — 1.10.2026–28.02.2027",
    "Wyraź zgody marketingowe i handlowe (elektroniczne, telefoniczne/IVR, firmy współpracujące) przy otwarciu konta",
    "Upewnij się, że nie miałeś(aś) konta w Banku Millennium od 1.10.2024 i że nie jesteś pracownikiem banku",
])
for m in range(1, 7):
    base = m * 10
    lbl = "Miesiąc 1 (po otwarciu konta)" if m == 1 else f"Miesiąc {m}"
    steps += [
        {"order": base, "monthLabel": lbl, "title": "Płać kartą do konta lub portfelem wirtualnym za towary i usługi (bez BLIK i wypłat) — zwrot 10%, do 400 zł mies."},
        {"order": base + 1, "monthLabel": lbl, "title": "Wykonaj min. 1 przelew do ZUS z formatki ZUS w Millenecie lub aplikacji"},
        {"order": base + 2, "monthLabel": lbl, "title": "Zaloguj się co najmniej raz do aplikacji mobilnej i utrzymaj zgody marketingowe"},
    ]
    if m == 1:
        steps.append({"order": base + 3, "monthLabel": lbl, "title": "Opcjonalnie: do końca tego miesiąca podpisz z PayTel umowę na terminal POS na min. 12 miesięcy"})
    steps.append({"order": base + 4, "monthLabel": lbl, "title": "Opcjonalnie: zapewnij wpływ z terminala min. 1000 zł (6 miesięcy od miesiąca po podpisaniu umowy)"})
    steps.append({"order": base + 5, "monthLabel": lbl, "title": "Odbierz premię za transakcje kartą: do 400 zł (do końca następnego miesiąca)", "rewardCents": 40000})
    steps.append({"order": base + 6, "monthLabel": lbl, "title": "Odbierz premię za terminal: do 300 zł (do końca następnego miesiąca)", "rewardCents": 30000})
steps.append({"order": 67, "monthLabel": "Miesiąc 6", "title": "Opcjonalnie w ciągu 6 miesięcy: przelew min. 1000 zł raty leasingu do Millennium Leasing albo kredyt gotówkowy min. 50 000 zł (uruchomiony)"})
steps.append({"order": 68, "monthLabel": "Miesiąc 6", "title": "Odbierz jednorazową premię za leasing lub kredyt: 1800 zł (po zakończeniu 6 miesięcy)", "rewardCents": 180000})

d = {
    "_comment": "Bank Millennium — „Otwórz Konto Mój Biznes z bonusem do 6000 zł” (1.10.2026–28.02.2027, limit 18 000 kont). Źródło: regulamin promocji + strona oferty. Premie są przychodem z działalności i podlegają opodatkowaniu (bank nie jest płatnikiem). Kampania eBroker 12917. Następca promocji „Nawet 5000 zł” (do 30.09.2026).",
    "bankSlug": "millennium", "ebrokerOid": "12917",
    "promotion": {
        "slug": "millennium-konto-moj-biznes-bonus-do-6000-zl",
        "name": "Konto Mój Biznes: bonus do 6000 zł",
        "accountType": "BUSINESS", "maxBonusCents": 600000, "difficulty": "MEDIUM", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-10-01", "endDate": "2027-02-28", "affiliateLinkEnabled": True,
        "sourceUrl": SRC,
        "additionalSourceUrls": ["https://www.bankmillennium.pl/delegate/managedfiles/2115/latest", "https://www.bankmillennium.pl/konto-firmowe-m"],
        "lastVerifiedAt": "2026-10-07",
        "eligibleFor": "Osoby fizyczne prowadzące jednoosobową działalność wpisaną do CEIDG (lub rejestrujące ją w trakcie promocji przez Millenet albo aplikację), które nie miały konta w Banku Millennium od 1.10.2024. Nowi klienci otwierają konto online na stronie banku, obecni klienci indywidualni w Millenecie lub aplikacji.",
        "notEligibleFor": "Pracownicy banku oraz osoby, które od 1.10.2024 do przystąpienia miały konto w banku. Promocja obejmuje jedno konto na NIP. Limit to 18 000 kont (oferta może skończyć się przed 28.02.2027). Premie są przychodem z działalności gospodarczej — trzeba je rozliczyć podatkowo.",
        "cooldownMonths": None, "cooldownCutoffDate": "2024-10-01",
        "summary": "Do 6000 zł premii dla JDG: do 2400 zł zwrotu 10% za płatności kartą (6 miesięcy), do 1800 zł za terminal PayTel i 1800 zł za ratę leasingu lub kredyt. Wymagane przelewy ZUS z formatki co miesiąc.",
        "conditions": [
            {"title": "Otwórz Konto Mój Biznes w okresie 1.10.2026–28.02.2027", "description": "Jako JDG wpisana do CEIDG (lub zarejestrowana przez Millenet/aplikację w trakcie promocji). Nowy klient składa wniosek online na stronie banku, obecny klient indywidualny otwiera konto w Millenecie lub aplikacji. Przy otwarciu wyrażasz zgody marketingowe i handlowe i utrzymujesz je do wypłaty.", "type": "account_opening", "order": 0},
            {"title": "Premia 10% za płatności kartą: do 400 zł miesięcznie przez 6 miesięcy (do 2400 zł)", "description": "W każdym z 6 pełnych miesięcy po miesiącu otwarcia konta: transakcje kartą do konta lub portfelem wirtualnym (rozliczone w tym miesiącu), min. 1 przelew do ZUS z formatki ZUS w Millenecie lub aplikacji, zgody marketingowe i min. 1 logowanie do aplikacji. Nie liczą się wypłaty/wpłaty gotówki, BLIK, przelewy i zasilenia portfeli oraz hazard.", "type": "card_payments", "order": 1},
            {"title": "Premia za terminal POS: do 300 zł miesięcznie przez 6 miesięcy (do 1800 zł)", "description": "Do końca miesiąca po otwarciu konta podpisz z PayTel umowę na terminal POS lub Millennium POS na min. 12 miesięcy. Przez 6 miesięcy od miesiąca po podpisaniu: wpływ z terminala na konto min. 1000 zł miesięcznie oraz warunki miesięczne (przelew ZUS z formatki, zgody, logowanie).", "type": "inflow", "order": 2},
            {"title": "Premia 1800 zł za ratę leasingu lub kredyt gotówkowy", "description": "W ciągu 6 miesięcy po miesiącu otwarcia konta: przelew min. 1000 zł z konta na wymagalną ratę leasingu w Millennium Leasing albo kredyt gotówkowy z uruchomieniem min. 50 000 zł z jednej umowy. Jedna premia (leasing albo kredyt), pod warunkiem spełnienia warunków miesięcznych (ZUS, zgody, logowanie) we wszystkich 6 miesiącach. Wypłata po zakończeniu 6 miesięcy, najpóźniej do końca następnego miesiąca.", "type": "other", "order": 3},
            {"title": "Terminy i podatek", "description": "Premie za karty i terminal bank wypłaca do końca następnego miesiąca po miesiącu naliczenia. Łącznie max 6000 zł. Premia jest przychodem z działalności gospodarczej, bank nie pobiera podatku. Po spełnieniu promocji „Rozwiń swój biznes” konto kosztuje 0 zł przez 24 miesiące.", "type": "deadline", "order": 4},
        ],
        "bonusParts": [
            {"label": "Zwrot 10% za płatności kartą — do 400 zł miesięcznie przez 6 miesięcy (do 2400 zł)", "amountCents": 240000, "order": 0},
            {"label": "Premia za terminal POS — do 300 zł miesięcznie przez 6 miesięcy (do 1800 zł)", "amountCents": 180000, "order": 1},
            {"label": "Premia za ratę leasingu lub kredyt gotówkowy — 1800 zł jednorazowo", "amountCents": 180000, "order": 2},
        ],
        "fees": {
            "accountFeeCents": None,
            "accountFeeWaiverCondition": "po 24 miesiącach: przelew do ZUS/US raz w miesiącu albo wpływ min. 1000 zł miesięcznie",
            "cardFeeCents": None,
            "otherFee": "Według strony oferty (promocja „Rozwiń swój biznes z Kontem Mój Biznes”): 0 zł za prowadzenie pierwszego i kolejnych Kont Mój Biznes oraz kont walutowych przez 2 lata, 0 zł za obsługę karty kredytowej Millennium Visa Business, 0 zł za przelewy krajowe w PLN i EUR (SEPA) w trybie standardowym. Stawka po okresie promocyjnym nie jest podana na stronie — sprawdź Taryfę.",
            "sourceUrl": "https://www.bankmillennium.pl/konto-firmowe-m",
        },
    },
    "checklistSteps": steps,
}
write("data/candidates/millennium-konto-moj-biznes.json", d)
