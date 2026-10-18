import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/siteUrl";

// Crawl rules are unchanged on purpose. Parameterised list URLs (?sort=,
// ?bank=, ?strona=2 ...) are NOT disallowed here: they carry
// `noindex,follow` + a canonical to the clean path, and a crawler has to be
// able to fetch them to see that (see noindexForSearchParams in
// src/lib/seo/metadata.ts).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/out"] }],
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
