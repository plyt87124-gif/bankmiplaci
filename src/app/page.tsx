import type { Metadata } from "next";
import { AttributionCapture } from "@/components/AttributionCapture";
import { HomeView } from "@/components/home/HomeView";
import { loadHomeModel } from "@/components/home/homeData";
import { buildMetadata, homeDescription, homeTitle } from "@/lib/seo";

// No `revalidate` here on purpose: the root layout reads the session cookie, so
// the page is dynamic anyway, and an ISR-style export next to it is exactly what
// tests/route-structure.test.ts warns about. The ISR move belongs to WP-17
// (session out of the layout), together with a production-build check.

/**
 * Title, description and canonical come from the SEO library: "Promocje bankowe
 * {Rok} - konta z premią do odebrania | Bankmiplaci" (year in Poland's
 * calendar) and the description with the newest verification date. The model is
 * the one the page uses (one cached read per request).
 */
export async function generateMetadata(): Promise<Metadata> {
  const model = await loadHomeModel();
  return buildMetadata({
    title: { absolute: homeTitle(new Date()) },
    description: homeDescription(model?.latestVerifiedAt),
    path: "/"
  });
}

/**
 * Home page (docs/redesign-v2/02-layout-spec.md, HOME). One read of the public
 * offer cards feeds every block; if the database is down the page still renders
 * its static content with a notice instead of the offers.
 */
export default async function HomePage() {
  const model = await loadHomeModel();

  return (
    <>
      <AttributionCapture />
      <HomeView model={model} />
    </>
  );
}
