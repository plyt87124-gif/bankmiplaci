import type { Metadata } from "next";
import { BankIndexPage } from "@/components/seo-pages/BankIndexPage";
import { listBankIndex } from "@/components/seo-pages/bankData";
import { bankIndexMetadata } from "@/components/seo-pages/pageMetadata";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * /banki - the banks with ACTIVE or EXPIRED offers (the sitemap's rule),
 * alphabetically, with the number of current offers. Rendered per request, no
 * `revalidate` (the root layout reads the session cookie). No loading.tsx here:
 * /banki/[slug] below it calls notFound() and must stay a real HTTP 404
 * (tests/seo-pages-routes.test.tsx).
 */
export async function generateMetadata(props: { searchParams: SearchParams }): Promise<Metadata> {
  const [searchParams, banks] = await Promise.all([props.searchParams, listBankIndex()]);
  return bankIndexMetadata(banks.length, searchParams);
}

export default async function BankIndexRoute() {
  const banks = await listBankIndex();
  return <BankIndexPage banks={banks} />;
}
