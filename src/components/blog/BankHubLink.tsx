import Link from "next/link";

/**
 * Link from an article to the bank's own page (/banki/[slug]), shown under the
 * offer the article is a guide to. It gives the bank page an internal link from
 * every guide about that bank's offers, and the reader a way to the bank's other
 * offers. The bank page exists whenever the bank has an ACTIVE or EXPIRED offer,
 * which is the only kind of offer an article card is built for.
 */
export function BankHubLink({ bank, className }: { bank: { slug: string; name: string }; className?: string }) {
  return (
    <p className={className}>
      <Link href={`/banki/${bank.slug}`} className="link-inline inline-flex min-h-11 items-center font-medium">
        Wszystkie promocje: {bank.name}
      </Link>
    </p>
  );
}
