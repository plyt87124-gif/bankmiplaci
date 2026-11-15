import sys
sys.path.insert(0, "data/candidates/_src")
from lib import open_steps, month_steps, write

# Alior Bank — edycja II sprzedaży premiowych „Alior Konto Plus z premią II” i „Alior Konto z premią II”
# (14.10.2026–11.01.2027, kod PREMIA800). Oba regulaminy mają identyczne nagrody i warunki; różni się tylko konto.
# Źródła: regulaminy edycji II (strona konto.aliorbank.pl i landing z linku eBroker 13536) + TOiP od 1.06.2026.

REG_PLUS = "https://www.aliorbank.pl/dam/jcr:de110fc5-77f3-4615-857c-57a7cb1f8edf/regulamin-sprzedazy-premiowej-alior-konto-plus-z-premia-edycja-2.pdf"
REG_KONTO = "https://www.aliorbank.pl/dam/jcr:c9730a76-1843-4c2d-82ad-e05c6c8f7c51/regulamin-sprzedazy-premiowej-alior-konto-z-premia-edycja-2.pdf"
TOIP = "https://www.aliorbank.pl/dam/jcr:2c557a27-9d52-4c66-8fb5-f2652658e43e/toip-konta-osobiste.pdf"

ACT = ["Wykonaj 3 transakcje kartą lub BLIKIEM (dowolna kwota)",
       "Zapewnij jednorazowy wpływ min. 1000 zł z innego banku lub z konta biznesowego w Alior Banku",
       "Zaloguj się co najmniej raz do aplikacji Alior Mobile"]


def build(product, slug, name, oid, reg, landing, fees, extra_comment=""):
    steps = open_steps(
        [f"Złóż wniosek o {product} z kartą (strona banku, Alior Online lub Alior Mobile) — wariant indywidualny",
         "Wpisz kod promocji PREMIA800 we wniosku",
         "Wyraź zgody marketingowe (elektroniczne i telefoniczne) i nie wycofuj ich do wypłaty nagród",
         "Zawrzyj umowę o konto i kartę do 11.01.2027",
         "W ciągu 10 dni od zawarcia umów dodaj kartę do portfela cyfrowego (Google Pay, Apple Pay, Garmin Pay) i zapłać nią co najmniej raz"],
        reward=("Odbierz nagrodę na start I stopnia: 200 zł + kod na obrączkę płatniczą (do końca następnego miesiąca)", 20000),
    )
    steps += month_steps([1], ACT, "Odbierz nagrodę II stopnia: 200 zł (do końca następnego miesiąca)", 20000)
    steps += month_steps([2, 3, 4, 5], ACT, "Odbierz nagrodę III stopnia: 100 zł (do końca następnego miesiąca)", 10000)
    return {
     "_comment": f"Alior Bank — Sprzedaż premiowa „{product} z premią II” (kod PREMIA800, 14.10.2026–11.01.2027). Nowa edycja po „{product} z Premią” (13.07–13.10.2026); poprzednia promocja zostaje jako zakończona. Zmiana względem ed. I: nagroda I stopnia wymaga dodania karty do portfela cyfrowego i transakcji w 10 dni od zawarcia umów. Obrączka płatnicza (wartość 500 zł) to nagroda rzeczowa i NIE wchodzi do kwoty gotówkowej. Kampania eBroker {oid}.{extra_comment}",
     "bankSlug": "alior", "ebrokerOid": oid,
     "promotion": {
      "slug": slug,
      "name": name,
      "accountType": "PERSONAL", "maxBonusCents": 80000, "difficulty": "EASY", "rating": 7.0, "status": "DRAFT",
      "startDate": "2026-10-14", "endDate": "2027-01-11", "affiliateLinkEnabled": True,
      "sourceUrl": reg,
      "additionalSourceUrls": [landing, TOIP],
      "lastVerifiedAt": "2026-10-18",
      "eligibleFor": "Pełnoletnie osoby (konsumenci), które w ciągu 3 lat przed złożeniem wniosku o konto i kartę nie miały w Alior Banku rachunku oszczędnościowo-rozliczeniowego (konta osobistego). Konto oszczędnościowe, firmowe, walutowe, oszczędnościowe walutowe lub karta kibica nie wykluczają z udziału.",
      "notEligibleFor": f"Osoby, które w ostatnich 3 latach miały w Alior Banku konto osobiste. Tylko {product} w wariancie indywidualnym (jedyny posiadacz). Z promocji można skorzystać tylko raz. Nie łączy się z innymi promocjami i sprzedażami premiowymi do Alior Konta i Alior Konta Plus, chyba że ich regulaminy stanowią inaczej. Bank może zakończyć sprzedaż wcześniej, jeśli skończy się pula nagród (informacja 3 dni wcześniej).",
      "cooldownMonths": 36, "cooldownCutoffDate": None,
      "summary": f"Do 800 zł premii (200 zł na start, 200 zł za pierwszy miesiąc aktywności i 4 × 100 zł) oraz obrączka płatnicza o wartości 500 zł za {product} z kodem PREMIA800. Oferta do 11.01.2027.",
      "conditions": [
       {"title": f"Złóż wniosek i zawrzyj umowę o {product} z kartą w okresie 14.10.2026–11.01.2027", "description": "Wniosek o umowę o konto wraz z umową o kartę debetową składasz na stronie banku, w Alior Online albo w Alior Mobile, a umowy musisz zawrzeć w tym samym okresie. Konto w wariancie indywidualnym (jeden posiadacz).", "type": "account_opening", "order": 0},
       {"title": "Wpisz kod promocji PREMIA800 we wniosku", "description": "Rejestracja do sprzedaży premiowej następuje przez wpisanie kodu we wniosku. Z promocji można skorzystać tylko raz.", "type": "other", "order": 1},
       {"title": "Wyraź zgody marketingowe i nie wycofuj ich do wypłaty nagród", "description": "Zgoda na przetwarzanie danych do marketingu bezpośredniego oraz na informacje marketingowe (e-mail, SMS/MMS, bankowość elektroniczna, serwisy internetowe i połączenia głosowe). Odwołanie zgód albo wypowiedzenie lub odstąpienie od umów przed wypłatą nagród oznacza ich utratę.", "type": "other", "order": 2},
       {"title": "Nagroda na start I stopnia: 200 zł + obrączka płatnicza", "description": "W ciągu 10 dni od zawarcia umów dodaj kartę do portfela cyfrowego (np. Google Pay, Apple Pay, Garmin Pay) i wykonaj nią co najmniej jedną transakcję. Bank przekaże 200 zł i SMS z kodem na bezpłatną obrączkę płatniczą (ważny 14 dni, odbiór na gotapster.com/alior) do końca miesiąca następującego po spełnieniu warunku. Obrączka jest nagrodą rzeczową o wartości 500 zł, bez wypłaty gotówką.", "type": "card_payments", "order": 3},
       {"title": "Nagroda II stopnia: 200 zł za pierwszy miesiąc po otwarciu", "description": "W miesiącu następującym po miesiącu zawarcia umów: 3 transakcje kartą lub BLIKIEM, jednorazowy wpływ min. 1000 zł z innego banku lub z konta biznesowego w Alior Banku (przelewy z Kantoru Walutowego Alior Banku się nie liczą) oraz co najmniej jedno logowanie do Alior Mobile. Wyłączone transakcje w punktach z kodami MCC 7995, 8999 (zagraniczne), 4111, 6012, 6211, 6051, 4829, 4900.", "type": "card_payments", "order": 4},
       {"title": "Nagrody III stopnia: 4 × 100 zł za kolejne 4 miesiące", "description": "W każdym z 4 kolejnych miesięcy (od drugiego miesiąca po miesiącu zawarcia umów) te same warunki: 3 transakcje, wpływ min. 1000 zł, logowanie do aplikacji. Nagroda za dany miesiąc do końca miesiąca następującego po nim.", "type": "inflow", "order": 5}
      ],
      "bonusParts": [
       {"label": "Nagroda na start I stopnia — 200 zł (+ obrączka płatnicza, nagroda rzeczowa)", "amountCents": 20000, "order": 0},
       {"label": "Nagroda II stopnia — 200 zł", "amountCents": 20000, "order": 1},
       {"label": "Nagrody III stopnia — 4 × 100 zł", "amountCents": 40000, "order": 2}
      ],
      "fees": fees,
     },
     "checklistSteps": steps,
    }


fees_plus = {
 "accountFeeCents": 1200,
 "accountFeeWaiverCondition": "brak opłaty w miesiącu otwarcia i do miesiąca 26. urodzin; potem: wpływy min. 3000 zł w miesiącu i min. 5 transakcji bezgotówkowych kartą lub BLIKIEM",
 "cardFeeCents": 600,
 "cardFeeWaiverCondition": "brak opłaty w miesiącu wydania karty i do miesiąca 26. urodzin; potem: wpływy min. 3000 zł w miesiącu i min. 5 transakcji bezgotówkowych kartą lub BLIKIEM",
 "otherFee": "Dwie korzyści do konta są bezpłatne, każda kolejna 5 zł miesięcznie. Stawki z Taryfy Opłat i Prowizji obowiązującej od 1.06.2026.",
 "sourceUrl": TOIP,
}
fees_konto = {
 "accountFeeCents": 0,
 "accountFeeWaiverCondition": None,
 "cardFeeCents": 700,
 "cardFeeWaiverCondition": "brak opłaty w miesiącu wydania karty; potem min. 5 transakcji bezgotówkowych kartą lub BLIKIEM w miesiącu (przelewy na telefon BLIK się nie liczą)",
 "otherFee": "Stawki dla Alior Konta otwieranego od 15.01.2026 z Taryfy Opłat i Prowizji obowiązującej od 1.06.2026.",
 "sourceUrl": TOIP,
}

write("data/candidates/alior-konto-plus-z-premia-ii.json",
      build("Alior Konto Plus", "alior-konto-plus-z-premia-ii", "Alior Konto Plus z premią II: do 800 zł + obrączka płatnicza", "13748", REG_PLUS, "https://konto.aliorbank.pl/", fees_plus))
write("data/candidates/alior-konto-z-premia-ii.json",
      build("Alior Konto", "alior-konto-z-premia-ii", "Alior Konto z premią II: do 800 zł + obrączka płatnicza", "13536", REG_KONTO, "https://konto-internetowe.aliorbank.pl/un/", fees_konto))
