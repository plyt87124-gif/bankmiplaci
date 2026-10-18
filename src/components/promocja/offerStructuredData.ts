/**
 * JSON-LD of one offer page: ONE `@graph` with WebPage + BreadcrumbList +
 * FinancialProduct (all from the SEO library's promotionLd) and, when the page
 * has a FAQ, the FAQPage built from the SAME items the page renders.
 *
 * No Review / AggregateRating (the site rating is internal), no price, and a
 * fee that is null is left out - never written as 0 (see src/lib/seo/jsonld.ts).
 * Render the result with <JsonLd> only.
 */
import { faqLd, promotionLd, type FaqItem, type JsonLdNode, type PromotionLdInput } from "@/lib/seo";

export interface OfferStructuredDataInput {
  promotion: Pick<
    PromotionLdInput,
    "slug" | "name" | "bankName" | "bankWebsite" | "bankLogoUrl" | "accountType" | "lastVerifiedAt" | "endDate" | "fees"
  >;
  /** Meta description of the page (makeDescription output). */
  description: string;
  faq: readonly FaqItem[];
}

export function buildOfferStructuredData(input: OfferStructuredDataInput): JsonLdNode {
  const { promotion } = input;
  const base = promotionLd({
    ...promotion,
    description: input.description,
    breadcrumbs: [
      { name: "Start", path: "/" },
      { name: "Promocje", path: "/promocje" },
      { name: promotion.name, path: `/promocje/${promotion.slug}` }
    ]
  }) as JsonLdNode & { "@graph": JsonLdNode[] };

  const faq = faqLd(input.faq);
  if (!faq) return base;

  // FAQPage joins the graph; its own @context is dropped (the graph has one).
  const { "@context": _context, ...faqNode } = faq;
  void _context;
  return { ...base, "@graph": [...base["@graph"], faqNode] };
}
