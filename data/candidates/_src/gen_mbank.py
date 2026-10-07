import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

SRC_CN2 = "https://www.mbank.pl/pdf/promocje/konta/regulamin-promocji-cala-naprzod-zyskuj-z-kontem-w-mbanku-edycja-ii.pdf"
SRC_BDM = "https://www.mbank.pl/pdf/promocje/konta/regulamin-promocji-bonus-dla-mobilnych-edycja-iii.pdf"
TARYFA = "https://www.mbank.pl/pomoc/oplaty/interaktywna/ind/"


def build(kind):
    young = kind == "young"
    inflow = 1000 if young else 2000
    product = "eKonto możliwości (18–24 lata)" if young else "mKonto Intensive"
    oid = "13442" if young else "10653"
    steps = open_steps([
        "Zapisz się do promocji „Bonus dla mobilnych” na stronie promocji (przed wnioskiem o konto)",
        f"Tego samego dnia otwórz {product} z kartą w aplikacji mBank przez selfie, e-dowód lub mObywatela i zaznacz otwarcie rachunku Moje cele",
        "Zaakceptuj regulaminy i oświadczenia; umowę zawrzyj najpóźniej do 7.12.2026 (do 9.12.2026 dla „Bonusu dla mobilnych”)",
        f"W ciągu 7 dni od otwarcia zrób jednorazowy wpływ min. {inflow} zł (bez przelewu z innego Twojego rachunku w mBanku)",
    ])
    # group 1: first full month
    g1 = [
        ("Zrób transakcje kartą na łączną kwotę min. 350 zł do końca pierwszego pełnego miesiąca (bez BLIK)", None),
        ("Miej łączne saldo min. 100 zł na rachunku Moje cele w ostatnim dniu roboczym tego miesiąca", None),
        (f"Wpływ wynagrodzenia min. {inflow} zł z jednoznacznym tytułem (do bonusu II potrzebny w min. 4 z 6 miesięcy)", None),
    ]
    if not young:
        g1.append(("Do końca pierwszego pełnego miesiąca otwórz dla dziecka eKonto Junior lub eKonto możliwości (13–17 lat)", None))
    o = 10
    for t, _ in g1:
        steps.append({"order": o, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": t})
        o += 1
    steps.append({"order": o, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "Odbierz premię I: 100 zł (wypłata do końca 2. miesiąca po otwarciu)", "rewardCents": 10000}); o += 1
    steps.append({"order": o, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "Odbierz bonus „Bonus dla mobilnych”: 10 zł (do końca 2. pełnego miesiąca po otwarciu)", "rewardCents": 1000}); o += 1
    if not young:
        steps.append({"order": o, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "Odbierz bonus III: 100 zł za konto dla dziecka", "rewardCents": 10000}); o += 1
    for m in range(2, 7):
        base = m * 10
        lbl = f"Miesiąc {m}"
        steps += [
            {"order": base, "monthLabel": lbl, "title": f"Zrób jednorazowy wpływ min. {inflow} zł (najlepiej wynagrodzenie z jednoznacznym tytułem)"},
            {"order": base + 1, "monthLabel": lbl, "title": "Zrób transakcje kartą na łączną kwotę min. 350 zł (bez BLIK)"},
            {"order": base + 2, "monthLabel": lbl, "title": "Zwiększ łączne saldo na Moje cele o min. 100 zł względem ostatniego dnia roboczego poprzedniego miesiąca"},
        ]
    steps.append({"order": 63, "monthLabel": "Miesiąc 6", "title": "Odbierz premię II: 400 zł (po 5 miesiącach spełnionych warunków)", "rewardCents": 40000})
    steps.append({"order": 64, "monthLabel": "Miesiąc 6", "title": "Odbierz bonus I: 100 zł (za otwarcie przez selfie, e-dowód lub mObywatela)", "rewardCents": 10000})
    steps.append({"order": 65, "monthLabel": "Miesiąc 6", "title": "Odbierz bonus II: 300 zł (wpływ wynagrodzenia w min. 4 z 6 miesięcy)", "rewardCents": 30000})

    parts = [
        {"label": "Premia I — 100 zł (wpływ w 7 dni, transakcje 350 zł, saldo Moje cele)", "amountCents": 10000, "order": 0},
        {"label": "Premia II — 400 zł (warunki w 5 kolejnych miesiącach)", "amountCents": 40000, "order": 1},
        {"label": "Bonus I — 100 zł (otwarcie przez selfie, e-dowód lub mObywatela)", "amountCents": 10000, "order": 2},
        {"label": "Bonus II — 300 zł (wynagrodzenie w min. 4 z 6 miesięcy)", "amountCents": 30000, "order": 3},
        {"label": "Bonus dla mobilnych — 10 zł (zapis do promocji i transakcje 350 zł)", "amountCents": 1000, "order": 4},
    ]
    if not young:
        parts.insert(4, {"label": "Bonus III — 100 zł (eKonto Junior lub możliwości dla dziecka)", "amountCents": 10000, "order": 4})
        parts[5]["order"] = 5
    total = sum(p["amountCents"] for p in parts)

    if young:
        fees = {"accountFeeCents": 0, "cardFeeCents": 0,
                "otherFee": "Według strony oferty: 0 zł za otwarcie i prowadzenie konta oraz kartę Visa Me. Karta Visa Podróże 0 zł przy transakcjach kartą na min. 350 zł w miesiącu. Wypłaty z bankomatów w Polsce 0 zł od 100 zł.",
                "sourceUrl": TARYFA}
    else:
        fees = {"accountFeeCents": 4950,
                "accountFeeWaiverCondition": "suma miesięcznych wpływów min. 10 000 zł albo łączna suma depozytów i inwestycji min. 100 000 zł",
                "cardFeeCents": 0,
                "otherFee": "Według strony oferty: bezpłatna karta do konta, bezpłatne przelewy ekspresowe i bezpłatne wypłaty z bankomatów w Polsce po spełnieniu warunków; karta Visa Świat Intensive bez prowizji za przewalutowanie.",
                "sourceUrl": TARYFA}

    d = {
        "_comment": f"mBank — {product}: promocje „Cała naprzód – zyskuj z kontem w mBanku – edycja II” (przystąpienie 1.09–30.11.2026) i „Bonus dla mobilnych – edycja III” (+10 zł). Źródło: regulaminy PDF + strona oferty. Kampania eBroker {oid}. Ten sam regulamin obejmuje eKonto do usług (to jest już osobna promocja z bonami do Biedronki).",
        "bankSlug": "mbank", "ebrokerOid": oid,
        "promotion": {
            "slug": "mbank-ekonto-mozliwosci-18-24-cala-naprzod-2" if young else "mbank-mkonto-intensive-cala-naprzod-2",
            "name": "eKonto możliwości (18–24 lata): do 910 zł i 5,3% na oszczędnościach" if young else "mKonto Intensive: do 1010 zł i 5,5% na oszczędnościach",
            "accountType": "YOUNG" if young else "PERSONAL",
            "maxBonusCents": total, "difficulty": "MEDIUM" if young else "HARD", "rating": 7.0, "status": "DRAFT",
            "startDate": "2026-09-01", "endDate": "2026-11-30", "affiliateLinkEnabled": True,
            "sourceUrl": SRC_CN2, "additionalSourceUrls": [SRC_BDM],
            "lastVerifiedAt": "2026-10-07",
            "eligibleFor": "Pełnoletnie osoby fizyczne" + (" w wieku 18–24 lat" if young else "") + ", które od 1.01.2023 nie były i nie są posiadaczem ani współposiadaczem rachunku oszczędnościowo-rozliczeniowego lub oszczędnościowego w mBanku. Konto indywidualne (nie wspólne) z kartą otwierasz online lub w aplikacji. Dodatkowe 10 zł (Bonus dla mobilnych): nie możesz mieć innych produktów mBanku, a konto otwierasz w aplikacji przez selfie, e-dowód lub mObywatela.",
            "notEligibleFor": "Osoby, które od 1.01.2023 miały rachunek w mBanku (dla Bonusu dla mobilnych od 1.01.2022 i inne produkty). Konto wspólne. Z promocji można skorzystać tylko raz i tylko na pierwszym otwartym rachunku; zmiana rachunku na wspólny lub inny rodzaj kończy udział.",
            "cooldownMonths": None, "cooldownCutoffDate": "2023-01-01",
            "summary": ("Do 910 zł: 100 zł premii I, 400 zł premii II, 100 zł + 300 zł bonusów i 10 zł za zapis w aplikacji; 5,3% na koncie Moje cele przez 180 dni."
                        if young else
                        "Do 1010 zł: premie 100 + 400 zł, bonusy 100 + 300 + 100 zł i 10 zł za zapis w aplikacji; 5,5% na koncie Moje cele do 200 000 zł przez 180 dni."),
            "conditions": [
                {"title": f"Otwórz {product} z kartą i rachunkiem Moje cele", "description": f"Wniosek składasz od 1.09 do 30.11.2026 (umowa najpóźniej do 7.12.2026). Rachunek jednoosobowy, z kartą, z zaznaczoną opcją otwarcia rachunku do regularnego oszczędzania Moje cele. Najszybciej w aplikacji mobilnej mBanku.", "type": "account_opening", "order": 0},
                {"title": "Zapisz się do promocji „Bonus dla mobilnych” przed wnioskiem", "description": "Wniosek zapisujący do promocji składasz na stronie promocji tego samego dnia przed otwarciem rachunku (dane muszą być identyczne). Rachunek otwierasz przez selfie, e-dowód lub mObywatela. Bonus 10 zł wymaga transakcji kartą na min. 350 zł do końca pierwszego pełnego miesiąca.", "type": "other", "order": 1},
                {"title": f"Premia I (100 zł): wpływ min. {inflow} zł w 7 dni, transakcje 350 zł, saldo Moje cele", "description": f"Jednorazowy wpływ min. {inflow} zł w ciągu 7 dni od otwarcia (nie z innego Twojego rachunku w mBanku), transakcje kartą na min. 350 zł do końca pierwszego pełnego miesiąca (bez BLIK) oraz łączne saldo min. 100 zł na Moje cele w ostatnim dniu roboczym tego miesiąca.", "type": "card_payments", "order": 2},
                {"title": f"Premia II (400 zł): 5 miesięcy po {inflow} zł wpływu, 350 zł transakcji i +100 zł na celach", "description": f"W każdym z miesięcy od drugiego do szóstego pełnego miesiąca po otwarciu: jednorazowy wpływ min. {inflow} zł, transakcje kartą na min. 350 zł i wzrost łącznego salda Moje cele o min. 100 zł względem ostatniego dnia roboczego poprzedniego miesiąca.", "type": "inflow", "order": 3},
                {"title": "Bonus I (100 zł): konto otwarte przez selfie, e-dowód lub mObywatela", "description": "Przysługuje po spełnieniu wszystkich warunków premii I i II.", "type": "other", "order": 4},
                {"title": f"Bonus II (300 zł): wynagrodzenie min. {inflow} zł w co najmniej 4 z 6 miesięcy", "description": "Wpływ z tytułu wynagrodzenia od pracodawcy, stypendium, renty, emerytury lub świadczenia ZUS/KRUS (także z własnej firmy w mBanku) z tytułem przelewu jednoznacznie wskazującym wynagrodzenie. Nie liczą się 800+, alimenty ani wpływy z rachunków osobistych.", "type": "inflow", "order": 5},
            ] + ([] if young else [
                {"title": "Bonus III (100 zł): eKonto Junior lub możliwości dla dziecka", "description": "Do końca pierwszego pełnego miesiąca po otwarciu Twojego rachunku otwierasz dla dziecka eKonto Junior albo eKonto możliwości (13–17 lat).", "type": "other", "order": 6}
            ]) + [
                {"title": "Promocyjne oprocentowanie na koncie Moje cele przez 180 dni", "description": ("5,3% w skali roku do 100 000 zł" if young else "5,5% w skali roku do 200 000 zł") + ", naliczane w miesiącach, w których wpływy na cele przewyższają obciążenia o min. 100 zł. Powyżej limitu 0,1%. Po 180 dniach według tabeli stóp.", "type": "other", "order": 7 if not young else 6},
                {"title": "Terminy wypłat: do końca lutego–lipca 2027 zależnie od miesiąca otwarcia", "description": "Premia I (oraz bonus III) wypłacana do 31.12.2026 dla rachunków otwartych w październiku, do 31.01.2027 dla listopada i do 28.02.2027 dla otwartych do 7.12.2026. Premia II oraz bonusy I i II: do 31.05.2027 / 30.06.2027 / 31.07.2027. Musisz być posiadaczem rachunku i karty do dnia wypłaty. Nagrody są zwolnione z podatku.", "type": "deadline", "order": 8 if not young else 7},
            ],
            "bonusParts": parts,
            "fees": fees,
        },
        "checklistSteps": steps,
    }
    assert total == 91000 if young else total == 101000, total
    write(f"data/candidates/mbank-{'ekonto-mozliwosci-18-24' if young else 'mkonto-intensive'}.json", d)


build("young")
build("intensive")
