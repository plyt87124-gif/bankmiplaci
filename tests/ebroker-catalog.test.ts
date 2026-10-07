import test from "node:test";
import assert from "node:assert/strict";
import {
  contentHash,
  diffCatalog,
  htmlToText,
  isWatchedOffer,
  offerAccountType,
  parseCatalogXml,
  type CatalogOffer,
  type StoredCampaign
} from "../src/lib/ebrokerCatalog";

const offerXml = (oid: string, name: string, category: string, subcategory: string, desc = "Opis") => `
  <offer>
    <oid>${oid}</oid>
    <name>${name}</name>
    <institution>Bank</institution>
    <logo>https://img.example.test/l.png</logo>
    <description>&lt;div class="t"&gt;${desc}&lt;/div&gt;&#13;
&lt;ul&gt;&lt;li&gt;0 zł &amp;amp; bez warunków&lt;/li&gt;&lt;/ul&gt;</description>
    <url>https://partner.example.test/targetclick.php?param=abc${oid}</url>
    <category>${category}</category>
    <subcategory>${subcategory}</subcategory>
  </offer>`;

const xml = (...offers: string[]) => `<?xml version="1.0" encoding="UTF-8"?>\n<offers>${offers.join("")}\n</offers>`;

test("parses offers, decoding entities and stripping HTML", () => {
  const [o] = parseCatalogXml(xml(offerXml("101", "Konto A", "konta/karty", "konta osobiste")));
  assert.equal(o!.oid, "101");
  assert.equal(o!.description, "Opis 0 zł & bez warunków");
  assert.equal(o!.trackingUrl, "https://partner.example.test/targetclick.php?param=abc101");
});

test("rejects a truncated or malformed catalog instead of returning part of it", () => {
  const full = xml(offerXml("1", "A", "konta/karty", "konta osobiste"));
  assert.throws(() => parseCatalogXml(full.slice(0, full.length - 20)));
  assert.throws(() => parseCatalogXml("<html>error</html>"));
  assert.throws(() => parseCatalogXml(xml(offerXml("1", "A", "x", "y"), offerXml("1", "B", "x", "y"))), /Zdublowany/);
  assert.throws(() => parseCatalogXml(xml(offerXml("x1", "A", "x", "y"))), /oid/);
});

test("watches personal and business accounts only, ignoring Polish diacritics", () => {
  assert.equal(isWatchedOffer({ category: "konta/karty", subcategory: "konta osobiste" }), true);
  assert.equal(isWatchedOffer({ category: "dla firm", subcategory: "konta firmowe" }), true);
  assert.equal(isWatchedOffer({ category: "konta/karty", subcategory: "konta oszczędnościowe" }), false);
  assert.equal(isWatchedOffer({ category: "kredyty", subcategory: "kredyty gotówkowe" }), false);
  assert.equal(offerAccountType({ category: "dla firm" }), "BUSINESS");
  assert.equal(offerAccountType({ category: "konta/karty" }), "PERSONAL");
});

test("htmlToText collapses whitespace and tags", () => {
  assert.equal(htmlToText("&lt;ul&gt;&lt;li&gt;a&lt;/li&gt;&lt;li&gt;b&lt;/li&gt;&lt;/ul&gt;"), "a b");
});

const offer = (oid: string, name = "N", desc = "D", category = "konta/karty", subcategory = "konta osobiste"): CatalogOffer => ({
  oid,
  name,
  institution: "B",
  category,
  subcategory,
  description: desc,
  trackingUrl: "https://x.test/" + oid
});
const stored = (o: CatalogOffer, extra: Partial<StoredCampaign> = {}): StoredCampaign => ({
  oid: o.oid,
  contentHash: contentHash(o),
  watched: isWatchedOffer(o),
  ignored: false,
  missingSince: null,
  ...extra
});

test("detects new watched offers but not new loans", () => {
  const d = diffCatalog([], [offer("1"), offer("2", "Kredyt", "x", "kredyty", "kredyty gotówkowe")]);
  assert.deepEqual(d.added.map((o) => o.oid), ["1"]);
});

test("detects a content change", () => {
  const a = offer("1");
  const d = diffCatalog([stored(a)], [offer("1", "N", "inny opis")]);
  assert.deepEqual(d.changed.map((o) => o.oid), ["1"]);
  assert.equal(diffCatalog([stored(a)], [a]).changed.length, 0);
});

test("a disappearing offer is reported once and flagged as returned later", () => {
  const offers = ["1", "2", "3", "4", "5", "6", "7", "8"].map((i) => offer(i));
  const st = offers.map((o) => stored(o));
  const d1 = diffCatalog(st, offers.slice(1));
  assert.deepEqual(d1.newlyMissing, ["1"]);
  const st2 = st.map((s) => (s.oid === "1" ? { ...s, missingSince: new Date() } : s));
  assert.deepEqual(diffCatalog(st2, offers.slice(1)).newlyMissing, []);
  assert.deepEqual(diffCatalog(st2, offers).returned, ["1"]);
});

test("a catalog that lost most offers is a broken read, not mass removal", () => {
  const offers = ["1", "2", "3", "4", "5", "6", "7", "8"].map((i) => offer(i));
  const d = diffCatalog(offers.map((o) => stored(o)), offers.slice(0, 2));
  assert.equal(d.suspectIncomplete, true);
  assert.deepEqual(d.newlyMissing, []);
  assert.equal(diffCatalog(offers.map((o) => stored(o)), []).suspectIncomplete, true);
});

test("ignored campaigns raise nothing", () => {
  const a = offer("1");
  const d = diffCatalog([stored(a, { ignored: true })], [offer("1", "N", "zmiana")]);
  assert.equal(d.changed.length, 0);
});
