import test from "node:test";
import assert from "node:assert/strict";
import {
  articleLd,
  breadcrumbLd,
  faqLd,
  feesSpecificationText,
  itemListLd,
  organizationLd,
  promotionLd,
  serializeJsonLd,
  websiteLd
} from "../src/lib/seo/jsonld";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JsonLd } from "../src/components/JsonLd";

// tsx compiles .tsx with the classic JSX transform (tsconfig has jsx:"preserve"
// for Next); the component itself needs no React import under Next's automatic
// runtime, so give the test runner the global the classic transform expects.
(globalThis as { React?: typeof React }).React = React;

process.env.NEXT_PUBLIC_SITE_URL = "https://bankmiplaci.example";
const SITE = "https://bankmiplaci.example";

/** Every key and string value of a JSON-LD tree, for "does X appear anywhere" checks. */
function allText(node: unknown): string {
  return JSON.stringify(node);
}

const BASE = {
  slug: "alior-konto-z-premia",
  name: "Alior Konto z Premią + Obrączka płatnicza",
  bankName: "Alior Bank",
  bankWebsite: "https://www.aliorbank.pl",
  accountType: "PERSONAL",
  description: "Opis oferty.",
  lastVerifiedAt: new Date("2026-10-07T08:30:00Z"),
  endDate: new Date("2026-10-13T00:00:00Z"),
  breadcrumbs: [
    { name: "Start", path: "/" },
    { name: "Promocje", path: "/promocje" },
    { name: "Alior Konto z Premią", path: "/promocje/alior-konto-z-premia" }
  ]
};

/* ---------------- serialisation / <JsonLd> ---------------- */

test("serializeJsonLd escapes < > & and the Unicode line separators, and stays valid JSON", () => {
  const evil = {
    name: `Promocja </script><script>alert(1)</script> <!-- &     "cudzysłów"`
  };
  const out = serializeJsonLd(evil);
  assert.ok(!out.includes("<"), "no raw <");
  assert.ok(!out.includes(">"), "no raw >");
  assert.ok(!out.includes("&"), "no raw &");
  assert.ok(!out.includes(" ") && !out.includes(" "), "no raw line separators");
  assert.deepEqual(JSON.parse(out), evil, "round-trips to the same data");
});

test("<JsonLd> renders one application/ld+json script that a hostile title cannot close early", () => {
  const data = organizationLd();
  (data as Record<string, unknown>).name = "</script><img src=x onerror=alert(1)>";
  const html = renderToStaticMarkup(React.createElement(JsonLd, { data }));
  assert.ok(html.startsWith('<script type="application/ld+json">') && html.endsWith("</script>"));
  const inner = html.slice('<script type="application/ld+json">'.length, -"</script>".length);
  assert.ok(!/<\/script/i.test(inner) && !inner.includes("<img"), "payload cannot end the tag");
  assert.equal((html.match(/<script/g) ?? []).length, 1);
  assert.equal(JSON.parse(inner).name, "</script><img src=x onerror=alert(1)>");
});

test("<JsonLd> renders nothing for null, undefined and empty arrays (e.g. faqLd([]))", () => {
  for (const data of [null, undefined, [], faqLd([]), breadcrumbLd([]), itemListLd([])]) {
    assert.equal(renderToStaticMarkup(React.createElement(JsonLd, { data })), "");
  }
});

/* ---------------- site-wide nodes ---------------- */

test("organizationLd: stable @id, absolute PNG logo, no sameAs without real profiles", () => {
  const org = organizationLd() as Record<string, any>;
  assert.equal(org["@type"], "Organization");
  assert.equal(org["@id"], `${SITE}/#organization`);
  assert.equal(org.url, `${SITE}/`);
  assert.equal(org.logo.url, `${SITE}/apple-icon.png`);
  assert.ok(org.logo.width >= 112 && org.logo.height >= 112, "logo >= 112 px");
  assert.ok(!("sameAs" in org));
  const withProfiles = organizationLd({ sameAs: ["https://www.tiktok.com/@x", "http://insecure.example", "javascript:alert(1)"] }) as Record<string, any>;
  assert.deepEqual(withProfiles.sameAs, ["https://www.tiktok.com/@x"]);
});

test("websiteLd: @id, pl-PL, publisher by reference, SearchAction only on request", () => {
  const site = websiteLd() as Record<string, any>;
  assert.equal(site["@id"], `${SITE}/#website`);
  assert.equal(site.inLanguage, "pl-PL");
  assert.deepEqual(site.publisher, { "@id": `${SITE}/#organization` });
  assert.ok(!("potentialAction" in site));
  const withSearch = websiteLd({ searchPath: "/promocje?q=" }) as Record<string, any>;
  assert.equal(withSearch.potentialAction.target.urlTemplate, `${SITE}/promocje?q={search_term_string}`);
});

/* ---------------- breadcrumbs, FAQ, ItemList ---------------- */

test("breadcrumbLd: absolute items, positions from 1, empty names dropped", () => {
  const bc = breadcrumbLd([{ name: "Start", path: "/" }, { name: "  ", path: "/x" }, { name: "Promocje", path: "/promocje" }]) as Record<string, any>;
  assert.equal(bc["@type"], "BreadcrumbList");
  assert.deepEqual(
    bc.itemListElement.map((i: any) => [i.position, i.name, i.item]),
    [
      [1, "Start", `${SITE}/`],
      [2, "Promocje", `${SITE}/promocje`]
    ]
  );
});

test("faqLd: Question/Answer pairs, incomplete items skipped", () => {
  const faq = faqLd([
    { question: "Czy to jest karencja?", answer: "Tak." },
    { question: "", answer: "bez pytania" },
    { question: "Bez odpowiedzi", answer: " " }
  ]) as Record<string, any>;
  assert.equal(faq["@type"], "FAQPage");
  assert.equal(faq.mainEntity.length, 1);
  assert.equal(faq.mainEntity[0]["@type"], "Question");
  assert.equal(faq.mainEntity[0].acceptedAnswer["@type"], "Answer");
});

test("itemListLd: top 10 by default, absolute urls, positions", () => {
  const items = Array.from({ length: 14 }, (_, i) => ({ name: `Oferta ${i + 1}`, path: `/promocje/o-${i + 1}` }));
  const list = itemListLd(items, { name: "Aktualne promocje" }) as Record<string, any>;
  assert.equal(list["@type"], "ItemList");
  assert.equal(list.numberOfItems, 10);
  assert.equal(list.itemListElement.length, 10);
  assert.equal(list.itemListElement[0].position, 1);
  assert.equal(list.itemListElement[9].url, `${SITE}/promocje/o-10`);
  assert.equal((itemListLd(items, { limit: 3 }) as Record<string, any>).itemListElement.length, 3);
});

/* ---------------- offer page ---------------- */

test("promotionLd: @graph with WebPage + BreadcrumbList + FinancialProduct, linked by @id", () => {
  const ld = promotionLd({ ...BASE, fees: { accountFeeCents: 1200, accountFeeWaiverCondition: "wpływ 1000 zł" } }) as Record<string, any>;
  assert.equal(ld["@context"], "https://schema.org");
  const types = ld["@graph"].map((n: any) => n["@type"]);
  assert.deepEqual(types, ["WebPage", "BreadcrumbList", "FinancialProduct"]);
  const [page, crumbs, product] = ld["@graph"];
  const url = `${SITE}/promocje/alior-konto-z-premia`;
  assert.equal(page.url, url);
  assert.equal(page.inLanguage, "pl-PL");
  assert.deepEqual(page.isPartOf, { "@id": `${SITE}/#website` });
  assert.deepEqual(page.breadcrumb, { "@id": crumbs["@id"] });
  assert.deepEqual(page.mainEntity, { "@id": product["@id"] });
  assert.equal(page.dateModified, "2026-10-07T08:30:00.000Z");
  assert.equal(page.name, "Alior Konto z Premią + Obrączka płatnicza", "H1 does not repeat the bank the name already contains");
  assert.equal(product.name, BASE.name);
  assert.equal(product.category, "Promocja na konto osobiste");
  assert.equal(product.provider["@type"], "BankOrCreditUnion");
  assert.equal(product.provider.name, "Alior Bank");
  assert.equal(product.provider.url, "https://www.aliorbank.pl");
  assert.equal(product.url, url);
});

test("promotionLd: Offer carries only dates (validThrough as a calendar day), no price or availability", () => {
  const ld = promotionLd({ ...BASE, startDate: new Date("2026-09-01T00:00:00Z") }) as Record<string, any>;
  const product = ld["@graph"].find((n: any) => n["@type"] === "FinancialProduct");
  assert.deepEqual(Object.keys(product.offers).sort(), ["@type", "url", "validFrom", "validThrough"]);
  assert.equal(product.offers["@type"], "Offer");
  assert.equal(product.offers.validThrough, "2026-10-13");
  assert.equal(product.offers.validFrom, "2026-09-01");
  // No start date passed (placeholder in the DB) -> not claimed.
  const noStart = promotionLd(BASE) as Record<string, any>;
  assert.ok(!("validFrom" in noStart["@graph"][2].offers));
});

test("promotionLd: no Review, AggregateRating or rating anywhere - for any input", () => {
  const inputs = [
    BASE,
    { ...BASE, fees: { accountFeeCents: 0, cardFeeCents: 0 } },
    { ...BASE, bankWebsite: null, description: null, endDate: null, lastVerifiedAt: null },
    { ...BASE, accountType: "BUSINESS", name: "Rating Review AggregateRating" }
  ];
  for (const input of inputs) {
    const text = allText(promotionLd(input));
    for (const forbidden of ['"AggregateRating"', '"Review"', '"aggregateRating"', '"review"', '"ratingValue"', '"reviewRating"', '"rating"']) {
      assert.ok(!text.includes(forbidden), `${forbidden} found in ${text.slice(0, 120)}`);
    }
  }
  // Nor in the other builders.
  const others = [
    allText(organizationLd()),
    allText(websiteLd()),
    allText(articleLd({ slug: "a", title: "T", authorName: "Redakcja" })),
    allText(faqLd([{ question: "q", answer: "a" }])),
    allText(itemListLd([{ name: "n", path: "/p" }]))
  ];
  for (const text of others) assert.ok(!/ggregateRating|"Review"|ratingValue/.test(text));
});

test("promotionLd: missing data is omitted, never invented", () => {
  const ld = promotionLd({ slug: "x", name: "Oferta", bankName: "Bank X" }) as Record<string, any>;
  const [page, product] = ld["@graph"];
  assert.equal(ld["@graph"].length, 2, "no breadcrumb node without breadcrumbs");
  assert.ok(!("dateModified" in page));
  assert.ok(!("breadcrumb" in page));
  assert.ok(!("offers" in product));
  assert.ok(!("feesAndCommissionsSpecification" in product));
  assert.ok(!("description" in product));
  assert.deepEqual(product.provider, { "@type": "BankOrCreditUnion", name: "Bank X" });
  assert.equal(product.category, "Promocja bankowa");
  // A garbage website is dropped rather than emitted.
  const bad = promotionLd({ slug: "x", name: "Oferta", bankName: "Bank X", bankWebsite: "javascript:alert(1)" }) as Record<string, any>;
  assert.ok(!("url" in bad["@graph"][1].provider));
});

test("promotionLd: hostile offer text stays inert once serialised", () => {
  const ld = promotionLd({ ...BASE, name: "</script><script>alert(1)</script>", description: "<b>&</b>" });
  const out = serializeJsonLd(ld);
  assert.ok(!/<\/?script/i.test(out) && !out.includes("<b>"));
  const parsed = JSON.parse(out) as { "@graph": Array<Record<string, unknown>> };
  assert.equal(parsed["@graph"][2]?.name, "</script><script>alert(1)</script>"); // FinancialProduct.name, verbatim
});

/* ---------------- fees: only verified fields ---------------- */

test("feesSpecificationText: nothing verified -> null (and the key is absent from the product)", () => {
  assert.equal(feesSpecificationText(null), null);
  assert.equal(feesSpecificationText(undefined), null);
  assert.equal(feesSpecificationText({}), null);
  assert.equal(feesSpecificationText({ accountFeeCents: null, cardFeeCents: null, atmFeeCents: null, otherFee: "coś" }), null);
});

test("feesSpecificationText: a null fee is never written as 0 zł", () => {
  const text = feesSpecificationText({ accountFeeCents: 1200, cardFeeCents: null }) ?? "";
  assert.match(text, /Opłata za prowadzenie konta: 12 zł\./);
  assert.ok(!/kart/i.test(text), "unverified card fee is skipped, not 0");
  assert.ok(!/0 zł/.test(text.replace("10 zł", "")), text);
});

test("feesSpecificationText: a verified unconditional 0 is stated, a '0 zł + condition' contradiction is skipped", () => {
  assert.equal(feesSpecificationText({ accountFeeCents: 0 }), "Opłata za prowadzenie konta: 0 zł.");
  // cents 0 together with a waiver condition = the site shows it as "Nieustalone".
  assert.equal(feesSpecificationText({ accountFeeCents: 0, accountFeeWaiverCondition: "wpływ 1000 zł" }), null);
});

test("feesSpecificationText: a waiver condition is carried, not turned into an unconditional fee", () => {
  const text = feesSpecificationText({ accountFeeCents: 4950, accountFeeWaiverCondition: "wpływ 1000 zł miesięcznie" }) ?? "";
  assert.equal(text, "Opłata za prowadzenie konta: 49,50 zł (0 zł po spełnieniu warunku: wpływ 1000 zł miesięcznie).");
});

test("feesSpecificationText: otherFee text is never copied, only signals that more conditions exist", () => {
  const secret = "UWAGA ADMIN: sprawdzić w piątek, tajna notatka";
  const text = feesSpecificationText({ accountFeeCents: 0, otherFee: secret }) ?? "";
  assert.ok(!text.includes("tajna") && !text.includes("ADMIN"));
  // a remark adds the pointer to the bank's tariff; the fee itself is a plain 0 zł
  assert.match(text, /^Opłata za prowadzenie konta: 0 zł\. Szczegółowe warunki i pozostałe opłaty: w taryfie/);
  // Without any verified fee, the remark alone produces no statement.
  assert.equal(feesSpecificationText({ otherFee: secret }), null);
});

test("feesSpecificationText: the card fee follows the same rule as the account fee (remark pointer, condition, plain spaces)", () => {
  // 0 zł card next to a remark is a plain 0 zł, exactly like the account fee
  assert.equal(
    feesSpecificationText({ accountFeeCents: 0, cardFeeCents: 0, otherFee: "Karta 6 zł/mies. bez płatności." }),
    "Opłata za prowadzenie konta: 0 zł. Opłata za kartę: 0 zł. " +
      "Szczegółowe warunki i pozostałe opłaty: w taryfie opłat i prowizji banku."
  );
  // a blank remark is no remark
  assert.equal(feesSpecificationText({ accountFeeCents: 0, cardFeeCents: 0, otherFee: "  \n " }), "Opłata za prowadzenie konta: 0 zł. Opłata za kartę: 0 zł.");
  // a condition keeps its words but loses a trailing full stop, so the sentence does not end "..)."
  assert.equal(
    feesSpecificationText({ accountFeeCents: 0, cardFeeCents: 600, cardFeeWaiverCondition: "min. 300 zł płatności." }),
    "Opłata za prowadzenie konta: 0 zł. Opłata za kartę: 6 zł (0 zł po spełnieniu warunku: min. 300 zł płatności)."
  );
  // the markup uses regular spaces only (no non-breaking space from the money formatter)
  const text = feesSpecificationText({ accountFeeCents: 4950, accountFeeWaiverCondition: "wpływ", cardFeeCents: 1050, atmFeeCents: 600 }) ?? "";
  assert.ok(!/[  ]/.test(text), text);
  assert.match(text, /49,50 zł \(0 zł po spełnieniu warunku: wpływ\)\. Opłata za kartę: 10,50 zł\. Opłata za wypłatę z bankomatu: 6 zł\./);
});

test("promotionLd: fee table URL is used only when no fee field is usable", () => {
  const sourceUrl = "https://bank.example/taryfa.pdf";
  const onlyUrl = promotionLd({ ...BASE, fees: { accountFeeCents: null, sourceUrl } }) as Record<string, any>;
  assert.equal(onlyUrl["@graph"][2].feesAndCommissionsSpecification, sourceUrl);
  const both = promotionLd({ ...BASE, fees: { accountFeeCents: 0, sourceUrl } }) as Record<string, any>;
  assert.equal(both["@graph"][2].feesAndCommissionsSpecification, "Opłata za prowadzenie konta: 0 zł.");
  const junk = promotionLd({ ...BASE, fees: { accountFeeCents: null, sourceUrl: "nie-url" } }) as Record<string, any>;
  assert.ok(!("feesAndCommissionsSpecification" in junk["@graph"][2]));
});

/* ---------------- article ---------------- */

test("articleLd: dates, publisher by reference, author with url, 110-char headline, default image", () => {
  const long = "Jak zdobyć premię z konta bankowego i niczego nie przeoczyć w regulaminie - kompletny poradnik krok po kroku dla początkujących";
  const ld = articleLd({
    slug: "karencja",
    title: long,
    description: "  Opis\nartykułu ",
    publishedAt: new Date("2026-09-01T10:00:00Z"),
    modifiedAt: new Date("2026-10-01T10:00:00Z"),
    authorName: "Redakcja Bankmiplaci",
    authorUrl: "/o-nas"
  }) as Record<string, any>;
  assert.equal(ld["@type"], "Article");
  assert.ok(ld.headline.length <= 110);
  assert.equal(ld.description, "Opis artykułu");
  assert.deepEqual(ld.image, [`${SITE}/opengraph-image`]);
  assert.equal(ld.datePublished, "2026-09-01T10:00:00.000Z");
  assert.equal(ld.dateModified, "2026-10-01T10:00:00.000Z");
  assert.equal(ld.inLanguage, "pl-PL");
  assert.equal(ld.url, `${SITE}/blog/karencja`);
  assert.deepEqual(ld.mainEntityOfPage, { "@type": "WebPage", "@id": `${SITE}/blog/karencja` });
  assert.deepEqual(ld.author, { "@type": "Person", name: "Redakcja Bankmiplaci", url: `${SITE}/o-nas` });
  assert.deepEqual(ld.publisher, { "@id": `${SITE}/#organization` });
  // No modification date unless one was passed (never a made-up "now").
  const bare = articleLd({ slug: "a", title: "T", authorName: "R" }) as Record<string, any>;
  assert.ok(!("dateModified" in bare) && !("datePublished" in bare));
});
