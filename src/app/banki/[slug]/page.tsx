import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BankPage } from "@/components/seo-pages/BankPage";
import { getBankOpenCards, getBankPage } from "@/components/seo-pages/bankData";
import { bankMetadata, bankNotFoundMetadata } from "@/components/seo-pages/pageMetadata";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /banki/[slug] - the permanent page of one bank: it answers 200 after the
 * bank's offers have ended ("Brak aktualnych promocji" + the ended ones).
 * notFound() only for a slug that names no bank, or a bank with nothing public
 * (no non-draft offer). The route must NOT sit below any loading.tsx - a
 * loading boundary would stream a 200 before notFound() can run, i.e. a soft
 * 404 (tests/route-structure.test.ts, tests/seo-pages-routes.test.tsx).
 *
 * Indexable exactly when the sitemap lists it (the bank has an ACTIVE or
 * EXPIRED offer). Rendered per request, no `revalidate` (the root layout reads
 * the session cookie).
 */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getBankPage(slug);
  if (!data) return bankNotFoundMetadata();
  const [cards, query] = await Promise.all([getBankOpenCards(data.bank.slug), searchParams]);
  return bankMetadata(data.bank, cards.length, data.indexable, query, new Date());
}

export default async function BankRoute({ params }: PageProps) {
  const { slug } = await params;
  const data = await getBankPage(slug);
  if (!data) notFound();
  const cards = await getBankOpenCards(data.bank.slug);
  return <BankPage bank={data.bank} cards={cards} offers={data.offers} now={new Date()} />;
}
