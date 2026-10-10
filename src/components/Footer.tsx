import Link from "next/link";
import { unstable_cache } from "next/cache";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { db } from "@/lib/db";
import { LATEST_VERIFICATION_LABEL } from "@/lib/disclosureCopy";
import { formatDatePL } from "@/lib/format";
import { getFooterColumns } from "@/lib/navigation";
import { PUBLISHER, publisherAddress } from "@/lib/publisher";
import { isoDatePL, toValidDate, warsawYear } from "@/lib/seo/dates";
import { activeWhere } from "@/lib/services/promotions";

/** How long the "Najnowsza weryfikacja oferty" date may lag behind the database. */
const DATA_UPDATED_REVALIDATE_SECONDS = 600;

/**
 * Newest `lastVerifiedAt` among the offers visible on the site (ISO string, or
 * null when there is no offer). One tiny aggregate, cached for 10 minutes, so
 * the footer never costs a query per page view. Returns a string because the
 * data cache stores JSON.
 */
const readLatestVerification = unstable_cache(
  async (): Promise<string | null> => {
    const { _max } = await db.promotion.aggregate({ where: activeWhere(), _max: { lastVerifiedAt: true } });
    return _max.lastVerifiedAt ? _max.lastVerifiedAt.toISOString() : null;
  },
  ["footer-latest-verification"],
  { revalidate: DATA_UPDATED_REVALIDATE_SECONDS }
);

/**
 * The footer is rendered inline (not behind a Suspense boundary: streaming a
 * fallback footer and then the real one put TWO footers - two disclosures, two
 * publisher blocks - into the HTML that bots read). So a slow database must not
 * hold the page back: the lookup gets this long, then the date line is omitted.
 */
export const DATA_UPDATED_TIMEOUT_MS = 1500;

/**
 * Runs `read` and gives up after `timeoutMs`. A timeout or an error is `null`
 * ("omit the line"), never an exception: the footer must not take the page down.
 */
export async function readWithTimeout(
  read: () => Promise<string | null>,
  timeoutMs: number = DATA_UPDATED_TIMEOUT_MS
): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([read(), timeout]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function getDataUpdatedAt(): Promise<string | null> {
  return readWithTimeout(readLatestVerification);
}

const footerLinkClasses =
  "inline-flex min-h-11 items-center py-1 text-small text-ink-700 hover:text-ink-900 hover:underline hover:underline-offset-[3px] md:min-h-8";

/**
 * The presentational footer: everything it shows comes from its props and from
 * src/lib/navigation.ts, src/lib/publisher.ts and the disclosure copy, so it
 * renders without a database (tests, Storybook-like checks).
 */
export function FooterView({ dataUpdatedAt, now }: { dataUpdatedAt?: Date | string | null; now?: Date }) {
  const columns = getFooterColumns();
  const updated = toValidDate(dataUpdatedAt);
  const updatedIso = updated ? isoDatePL(updated) : null;
  const year = warsawYear(now ?? new Date());

  return (
    <footer className="border-t border-line bg-sunken">
      <div className="container-page py-12 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <div>
            <p className="font-display text-[22px] font-semibold leading-none text-ink-900">Bankmiplaci</p>
            <p className="mt-3 max-w-sm text-small text-ink-500">
              Porównujemy aktualne promocje bankowe w Polsce i pokazujemy, ile możesz otrzymać i co musisz zrobić, aby
              zdobyć premię.
            </p>
          </div>

          <nav aria-label="Stopka" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="font-body text-small font-semibold tracking-normal text-ink-900">{column.title}</h2>
                <ul className="mt-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={footerLinkClasses}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-10 space-y-3 border-t border-line pt-8">
          <AffiliateDisclosure variant="footer" />

          {updated && updatedIso ? (
            <p className="text-small text-ink-500" data-footer="updated">
              {LATEST_VERIFICATION_LABEL}: <time dateTime={updatedIso}>{formatDatePL(updated, "short")}</time>
            </p>
          ) : null}

          <p className="max-w-[68ch] text-small text-ink-500" data-footer="publisher">
            Wydawca: {PUBLISHER.name} ({PUBLISHER.legalForm}), {publisherAddress()}, NIP&nbsp;{PUBLISHER.nip}, REGON&nbsp;
            {PUBLISHER.regon},{" "}
            <a href={`mailto:${PUBLISHER.email}`} className="link-inline">
              {PUBLISHER.email}
            </a>
            .
          </p>

          <p className="text-small text-ink-500" data-footer="copyright">
            © {year} Bankmiplaci. Wszystkie prawa zastrzeżone.
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Site footer (server component): FooterView plus the "Najnowsza weryfikacja oferty" date from the database
 * (cached, at most DATA_UPDATED_TIMEOUT_MS of waiting). Exactly one <footer> ends up in the HTML.
 */
export async function Footer() {
  const dataUpdatedAt = await getDataUpdatedAt();
  return <FooterView dataUpdatedAt={dataUpdatedAt} />;
}
