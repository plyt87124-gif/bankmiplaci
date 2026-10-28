import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

REG = "https://www.bankmillennium.pl/delegate/managedfiles/146001/latest"
LP = "https://www.bankmillennium.pl/klienci-indywidualni/konta-osobiste/konto-millennium-360"

steps = open_steps(
    [
        "Złóż wniosek o Konto Millennium 360° z kartą debetową (online: mObywatel, selfie lub logowanie do innego banku; w aplikacji/Millenecie dla obecnych klientów bez konta osobistego; albo w placówce) od 28.10.2026 do 18.02.2027",
        "Przy wniosku wyraź zgody marketingowe i handlowe (kanały elektroniczne, telefon/IVR, firmy współpracujące) i utrzymaj je do wypłaty",
        "Zarejestruj numer telefonu w aplikacji do przelewów BLIK i nie wyrejestrowuj go przez 6 kolejnych miesięcy",
        "W ciągu 14 dni od otwarcia konta zasil konto wpływami min. 3 000 zł (18–25 lat: 1 500 zł)",
        "W ciągu 14 dni od otwarcia konta zapłać min. 5 razy w sklepach stacjonarnych portfelem wirtualnym (Apple Pay, Google Pay, Samsung Pay)",
    ],
    reward=("Odbierz premię I: 200 zł (wypłata do końca miesiąca po miesiącu otwarcia)", 20000),
)
for m in range(1, 7):
    b = m * 10
    lbl = "Miesiąc 1 (po otwarciu konta)" if m == 1 else f"Miesiąc {m}"
    steps += [
        {"order": b, "monthLabel": lbl, "title": "Zasil konto wpływami min. 3 000 zł (18–25 lat: 1 500 zł), bez przelewów z Twoich innych kont w banku, wpłat gotówki i kredytów"},
        {"order": b + 1, "monthLabel": lbl, "title": "Zapłać za towary i usługi min. 1 000 zł portfelem wirtualnym w sklepach stacjonarnych lub kartą w sklepach i internecie (bez BLIK, gotówki, waluty obcej)"},
        {"order": b + 2, "monthLabel": lbl, "title": "Utrzymaj zarejestrowany numer telefonu do przelewów BLIK"},
        {"order": b + 3, "monthLabel": lbl, "title": "Premia III: wpływ min. 3 000 zł (18–25 lat: 1 500 zł) ma pochodzić z wynagrodzenia lub świadczenia, w min. 5 z 6 miesięcy"},
    ]
steps.append({"order": 64, "monthLabel": "Miesiąc 6", "title": "Odbierz premie II i III: 300 zł + 300 zł (wypłata do końca 7. miesiąca po miesiącu otwarcia, np. konto z października: 31.05.2027)", "rewardCents": 60000})

d = {
    "_comment": "Bank Millennium — „Do 800 zł z kontem Millennium 360°” (28.10.2026–18.02.2027, limit 150 000 kont). Źródło: regulamin promocji (PDF, obowiązuje od 28.10.2026) + strona oferty. Następca „Do 700 zł na Twoje przyjemności” (do 27.10.2026). Katalog eBroker (oid 13498) opisuje ofertę jako „do 1000 zł” (800 zł + 200 zł za Konto 360° Junior) — Junior nie jest ujęty, brak regulaminu w czytanym dokumencie. Wypłaty II i III premii wg tabeli regulaminu (dla października 2026: 31.05.2027).",
    "bankSlug": "millennium", "ebrokerOid": "13498",
    "promotion": {
        "slug": "millennium-konto-360-do-800-zl",
        "name": "Konto Millennium 360°: do 800 zł",
        "accountType": "PERSONAL", "maxBonusCents": 80000, "difficulty": "MEDIUM", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-10-28", "endDate": "2027-02-18", "affiliateLinkEnabled": True,
        "sourceUrl": REG, "additionalSourceUrls": [LP],
        "lastVerifiedAt": "2026-10-28",
        "eligibleFor": "Pełnoletnie osoby z pełną zdolnością do czynności prawnych, z polskim obywatelstwem, PESEL i dowodem osobistym, które nie miały konta osobistego w Banku Millennium od 1.01.2023 do przystąpienia do promocji, mają telefon u polskiego operatora i niezastrzeżony PESEL.",
        "notEligibleFor": "Pracownicy banku oraz osoby z kontem osobistym w Millennium od 1.01.2023. Limit to 150 000 kont (promocja może skończyć się przed 18.02.2027). Przy koncie wspólnym każda premia przysługuje raz, a o progach decyduje wiek pierwszego właściciela.",
        "cooldownMonths": None, "cooldownCutoffDate": "2023-01-01",
        "summary": "Do 800 zł w trzech premiach: 200 zł za aktywność w 14 dni po otwarciu oraz 2 × 300 zł za 6 miesięcy wpływów i płatności (druga z wpływem z wynagrodzenia lub świadczenia). Wniosek do 18.02.2027.",
        "conditions": [
            {"title": "Otwórz Konto Millennium 360° z kartą debetową w okresie 28.10.2026–18.02.2027", "description": "Nowy klient: online (mObywatel, selfie albo logowanie do innego banku) lub w placówce. Obecny klient bez konta osobistego: w Millenecie lub aplikacji z komunikatu o promocji albo we wniosku o pożyczkę gotówkową online. Przy wniosku wyrażasz zgody marketingowe i handlowe i utrzymujesz je do wypłaty.", "type": "account_opening", "order": 0},
            {"title": "Premia I (200 zł): wpływ, 5 płatności portfelem i BLIK w 14 dni", "description": "W ciągu 14 dni od otwarcia konta: wpływy min. 3 000 zł (18–25 lat: 1 500 zł) na konto otwarte w promocji, min. 5 płatności w sklepach stacjonarnych portfelem wirtualnym i zarejestrowany numer telefonu do przelewów BLIK.", "type": "inflow", "order": 1},
            {"title": "Premia II (300 zł): wpływy i płatności przez 6 miesięcy", "description": "W każdym z 6 miesięcy po miesiącu otwarcia konta: wpływy min. 3 000 zł (18–25 lat: 1 500 zł), płatności min. 1 000 zł portfelem wirtualnym w sklepach stacjonarnych albo kartą w sklepach i internecie oraz zarejestrowany numer telefonu do BLIK. Nie liczą się BLIK, gotówka, waluty obce, wielowalutowość, hazard ani cashback.", "type": "card_payments", "order": 2},
            {"title": "Premia III (300 zł): wpływ z wynagrodzenia lub świadczenia", "description": "Warunki premii II oraz wpływ min. 3 000 zł (18–25 lat: 1 500 zł) pochodzący z wynagrodzenia lub świadczeń (nie od osób fizycznych, nie z własnych kont) w min. 5 z 6 miesięcy po miesiącu otwarcia konta.", "type": "inflow", "order": 3},
            {"title": "Terminy wypłat", "description": "Premię I bank wypłaca w miesiącu po miesiącu otwarcia (konto z października: 30.11.2026), premie II i III po 6 miesiącach (konto z października: 31.05.2027; z listopada: 30.06.2027; z grudnia: 31.07.2027; ze stycznia: 31.08.2027; z lutego: 30.09.2027). Warunek: nie odwołasz zgód i nie rozwiążesz umowy. Premie są zwolnione z PIT (art. 21 ust. 1 pkt 68), o ile nie dotyczą działalności gospodarczej.", "type": "deadline", "order": 4},
        ],
        "bonusParts": [
            {"label": "Premia I — 200 zł (aktywność w 14 dni od otwarcia)", "amountCents": 20000, "order": 0},
            {"label": "Premia II — 300 zł (wpływy i płatności przez 6 miesięcy)", "amountCents": 30000, "order": 1},
            {"label": "Premia III — 300 zł (wpływ z wynagrodzenia lub świadczenia w 5 z 6 miesięcy)", "amountCents": 30000, "order": 2},
        ],
        "fees": {
            "accountFeeCents": 0,
            "accountFeeWaiverCondition": None,
            "cardFeeCents": None,
            "cardFeeWaiverCondition": "min. 5 płatności kartą lub BLIKIEM w miesiącu (18–26 lat: 1 płatność)",
            "otherFee": "Prowadzenie konta Millennium 360° jest bezpłatne (strona oferty). Przy spełnieniu warunku płatności nie płacisz też za wypłaty z bankomatów i obsługę karty; stawka karty bez zwolnienia nie została odczytana z cennika — do sprawdzenia w Cenniku usług (karty debetowe).",
            "sourceUrl": LP,
        },
    },
    "checklistSteps": steps,
}
write("data/candidates/millennium-konto-360-do-800-zl.json", d)
