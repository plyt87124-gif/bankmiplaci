import type { Metadata } from "next";
import Link from "next/link";
import { staticPageMetadata } from "@/lib/seo";
import { TextPage } from "../jak-to-dziala/TextPage";
import { PUBLISHER } from "../o-nas/publisher";
import { ContactForm } from "./ContactForm";
import { initialMessageFor } from "./initialMessage";

export const metadata: Metadata = staticPageMetadata("kontakt");

export default async function KontaktPage({
  searchParams
}: {
  searchParams: Promise<{ oferta?: string | string[] }>;
}) {
  const { oferta } = await searchParams;

  return (
    <TextPage
      path="/kontakt"
      title="Kontakt"
      lead={
        <p>
          Zauważyłeś(-aś) nieaktualną promocję albo błąd w warunkach? Daj nam znać – każde zgłoszenie sprawdzamy w źródle
          przed zmianą w serwisie.
        </p>
      }
    >
      <p>
        Możesz napisać bezpośrednio na <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a> albo skorzystać z
        formularza poniżej. Nie wysyłaj nam haseł, danych logowania ani numerów kart.
      </p>

      <div className="mt-8">
        <ContactForm initialMessage={initialMessageFor(oferta)} />
      </div>

      <p className="mt-6 text-small text-ink-500">
        Administratorem danych jest {PUBLISHER.name} ({PUBLISHER.addressLine}). Dane z formularza przetwarzamy w celu
        udzielenia odpowiedzi i obsługi zgłoszenia. Szczegóły oraz Twoje prawa opisuje{" "}
        <Link href="/polityka-prywatnosci" className="link-inline">
          Polityka prywatności
        </Link>
        .
      </p>
    </TextPage>
  );
}
