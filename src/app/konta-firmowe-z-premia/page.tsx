import type { Metadata } from "next";
import { HubPage } from "@/components/seo-pages/HubPage";
import { getHubCards } from "@/components/seo-pages/hubData";
import { hubMetadata } from "@/components/seo-pages/pageMetadata";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * /konta-firmowe-z-premia - hub of the business-account offers. Rendered per
 * request (the root layout reads the session cookie), no `revalidate`; see the
 * personal hub for the metadata rules.
 */
export async function generateMetadata(props: { searchParams: SearchParams }): Promise<Metadata> {
  const [searchParams, cards] = await Promise.all([props.searchParams, getHubCards("business")]);
  return hubMetadata("business", cards.length, searchParams, new Date());
}

export default async function BusinessHubPage() {
  const cards = await getHubCards("business");
  return <HubPage kind="business" cards={cards} />;
}
