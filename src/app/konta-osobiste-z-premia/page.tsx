import type { Metadata } from "next";
import { HubPage } from "@/components/seo-pages/HubPage";
import { getHubCards } from "@/components/seo-pages/hubData";
import { hubMetadata } from "@/components/seo-pages/pageMetadata";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * /konta-osobiste-z-premia - hub of the personal-account offers. Rendered per
 * request: the root layout reads the session cookie, so the route is dynamic
 * and must NOT export `revalidate` (see the note in src/app/promocje/[slug]/page.tsx).
 * Title, description and canonical come from the SEO library; a filter/sort
 * parameter makes the URL noindex with the canonical on the clean path.
 */
export async function generateMetadata(props: { searchParams: SearchParams }): Promise<Metadata> {
  const [searchParams, cards] = await Promise.all([props.searchParams, getHubCards("personal")]);
  return hubMetadata("personal", cards.length, searchParams, new Date());
}

export default async function PersonalHubPage() {
  const cards = await getHubCards("personal");
  return <HubPage kind="personal" cards={cards} />;
}
