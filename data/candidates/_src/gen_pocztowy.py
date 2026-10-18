import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, month_steps, write

ACT = ["Zapewnij wpływ na konto min. 1000 zł (bez wpłat gotówki i przelewów własnych z Banku Pocztowego)",
       "Zapłać kartą za zakupy na łączną kwotę min. 400 zł (liczą się transakcje rozliczone w tym miesiącu)"]

steps = open_steps(
    ["Upewnij się, że od 1.01.2026 do 30.09.2026 nie miałeś(aś) konta w Banku Pocztowym",
     "Otwórz Konto w Porządku z kartą od 1.10.2026 do 31.01.2027 (podaj e-mail i telefon)",
     "Wyraź zgody marketingowe, nie wnoś sprzeciwu i złóż wniosek o korespondencję e-mail"],
)
steps += month_steps([1], ACT, "Odbierz zwrot 5% za zakupy kartą: do 120 zł (wypłata do 15. dnia następnego miesiąca)", 12000)
steps += month_steps(range(2, 13), ACT, "Odbierz zwrot 5% za zakupy kartą: do 80 zł (wypłata do 15. dnia następnego miesiąca)", 8000)

d = {
 "_comment": "Bank Pocztowy — „Kupujesz – zyskujesz edycja 2” (Konto w Porządku, 1.10.2026–31.01.2027). Źródło: regulamin promocji + strona promocji. Program „Polecenie ma znaczenie” (do 1000 zł za polecenia) i „Złap Bezcenne Chwile” (e-vouchery do 400 zł) to osobne programy — NIE wchodzą do kwoty. Kampania eBroker 13710.",
 "bankSlug": "bankpocztowy", "ebrokerOid": "13710",
 "promotion": {
  "slug": "bank-pocztowy-kupujesz-zyskujesz-edycja-2-do-1000-zl",
  "name": "Konto w Porządku: do 1000 zł zwrotu za zakupy kartą (edycja 2)",
  "accountType": "PERSONAL", "maxBonusCents": 100000, "difficulty": "MEDIUM", "rating": 7.0, "status": "DRAFT",
  "startDate": "2026-10-01", "endDate": "2027-01-31", "affiliateLinkEnabled": True,
  "sourceUrl": "https://pocztowy.pl/pdf/promocje/2026/Regulamin-Promocji-Kupujesz-Zyskujesz-edycja-2.pdf",
  "additionalSourceUrls": ["https://pocztowy.pl/lp/promocje-do-konta-af",
                           "https://pocztowy.pl/pdf/promocje/2026/Regulamin-programu-Polecenie-ma-znaczenie-edycja-2.pdf",
                           "https://pocztowy.pl/pdf/promocje/2026/Regulamin-Zlap-Bezcenne-Chwile-Pocztowy.pdf"],
  "lastVerifiedAt": "2026-10-07",
  "eligibleFor": "Osoby z pełną zdolnością do czynności prawnych, które od 1.01.2026 do 30.09.2026 nie miały i nie były współposiadaczem konta w Banku Pocztowym. Wariant ceny zależy od wieku: Konto w Porządku (od 26 lat) lub Konto w Porządku Start (13–25 lat). Możesz przystąpić dwa razy: raz jako samodzielny posiadacz i raz jako współposiadacz konta wspólnego.",
  "notEligibleFor": "Osoby, które w okresie 1.01–30.09.2026 miały konto (także wspólne) w Banku Pocztowym. Nagroda nie przysługuje, jeśli w dniu wypłaty konto jest zamknięte lub wypowiedziane, ma zajęcie komornicze albo karta jest zastrzeżona bez wydanej nowej.",
  "cooldownMonths": None, "cooldownCutoffDate": "2026-01-01",
  "summary": "Do 1000 zł: zwrot 5% z płatności kartą co miesiąc przez 12 miesięcy (maks. 120 zł w pierwszym miesiącu i 80 zł w każdym z kolejnych), jeśli wpływy na konto to min. 1000 zł, a zakupy kartą min. 400 zł.",
  "conditions": [
   {"title": "Otwórz Konto w Porządku z kartą w okresie 1.10.2026–31.01.2027", "description": "Konto z kartą otwierasz online lub u doradcy. We wniosku podajesz poprawny e-mail i numer telefonu. Warunek wstępny: od 1.01.2026 do 30.09.2026 nie miałeś(aś) konta w Banku Pocztowym.", "type": "account_opening", "order": 0},
   {"title": "Wyraź zgody marketingowe i złóż wniosek o korespondencję e-mail", "description": "Zgody na informacje handlowe telefonicznie, SMS/MMS/e-mail, w bankowości internetowej i mobilnej oraz od firm współpracujących; brak sprzeciwu wobec marketingu bezpośredniego; wniosek o przesyłanie informacji o umowie i zmianach pocztą elektroniczną. Zgód nie odwołuj do wypłaty nagrody.", "type": "other", "order": 1},
   {"title": "Co miesiąc: wpływ na konto min. 1000 zł", "description": "Może to być wynagrodzenie, przelew z innego banku lub świadczenie z innej instytucji. Nie liczą się wpłaty gotówki ani przelewy wewnętrzne z innych rachunków w Banku (lokaty, kredyty, odsetki). Przy koncie wspólnym wystarczy, że warunek spełni jedna osoba.", "type": "inflow", "order": 2},
   {"title": "Co miesiąc: płatności kartą na łączną kwotę min. 400 zł", "description": "Liczą się tylko transakcje bezgotówkowe rozliczone na rachunku w danym miesiącu. Nie liczy się cashback ani wybrane transakcje wyłączone w regulaminie.", "type": "card_payments", "order": 3},
   {"title": "Nagroda: 5% zwrotu z płatności kartą, do 1000 zł w 12 miesięcy", "description": "Maks. 120 zł za pierwszy miesiąc po miesiącu otwarcia konta i maks. 80 zł za każdy z kolejnych 11 miesięcy (łącznie do 1000 zł). Wypłata do 15. dnia następnego miesiąca. Miesiąc bez spełnienia warunków nie kończy promocji, ale tej nagrody nie odzyskasz. Nagrody są zwolnione z podatku.", "type": "deadline", "order": 4}
  ],
  "bonusParts": [
   {"label": "Zwrot 5% za pierwszy miesiąc po otwarciu konta — do 120 zł", "amountCents": 12000, "order": 0},
   {"label": "Zwrot 5% za każdy z kolejnych 11 miesięcy — do 80 zł miesięcznie (łącznie 880 zł)", "amountCents": 88000, "order": 1}
  ],
  "fees": {
   "accountFeeCents": 0,
   "cardFeeCents": 750,
   "cardFeeWaiverCondition": "suma transakcji bezgotówkowych kartą w danym miesiącu kalendarzowym min. 400 zł",
   "otherFee": "Według Dokumentu dotyczącego opłat (2.01.2026) i Taryfy opłat i prowizji (od 13.08.2026): prowadzenie Konta w Porządku 0 zł, obsługa karty debetowej 7,50 zł miesięcznie, bez opłaty przy płatnościach kartą min. 400 zł. Konto w Porządku jest dla osób od 26 lat; osoby 13–25 lat mają wariant Konto w Porządku Start (karta 0 zł).",
   "sourceUrl": "https://www.pocztowy.pl/pdf/konta/2026/taryfaDETAL08-2026.pdf"
  }
 },
 "checklistSteps": steps
}
write("data/candidates/bank-pocztowy-kupujesz-zyskujesz-2.json", d)
