import type { FaqAccordionItem } from "@/components/FaqAccordion";
import { STALE_SUFFIX } from "@/lib/freshness";
import { KARENCJA_DEFINITION } from "@/lib/glossary";

/**
 * Content of /faq: the single source for the visible accordion AND the
 * FAQPage JSON-LD (the page passes the same items to both, so they cannot
 * differ). Answers are plain text of about 40-80 words, informational, and
 * send the reader to the bank's regulamin or to official sources where the
 * topic is legal or tax. No amount, date or number that depends on data is
 * typed here.
 */
export interface FaqGroup {
  id: string;
  title: string;
  items: FaqAccordionItem[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "o-serwisie",
    title: "O serwisie",
    items: [
      {
        id: "czy-darmowe",
        question: "Czy korzystanie z serwisu jest darmowe?",
        answer:
          "Tak. Przeglądanie i porównywanie promocji w Bankmiplaci jest bezpłatne dla użytkowników. Serwis utrzymuje się z wynagrodzenia partnerskiego, które możemy otrzymać od banków lub sieci partnerskich, gdy ktoś otworzy konto przez nasz link i spełni warunki promocji."
      },
      {
        id: "czy-musze-miec-konto",
        question: "Czy muszę mieć konto w serwisie?",
        answer:
          "Nie. Przeglądanie i porównywanie promocji oraz quiz działają bez konta w Bankmiplaci. Konto jest potrzebne do ściągi, do komentowania ofert i do sprawdzania, czy minęła karencja – na podstawie podanej przez Ciebie daty zamknięcia konta w banku. To osobne konto w naszym serwisie, niezwiązane z kontem w żadnym banku."
      },
      {
        id: "jak-zarabiacie",
        question: "Jak zarabiacie?",
        answer:
          "Zarabiamy z prowizji od banków za polecenie. Jeśli otworzysz konto przez nasz link partnerski i spełnisz warunki promocji, bank lub sieć partnerska może wypłacić nam wynagrodzenie. Ty nie płacisz nam nic. Każdy link partnerski jest oznaczony, a szczegóły opisujemy na stronie „Jak zarabiamy”.",
        link: { href: "/jak-zarabiamy", label: "Jak zarabiamy" }
      },
      {
        id: "kolejnosc-a-prowizja",
        question: "Czy kolejność ofert zależy od prowizji?",
        answer:
          "Tak, domyślna kolejność „Polecane” uwzględnia wynagrodzenie partnerskie od banków, więc oferta o wyraźnie niższej ocenie może w niej stać wyżej niż oferta o wyraźnie wyższej. Ocena serwisu jest liczona bez prowizji. Pozostałe sortowania (Najlepsza ocena, Najwyższa premia, Najłatwiejsze, Najnowsze, Kończące się wkrótce) nie korzystają z prowizji, więc możesz wybrać kolejność od niej niezależną.",
        link: { href: "/jak-zarabiamy#polecane", label: "Co oznacza kolejność „Polecane”" }
      },
      {
        id: "jak-liczycie-ocene",
        question: "Jak liczycie ocenę serwisu?",
        answer:
          "To nasz wewnętrzny wskaźnik, np. 9,4/10. Zwykle liczymy go automatycznie z pięciu składników: wysokości premii, trudności zdobycia, czasu trwania, średniej premii na miesiąc i karencji, na tle innych aktualnych ofert tego samego typu konta (w wyjątkowych przypadkach ustawiamy go ręcznie – opisujemy to w metodologii). Prowizja nie jest składnikiem oceny. To nie jest porada finansowa ani niezależna ocena banku.",
        link: { href: "/metodologia", label: "Jak liczymy ocenę serwisu" }
      },
      {
        id: "jak-dziala-sciaga",
        question: "Jak działa ściąga?",
        answer:
          "Ściąga to harmonogram kroków promocji rozpisany na kolejne miesiące. Po zalogowaniu dodajesz promocję do ściągi na jej stronie i podajesz datę otwarcia konta w banku, a szczegółową ściągę otwierasz w „Moje konto”. Kolejne miesiące odblokowują się, gdy nadchodzą. Zaznaczenia zapisują się w serwisie i nie są przekazywane bankom.",
        link: { href: "/jak-to-dziala#kroki", label: "Jak to działa" }
      },
      {
        id: "co-znaczy-zweryfikowano",
        question: "Co znaczy „Zweryfikowano”?",
        answer:
          `To data, kiedy ostatnio porównaliśmy warunki oferty ze źródłem, czyli z regulaminem banku. Widać ją przy każdej ofercie; przy dawnej dacie dopisujemy „${STALE_SUFFIX}”. Data nie oznacza, że bank nie zmienił warunków po tym dniu, dlatego przed otwarciem konta sprawdź aktualny regulamin.`,
        link: { href: "/metodologia#weryfikacja", label: "Co znaczy „Zweryfikowano”" }
      },
      {
        id: "caly-rynek",
        question: "Czy porównujecie wszystkie banki i oferty?",
        answer:
          "Nie. Pokazujemy promocje, które przeanalizowaliśmy, i nie obejmujemy całego rynku. To, że danego banku lub oferty nie ma w serwisie, nie znaczy, że nie ma ona sensu – po prostu jej tu nie porównujemy."
      },
      {
        id: "aktualnosc",
        question: "Czy promocje są aktualne?",
        answer:
          "Każda oferta ma termin zapisów i datę ostatniej weryfikacji. Po terminie oferta jest oznaczana jako zakończona i nie jest pokazywana jako aktywna. Bank może jednak zmienić albo zakończyć promocję wcześniej, np. gdy wyczerpie się pula, dlatego przed otwarciem konta sprawdź aktualny regulamin na stronie banku."
      },
      {
        id: "skad-dane",
        question: "Skąd bierzecie warunki promocji?",
        answer:
          "Z regulaminów promocji publikowanych przez banki oraz z ich tabel opłat i prowizji. Przy ofercie podajemy datę ostatniej weryfikacji i, gdy go mamy, link do źródła. Jeśli jakiejś opłaty nie zweryfikowaliśmy, piszemy „Brak danych”, a nie „0 zł”.",
        link: { href: "/metodologia#zrodla", label: "Źródła danych i weryfikacja" }
      },
      {
        id: "blad-w-ofercie",
        question: "Co zrobić, gdy znajdę błąd lub nieaktualną ofertę?",
        answer:
          "Napisz do nas przez formularz kontaktowy albo na adres pomoc@bankmiplaci.pl i podaj adres strony, której dotyczy zgłoszenie. Sprawdzimy informację w źródle i, jeśli błąd się potwierdzi, poprawimy ofertę albo oznaczymy ją jako nieaktualną. Nie wysyłaj nam danych logowania ani numerów kart.",
        link: { href: "/kontakt", label: "Przejdź do kontaktu" }
      }
    ]
  },
  {
    id: "promocje-i-warunki",
    title: "Promocje i warunki",
    items: [
      {
        id: "czy-musze-uzyc-linku",
        question: "Czy muszę korzystać z linku na stronie?",
        answer:
          "Zwykle nie, ale zależy od oferty. Niektóre promocje są dostępne wyłącznie przez link partnerski lub kod promocyjny – jeśli tak jest i o tym wiemy, piszemy to w warunkach oferty. Zawsze sprawdź sekcję z warunkami promocji. Co do zasady warunki i koszt konta nie zależą od tego, czy korzystasz z naszego linku, ale ostateczne warunki zawsze określa regulamin banku."
      },
      {
        id: "kilka-promocji",
        question: "Czy można korzystać z kilku promocji naraz?",
        answer:
          "To zależy od regulaminów. Część promocji wyklucza udział w innych ofertach tego samego banku albo jest przeznaczona wyłącznie dla nowych klientów. Sprawdź warunki uczestnictwa w regulaminie banku (link do niego jest w sekcji ze źródłem przy każdej ofercie)."
      },
      {
        id: "nowy-klient",
        question: "Jak sprawdzić, czy jestem „nowym klientem”?",
        answer:
          "Definicję nowego klienta ustala bank w regulaminie promocji. Zwykle chodzi o to, że przez określony czas przed złożeniem wniosku nie było Twojego konta w tym banku (albo konta danego typu). Jeśli nie masz pewności, zapytaj bank na infolinii lub czacie, zanim założysz konto.",
        link: { href: "/jak-to-dziala#slowniczek", label: "Słowniczek pojęć" }
      },
      {
        id: "karencja",
        question: "Co to jest karencja?",
        answer:
          `${KARENCJA_DEFINITION} Gdy znamy karencję, możemy na podstawie podanej przez Ciebie daty zamknięcia konta pokazać, od kiedy możesz skorzystać z oferty.`,
        link: { href: "/jak-to-dziala#slowniczek", label: "Słowniczek pojęć" }
      },
      {
        id: "kyc",
        question: "Co to jest KYC i dlaczego bank prosi o dokumenty?",
        answer:
          "KYC to weryfikacja tożsamości klienta, którą bank wykonuje przed otwarciem konta, np. na podstawie dokumentu, przelewu weryfikacyjnego albo rozmowy wideo. Sposób zależy od banku. Bez pozytywnej weryfikacji bank nie otworzy konta, więc nie da się też spełnić warunków promocji."
      }
    ]
  },
  {
    id: "premia-i-pieniadze",
    title: "Premia i pieniądze",
    items: [
      {
        id: "kiedy-wyplata",
        question: "Kiedy bank wypłaca premię?",
        answer:
          "Termin wypłaty określa regulamin promocji. Zwykle następuje po zakończeniu okresu, w którym trzeba spełniać warunki, ale bywa też, że premia jest wypłacana w częściach. Konkretny termin sprawdź w regulaminie banku – nie mamy wpływu na moment wypłaty ani wglądu w realizację promocji."
      },
      {
        id: "brak-premii",
        question: "Co zrobić, jeśli nie otrzymam premii?",
        answer:
          "W pierwszej kolejności skontaktuj się z bankiem, w którym masz konto – to bank wypłaca premię i może sprawdzić, czy warunki zostały spełnione. Nie mamy dostępu do Twojego konta bankowego ani do informacji o realizacji promocji."
      },
      {
        id: "podatek",
        question: "Czy od premii płaci się podatek?",
        answer:
          "Premia może podlegać opodatkowaniu, a sposób rozliczenia zależy od jej rodzaju i od tego, jak ją traktuje bank. Informacje o tym podaje regulamin promocji, a ogólne zasady znajdziesz na stronie podatki.gov.pl. To informacja ogólna, nie porada podatkowa – w razie wątpliwości zapytaj doradcę podatkowego."
      },
      {
        id: "zdolnosc-kredytowa",
        question: "Czy zakładanie wielu kont wpływa na zdolność kredytową?",
        answer:
          "Samo konto bez zadłużenia zwykle nie obniża zdolności kredytowej, ale wpływ mogą mieć produkty kredytowe powiązane z kontem, np. limit w rachunku czy karta kredytowa. Ocenę zawsze wykonuje bank, do którego składasz wniosek o kredyt – jeśli planujesz go wziąć, zapytaj o to w tym banku."
      }
    ]
  }
];

export const FAQ_ITEMS: FaqAccordionItem[] = FAQ_GROUPS.flatMap((group) => group.items);
