import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

SRC = "https://www.pekao.com.pl/dam/ROOT-EXTERNAL/DOCS/Regulamin_promocji_Otworz_konto_firmowe_lub_firme_z_kontem_firmowym.pdf"

steps = open_steps([
    "Otwórz Konto Biznes z Żubrem (lub Plus) z kartą w okresie 1.09–31.12.2026 albo załóż firmę z kontem jednym wnioskiem (online może otworzyć tylko JDG)",
    "Wyraź zgody marketingowe i handlowe (kanały elektroniczne, telefon, spółki z grupy) i zaakceptuj regulamin promocji",
    "Opcjonalnie w okresie promocji: zawrzyj umowę o terminal płatniczy banku",
    "Opcjonalnie w okresie promocji: zawrzyj pierwszą umowę o kredyt/pożyczkę (min. 100 000 zł), leasing z Pekao Leasing lub faktoring z Pekao Faktoring",
])
for m in range(1, 11):
    base = m * 10
    lbl = "Miesiąc 1 (po otwarciu konta)" if m == 1 else f"Miesiąc {m}"
    steps += [
        {"order": base, "monthLabel": lbl, "title": "Wykonaj przelew do ZUS na min. 300 zł z konta otwartego w promocji"},
        {"order": base + 1, "monthLabel": lbl, "title": "Zapłać kartą lub telefonem/zegarkiem (Google Pay, Garmin Pay, Apple Pay) na łączną kwotę min. 1000 zł"},
        {"order": base + 2, "monthLabel": lbl, "title": "Opcjonalnie: przyjmij terminalem banku płatności na min. 1000 zł"},
    ]
    if m <= 2:
        steps.append({"order": base + 3, "monthLabel": lbl, "title": "Odbierz premię za otwarcie konta: 100 zł (do końca następnego miesiąca)", "rewardCents": 10000})
    steps.append({"order": base + 4, "monthLabel": lbl, "title": "Odbierz zwrot 4% za transakcje: min. 40 zł, do 240 zł (do końca następnego miesiąca)", "rewardCents": 24000})
    steps.append({"order": base + 5, "monthLabel": lbl, "title": "Odbierz premię za terminal: 120 zł (do końca następnego miesiąca)", "rewardCents": 12000})
steps.append({"order": 106, "monthLabel": "Miesiąc 10", "title": "Opcjonalnie: odbierz premię 1200 zł za pierwszy kredyt/leasing/faktoring (po spełnieniu warunków, do końca miesiąca po okresie promocji)", "rewardCents": 120000})

d = {
    "_comment": "Pekao — „Otwórz konto firmowe lub firmę z kontem firmowym i zyskaj do 5 000 zł” (Konto Biznes z Żubrem, 1.09–31.12.2026). Źródło: regulamin promocji + strona oferty. Następca promocji „do 4200 zł” (do 31.08.2026). Kampania eBroker 11393 (duplikat kanału: 10943). Stawki bez zwolnienia za konto i kartę nie są podane na stronie oferty — pola kwot zostawione puste.",
    "bankSlug": "pekao", "ebrokerOid": "11393",
    "promotion": {
        "slug": "pekao-konto-biznes-z-zubrem-premia-do-5000-zl",
        "name": "Konto Biznes z Żubrem: premia do 5000 zł",
        "accountType": "BUSINESS", "maxBonusCents": 500000, "difficulty": "MEDIUM", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-09-01", "endDate": "2026-12-31", "affiliateLinkEnabled": True,
        "sourceUrl": SRC,
        "additionalSourceUrls": ["https://www.pekao.com.pl/konto-firmowe/", "https://www.pekao.com.pl/dam/ROOT-EXTERNAL/DOCS/Regulamin_Promocji_na_Koncie_Oszczednosciowym_Biznes.pdf"],
        "lastVerifiedAt": "2026-10-07",
        "eligibleFor": "Osoby prowadzące jednoosobową działalność, wspólnicy spółek cywilnych i jawnych (przychody do 2,5 mln euro) oraz spółki z o.o. (przychody do 5 mln zł), rezydenci prowadzący działalność w Polsce, którzy od 1.09.2024 do przystąpienia nie mieli w banku rachunku do działalności gospodarczej. Konto online otwierają tylko jednoosobowe działalności.",
        "notEligibleFor": "Podmioty, które od 1.09.2024 miały w Banku Pekao rachunek firmowy. Spółki powyżej limitów przychodów. Nagrody są przychodem z działalności — sprawdź ich rozliczenie podatkowe.",
        "cooldownMonths": None, "cooldownCutoffDate": "2024-09-01",
        "summary": "Do 5000 zł dla firm: 200 zł za konto i ZUS, do 2400 zł (4%) zwrotu za płatności kartą, do 1200 zł za terminal i 1200 zł za pierwszy kredyt, leasing lub faktoring. Wniosek do 31.12.2026.",
        "conditions": [
            {"title": "Otwórz Konto Biznes z Żubrem (lub Plus) z kartą w okresie 1.09–31.12.2026", "description": "Albo załóż firmę z kontem i kartą jednym wnioskiem. Wyrażasz zgody marketingowe i handlowe (kanały elektroniczne, telefon, spółki z grupy kapitałowej), zgodę na przetwarzanie danych i oświadczasz o przystąpieniu do promocji.", "type": "account_opening", "order": 0},
            {"title": "Do 200 zł za otwarcie: 2 × 100 zł za przelew do ZUS na min. 300 zł", "description": "Przelew do ZUS z konta na min. 300 zł w każdym z 2 kolejnych miesięcy po miesiącu zawarcia umowy o konto. 100 zł za każdy miesiąc.", "type": "other", "order": 1},
            {"title": "Do 2400 zł: 4% zwrotu za transakcje kartą (min. 40 zł, max. 240 zł miesięcznie, 10 miesięcy)", "description": "W każdym z 10 miesięcy od pierwszego pełnego miesiąca po otwarciu: transakcje kartą lub telefonem/zegarkiem (Google Pay, Garmin Pay, Apple Pay) na min. 1000 zł oraz przelew do ZUS na min. 300 zł.", "type": "card_payments", "order": 2},
            {"title": "Do 1200 zł (120 zł miesięcznie) za terminal płatniczy banku", "description": "Umowa o terminal płatniczy banku w okresie promocji; w każdym z 10 miesięcy przyjęcie terminalem płatności na min. 1000 zł oraz przelew do ZUS na min. 300 zł z konta.", "type": "inflow", "order": 3},
            {"title": "1200 zł jednorazowo za pierwszy kredyt, pożyczkę, leasing lub faktoring", "description": "W okresie promocji zawierasz umowę o kredyt lub pożyczkę w banku (uruchomienie min. 100 000 zł na działalność, bez zaległości), leasing z Pekao Leasing (min. 1 przelew raty) albo faktoring z Pekao Faktoring (min. 2 uznania z wykupu wierzytelności), plus przelew do ZUS min. 300 zł z konta. Nagroda tylko raz.", "type": "other", "order": 4},
            {"title": "Terminy wypłat", "description": "Nagrody za konto, zwrot 4% i terminal wypłacane do końca następnego miesiąca po miesiącu spełnienia warunków; premia za kredyt/leasing/faktoring do końca następnego miesiąca po okresie trwania promocji.", "type": "deadline", "order": 5},
        ],
        "bonusParts": [
            {"label": "Za otwarcie konta i przelewy do ZUS — 2 × 100 zł", "amountCents": 20000, "order": 0},
            {"label": "Zwrot 4% za transakcje kartą — do 2400 zł (10 × do 240 zł)", "amountCents": 240000, "order": 1},
            {"label": "Za terminal płatniczy — do 1200 zł (10 × 120 zł)", "amountCents": 120000, "order": 2},
            {"label": "Za pierwszy kredyt, pożyczkę, leasing lub faktoring — 1200 zł jednorazowo", "amountCents": 120000, "order": 3},
        ],
        "fees": {
            "accountFeeCents": 1500,
            "accountFeeWaiverCondition": "w danym miesiącu wpływ min. 2000 zł lub min. 1 przelew do ZUS oraz utrzymane zgody marketingowe",
            "cardFeeCents": 1200,
            "cardFeeWaiverCondition": "transakcje bezgotówkowe na min. 500 zł miesięcznie",
            "otherFee": "Według strony oferty: 0 zł za prowadzenie Konta Biznes z Żubrem przy spełnieniu warunków, 0 zł za kartę przy transakcjach na min. 500 zł miesięcznie, 50 pierwszych przelewów krajowych w PeoPay za 0 zł (Plus), konta pomocnicze w 17 walutach 0 zł. Opłata miesięczna za prowadzenie rachunku bez spełnienia warunków to 15 zł, za kartę 12 zł (strona oferty).",
            "sourceUrl": "https://www.pekao.com.pl/konto-firmowe/",
        },
    },
    "checklistSteps": steps,
}
write("data/candidates/pekao-konto-biznes-zubr-5000.json", d)
