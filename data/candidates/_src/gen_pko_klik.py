import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, write

steps = open_steps([
    "Otwórz PKO Konto za Zero (online z weryfikacją mObywatelem, na selfie albo w placówce) i pobierz aplikację IKO — lub miej już konto osobiste w PKO BP",
    "W IKO wejdź w Zarządzaj → Cashback z Allegro Klik, wybierz konto, zaakceptuj oświadczenia i regulaminy (przystąp do programu do 19.11.2026)",
    "Dokończ aktywację w aplikacji Allegro i nadaj PIN do płatności Allegro Klik",
    "Opcjonalnie: w ciągu 30 dni od aktywacji kup Allegro Smart! na 6 miesięcy za 1 zł (promocja do 31.01.2027)",
])
for m in range(1, 13):
    base = m * 10
    lbl = "Miesiąc 1 (po otwarciu konta)" if m == 1 else f"Miesiąc {m}"
    steps += [
        {"order": base, "monthLabel": lbl, "title": "Płać za zakupy na Allegro metodą Allegro Klik (cashback 1% za połączenie)"},
        {"order": base + 1, "monthLabel": lbl, "title": "Opcjonalnie: zapewnij wpływy min. 2000 zł na konto (dodatkowy 1% cashbacku za wpływy) i kupuj promocyjne oferty oznaczone na Allegro (do 25.10.2026: 10%)"},
        {"order": base + 2, "monthLabel": lbl, "title": "Odbierz cashback: do 100 zł miesięcznie (limit łączny, wypłata na konto osobiste najpóźniej następnego dnia po zakupach)", "rewardCents": 10000},
    ]

d = {
    "_comment": "PKO BP — PKO Konto za Zero + Allegro Klik (program Cashback, edycja II; przystąpienie do 19.11.2026; promocja „Podkręcamy cashback z Allegro Klik 2” 21.09–25.10.2026: 10% na oznaczone produkty). To cashback za zakupy na Allegro, nie premia za otwarcie konta — maks. 100 zł miesięcznie przez 12 miesięcy. Kampania eBroker 13756. Kampania 8629 („do 900 zł”) sprawdzona osobno.",
    "bankSlug": "pko", "ebrokerOid": "13756",
    "promotion": {
        "slug": "pko-konto-za-zero-allegro-klik-cashback-do-1200-zl",
        "name": "PKO Konto za Zero + Allegro Klik: cashback do 1200 zł",
        "accountType": "PERSONAL", "maxBonusCents": 120000, "difficulty": "EASY", "rating": 7.0, "status": "DRAFT",
        "startDate": "2026-07-01", "endDate": "2026-11-19", "affiliateLinkEnabled": True,
        "sourceUrl": "https://www.pkobp.pl/api/public/e1e16fd6-dec7-41ce-95fb-615c8492dff6.pdf",
        "additionalSourceUrls": [
            "https://www.pkobp.pl/api/public/cc64dd7f-6964-4e3a-98ff-65dd73d5208b.pdf",
            "https://www.pkobp.pl/api/public/88c2d8ef-aef0-487f-8b56-1ee43df8b935.pdf",
            "https://www.pkobp.pl/k/allegroklik-dolacz-do-nas-pp"],
        "lastVerifiedAt": "2026-10-07",
        "eligibleFor": "Osoby z kontem osobistym w PKO Banku Polskim (nowe lub obecne), które połączą konto z kontem Allegro i przystąpią do programu Cashback w okresie obowiązywania Warunków cashback edycji II (1.07–19.11.2026). Prawo do cashbacku trwa 12 miesięcy od pierwszego połączenia.",
        "notEligibleFor": "Cashback nie obejmuje części grup produktów na Allegro (lista wyłączeń w Warunkach cashback). Na koncie wspólnym obowiązują osobne zasady. Limit cashbacku to 100 zł miesięcznie łącznie (podstawowy i promocyjny).",
        "cooldownMonths": None, "cooldownCutoffDate": None,
        "summary": "Cashback za zakupy na Allegro płacone Allegro Klik: do 100 zł miesięcznie przez 12 miesięcy (do 1200 zł). Podstawowo do 3% (1% za połączenie + 1% za wpływy 2000 zł + 1% za produkt PKO), do 25.10.2026 aż 10% na oznaczone oferty.",
        "conditions": [
            {"title": "Miej PKO Konto za Zero połączone z kontem Allegro i przystąp do programu do 19.11.2026", "description": "W aplikacji IKO: Zarządzaj → Cashback z Allegro Klik, akceptacja oświadczeń i regulaminów, dokończenie aktywacji w aplikacji Allegro i nadanie PIN-u do płatności Allegro Klik. Konto Za Zero otwierasz online (mObywatel, selfie) albo w placówce.", "type": "account_opening", "order": 0},
            {"title": "Płać za zakupy na Allegro metodą Allegro Klik", "description": "Cashback 1% za połączenie naliczany od zakupów opłaconych Allegro Klik; dodatkowe 1% za wpływy min. 2000 zł w miesiącu na połączone konto (w następnym miesiącu) i 1% za produkt PKO zawarty po połączeniu (pożyczka gotówkowa, karta kredytowa, ubezpieczenia PKO, limit odnawialny).", "type": "card_payments", "order": 1},
            {"title": "Promocja „Podkręcamy cashback z Allegro Klik 2”: 10% na oznaczone oferty do 25.10.2026", "description": "Za produkty oznaczone na Allegro jako oferty promocyjne (kampania auto_discount) opłacone Allegro Klik bank zwraca 10% wartości zakupu. Pula promocji to 400 tys. zł cashbacku; bank może ją zakończyć wcześniej.", "type": "other", "order": 2},
            {"title": "Limit 100 zł miesięcznie przez 12 miesięcy i zwrot na konto", "description": "Łączny cashback (podstawowy i promocyjny) to maksymalnie 100 zł w miesiącu kalendarzowym, przez 12 miesięcy od pierwszego połączenia (do 1200 zł). Zwrot trafia na konto osobiste najpóźniej następnego dnia po zakupach.", "type": "deadline", "order": 3},
            {"title": "Allegro Smart! na 6 miesięcy za 1 zł", "description": "Opcjonalnie: kup usługę Allegro Smart! za 1 zł w ciągu 30 dni od aktywacji Allegro Klik (promocja Allegro do 31.01.2027). Darmowa dostawa i zwroty przez 6 miesięcy.", "type": "other", "order": 4},
        ],
        "bonusParts": [
            {"label": "Cashback za zakupy na Allegro z Allegro Klik — do 100 zł miesięcznie przez 12 miesięcy", "amountCents": 120000, "order": 0},
        ],
        "fees": {
            "accountFeeCents": 0,
            "cardFeeCents": 1000,
            "cardFeeWaiverCondition": "min. 5 transakcji bezgotówkowych kartą lub BLIKIEM w okresie rozliczeniowym karty",
            "otherFee": "Według strony oferty: prowadzenie PKO Konta za Zero 0 zł miesięcznie, debet do 1000 zł bez odsetek przez 30 dni (opłata 5 zł). Karta do konta 10 zł miesięcznie, 0 zł przy min. 5 transakcjach bezgotówkowych kartą lub BLIKIEM w okresie rozliczeniowym karty (strona PKO Konta za Zero).",
            "sourceUrl": "https://www.pkobp.pl/klient-indywidualny/konta/konto-za-zero",
        },
    },
    "checklistSteps": steps,
}
write("data/candidates/pko-konto-za-zero-allegro-klik.json", d)
