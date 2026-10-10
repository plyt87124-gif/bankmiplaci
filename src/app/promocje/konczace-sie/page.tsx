import type { Metadata } from "next";
import { EndingSoonPage } from "@/components/seo-pages/EndingSoonPage";
import { ENDING_SOON_MAX_DAYS } from "@/components/seo-pages/endingSoon";
import { endingSoonMetadata } from "@/components/seo-pages/pageMetadata";
import { getEndingSoon } from "@/lib/services/promotionCards";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * /promocje/konczace-sie - a static segment, so it wins over /promocje/[slug]
 * (an offer can never be named "konczace-sie" by accident: the route is matched
 * first). Rendered per request (the root layout reads the session cookie), no
 * `revalidate`. There is deliberately NO loading.tsx above this route or above
 * /promocje/[slug] (tests/route-structure.test.ts): the offer page calls
 * notFound(), and a loading boundary would turn an unknown slug into HTTP 200.
 * Always indexable (also when the list is empty); a filter/sort/paging
 * parameter is noindex with the canonical on the clean path.
 */
export async function generateMetadata(props: { searchParams: SearchParams }): Promise<Metadata> {
  return endingSoonMetadata(await props.searchParams, new Date());
}

export default async function EndingSoonRoute() {
  const now = new Date();
  const cards = await getEndingSoon(ENDING_SOON_MAX_DAYS, now);
  return <EndingSoonPage cards={cards} now={now} />;
}
