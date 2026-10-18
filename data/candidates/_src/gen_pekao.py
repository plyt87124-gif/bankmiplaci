import json
J = "2026-10-31"
d = {
 "_comment": "Pekao — Konto Przekorzystne: „Otwórz konto online i ruszaj po więcej – edycja IV” (do 300 zł, przystąpienie do 31.10.2026) + „Promocja Podróżna III” (do 2400 zł, do 12.01.2027 lub 40 000 kont). Źródła: strona oferty pekao.com.pl/konto i regulaminy PDF. UWAGA: PDF regulaminu edycji IV jest uszkodzony (zniekształcony tekst) — kwoty i terminy tej edycji zweryfikowane ze strony oferty; pełne brzmienie warunków dla nowych klientów do sprawdzenia ręcznie. Kampania eBroker 10857 (duplikaty kanałów: 11335, 12423).",
 "bankSlug": "pekao", "ebrokerOid": "10857",
 "promotion": {
  "slug": "pekao-konto-przekorzystne-300-zl-i-promocja-podrozna-iii",
  "name": "Konto Przekorzystne: do 300 zł + do 2400 zł w Promocji Podróżnej III",
  "accountType": "PERSONAL", "maxBonusCents": 270000, "difficulty": "EASY", "rating": 7.0, "status": "DRAFT",
  "startDate": "2026-10-01", "endDate": "2027-01-12", "affiliateLinkEnabled": True,
  "sourceUrl": "https://www.pekao.com.pl/dam/ROOT-EXTERNAL/DOCS/Promocja_Podrozna_regulamin.pdf",
  "additionalSourceUrls": [
   "https://www.pekao.com.pl/dam/ROOT-EXTERNAL/DOCS/Regulamin_promocji_Otworz_konto_online_i_ruszaj_po_wiecej.pdf",
   "https://www.pekao.com.pl/konto"],
  "lastVerifiedAt": "2026-10-07",
  "eligibleFor": "Pełnoletnie osoby mieszkające w Polsce (konsumenci), które w okresie od 1.10.2024 do 30.09.2026 nie miały z Bankiem Pekao żadnej umowy o produkty i usługi (warunek Promocji Podróżnej III). Konto osobiste indywidualne z kartą zakładasz online na pekao.com.pl/konto (weryfikacja AIS lub selfie), w aplikacji PeoPay (selfie), w oddziale lub w placówce partnerskiej.",
  "notEligibleFor": "Osoby, które od 1.10.2024 miały w banku jakąkolwiek umowę o produkty i usługi (Promocja Podróżna III); konta wspólne nie biorą udziału w Promocji Podróżnej. W promocji można otworzyć tylko jedno konto. Pula Promocji Podróżnej III to 40 000 otwartych kont. Po rezygnacji z promocji nie można do niej wrócić.",
  "cooldownMonths": None, "cooldownCutoffDate": "2024-10-01",
  "summary": "Do 300 zł za otwarcie Konta Przekorzystnego online i 10 transakcji miesięcznie (do 31.10.2026) oraz do 2400 zł zwrotu: 20% wydatków podróżnych (paliwo, bilety, wycieczki) przez 12 miesięcy w Promocji Podróżnej III.",
  "conditions": [
   {"title": "Otwórz Konto Przekorzystne online z kartą, PeoPay i Pekao24", "description": "W jednym dniu zawierasz umowę konta z kartą debetową, wnioskujesz o Pekao24 i aplikację PeoPay, składasz oświadczenia i zgody marketingowe oraz zgadzasz się na przetwarzanie danych w promocji. Online na pekao.com.pl/konto (weryfikacja AIS lub selfie), w PeoPay na selfie albo w oddziale lub placówce partnerskiej.", "type": "account_opening", "order": 0},
   {"title": "Jesteś nowym klientem banku", "description": "Promocja Podróżna III: od 1.10.2024 do 30.09.2026 nie miałeś/aś z bankiem żadnej umowy o produkty i usługi. Konto indywidualne (nie wspólne), jedno konto w promocji.", "type": "other", "order": 1},
   {"title": "Do 300 zł (edycja IV): 100 zł za otwarcie online i pierwszą transakcję kartą", "description": "Przystąpienie do 31.10.2026. Po otwarciu konta online zalogowanie do Pekao24 lub PeoPay, zgody marketingowe i w ciągu 14 dni od otwarcia konta min. 1 transakcja bezgotówkowa kartą do tego konta. 100 zł wpłynie najpóźniej 15.12.2026 (umowa z października).", "type": "card_payments", "order": 2},
   {"title": "Do 300 zł (edycja IV): 2 × 100 zł za 10 transakcji kartą w dwóch miesiącach", "description": "Min. 10 transakcji bezgotówkowych kartą do Konta Przekorzystnego w każdym z 2 miesięcy kalendarzowych po miesiącu otwarcia konta (dla umowy z października: listopad i grudzień 2026). Nie liczą się m.in. płatności BLIK, wypłaty z bankomatów i przekazy pieniężne. Nagrody do 15.01.2027 i 15.02.2027.", "type": "card_payments", "order": 3},
   {"title": "Promocja Podróżna III: zwroty 3% i 6% w wirtualnym portfelu zwrotów", "description": "Przez 12 miesięcy od otwarcia konta płacisz kartą lub BLIKIEM. Za pierwsze 20 transakcji w miesiącu naliczamy 3% (do 100 zł), od 21. transakcji 6%, łącznie do 200 zł miesięcznie i 2400 zł w całym okresie. Portfel zwrotów jest tylko licznikiem informacyjnym — to nie są środki do wydania.", "type": "card_payments", "order": 4},
   {"title": "Promocja Podróżna III: nagroda 20% za wydatki podróżne", "description": "Płacisz kartą lub BLIKIEM za paliwo, bilety lotnicze, kolejowe i autokarowe (nie komunikacja miejska) albo wycieczki w biurach podróży. Bank wypłaca 20% wartości takiej transakcji na konto lub Skarbonkę (najpóźniej następnego dnia roboczego), ale nie więcej niż suma zwrotów w portfelu; pojedyncza nagroda do 2000 zł, łącznie do 2400 zł. Po 12 miesiącach masz jeszcze 2 miesiące na wykorzystanie portfela.", "type": "card_payments", "order": 5},
   {"title": "Terminy: edycja IV do 31.10.2026, Promocja Podróżna III do 12.01.2027", "description": "„Otwórz konto online i ruszaj po więcej – edycja IV” trwa do 31.10.2026. „Promocja Podróżna III” trwa do 12.01.2027 lub do wyczerpania puli 40 000 otwartych kont. Nagrody są zwolnione z podatku (sprzedaż premiowa).", "type": "deadline", "order": 6}
  ],
  "bonusParts": [
   {"label": "Edycja IV: 100 zł za otwarcie online i pierwszą transakcję (przystąpienie do 31.10.2026)", "amountCents": 10000, "order": 0, "availableUntil": J},
   {"label": "Edycja IV: 2 × 100 zł za 10 transakcji w każdym z 2 miesięcy (przystąpienie do 31.10.2026)", "amountCents": 20000, "order": 1, "availableUntil": J},
   {"label": "Promocja Podróżna III: do 2400 zł (20% wydatków podróżnych przez 12 miesięcy)", "amountCents": 240000, "order": 2}
  ],
  "fees": {
   "accountFeeCents": 0,
   "cardFeeCents": None,
   "cardFeeWaiverCondition": "wpływ min. 1000 zł przelewem z zewnątrz w poprzednim miesiącu i min. 5 płatności kartą, utrzymane zgody marketingowe; do 26. roku życia klient jest zwolniony z opłat do konta",
   "otherFee": "Strona oferty: prowadzenie konta bezpłatne także po 26. roku życia; brak prowizji za wypłaty złotą kartą z bankomatów w Polsce i za granicą (operator bankomatu może pobrać opłatę); 0 zł za przewalutowanie ze strony banku. Standardowa miesięczna opłata za kartę nie jest podana na stronie oferty — sprawdź Taryfę Opłat i Prowizji.",
   "sourceUrl": "https://www.pekao.com.pl/konto"
  }
 },
 "checklistSteps": [
  {"order": 0, "monthLabel": "Otwarcie konta", "title": "Otwórz Konto Przekorzystne online (pekao.com.pl/konto lub PeoPay) z kartą, PeoPay i Pekao24 — wszystko w jednym dniu"},
  {"order": 1, "monthLabel": "Otwarcie konta", "title": "Złóż oświadczenia, zgody marketingowe i zaakceptuj regulaminy promocji"},
  {"order": 2, "monthLabel": "Otwarcie konta", "title": "Edycja IV (do 31.10.2026): zaloguj się do Pekao24 lub PeoPay", "availableUntil": J},
  {"order": 3, "monthLabel": "Otwarcie konta", "title": "Edycja IV (do 31.10.2026): w ciągu 14 dni od otwarcia zrób min. 1 transakcję bezgotówkową kartą", "availableUntil": J},
  {"order": 4, "monthLabel": "Otwarcie konta", "title": "Promocja Podróżna III: płać kartą lub BLIKIEM — zwroty 3%/6% zbierają się w portfelu zwrotów (do 200 zł mies.)"},
  {"order": 5, "monthLabel": "Otwarcie konta", "title": "Płać kartą lub BLIKIEM za paliwo, bilety lub wycieczki — bank wypłaca 20% wartości wydatku"},
  {"order": 6, "monthLabel": "Otwarcie konta", "title": "Odbierz nagrody za wydatki podróżne: łącznie do 2400 zł w 12 miesięcy (+2 miesiące na wykorzystanie portfela)", "rewardCents": 240000},
  {"order": 10, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "Edycja IV (do 31.10.2026): zrób min. 10 transakcji bezgotówkowych kartą (bez BLIK, bez wypłat)", "availableUntil": J},
  {"order": 11, "monthLabel": "Miesiąc 1 (po otwarciu konta)", "title": "Edycja IV: odbierz 100 zł za otwarcie konta (do 15.12.2026) i 100 zł za 10 transakcji (do 15.01.2027)", "rewardCents": 20000, "availableUntil": J},
  {"order": 20, "monthLabel": "Miesiąc 2", "title": "Edycja IV (do 31.10.2026): zrób min. 10 transakcji bezgotówkowych kartą (bez BLIK, bez wypłat)", "availableUntil": J},
  {"order": 21, "monthLabel": "Miesiąc 2", "title": "Edycja IV: odbierz nagrodę 100 zł (do 15.02.2027 dla umowy z października)", "rewardCents": 10000, "availableUntil": J}
 ]
}
import sys
sys.path.insert(0, "data/candidates/_src")
from lib import write
write("data/candidates/pekao-konto-przekorzystne.json", d)
