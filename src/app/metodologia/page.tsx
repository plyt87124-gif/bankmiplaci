import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo";
import { MethodologyContent } from "./MethodologyContent";
import { loadMethodologyData } from "./loadMethodologyData";

export const metadata: Metadata = staticPageMetadata("metodologia");

/**
 * /metodologia. The text is static; the live bits (the worked example on a real
 * offer, the current range of ratings, the newest verification date) are read
 * from the database and simply left out when the read fails.
 */
export default async function MethodologyPage() {
  const data = await loadMethodologyData();
  return <MethodologyContent data={data} />;
}
