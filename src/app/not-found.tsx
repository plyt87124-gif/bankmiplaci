import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPage, StatusSearch } from "@/components/ui/StatusPage";

// The page is a 404 for search engines too: never index it, but let them follow its links.
export const metadata: Metadata = {
  title: "Nie znaleziono strony",
  robots: { index: false, follow: true }
};

export default function NotFound() {
  return (
    <StatusPage
      code="Błąd 404"
      title="Nie znaleziono strony"
      description="Takiej strony nie ma albo została przeniesiona. Wybierz, dokąd chcesz przejść, albo wyszukaj bank lub ofertę."
      actions={
        <>
          <ButtonLink href="/promocje">Zobacz promocje</ButtonLink>
          <ButtonLink href="/porownaj" variant="secondary">
            Porównaj promocje
          </ButtonLink>
          <ButtonLink href="/quiz" variant="secondary">
            Quiz: dobierz promocję
          </ButtonLink>
        </>
      }
    >
      <StatusSearch />
    </StatusPage>
  );
}
