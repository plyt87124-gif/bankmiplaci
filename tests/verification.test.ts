// The rules behind "every active offer is verified at least every two days": which documents an offer rests on,
// when a document counts as unchanged, when an offer is overdue, and what the page text of a document is.
import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_DOCUMENT_CHARS,
  VERIFY_ALERT_HOURS,
  VERIFY_TARGET_HOURS,
  decideFromSnapshots,
  dueForCheck,
  hoursSinceVerified,
  isVerificationOverdue,
  sourceUrlsOf,
  type SourceSnapshot
} from "../src/lib/verification";
import { htmlToText, normalizeText, sha256Hex, snapshotFromText } from "../src/lib/verificationSources";
import { overdueDigestEmail } from "../src/lib/services/verification";
import { AGING_MAX_DAYS, FRESH_MAX_DAYS } from "../src/lib/freshness";

const snap = (url: string, hash: string | null, extra: Partial<SourceSnapshot> = {}): SourceSnapshot => ({
  url,
  ok: hash !== null,
  status: hash !== null ? 200 : 403,
  sha256: hash,
  chars: hash !== null ? 5000 : null,
  ...extra
});
const A = "https://bank.example/regulamin.pdf";
const B = "https://bank.example/taryfa.pdf";

test("the promise: 48 h; the watchdog speaks up before it is broken; the site's freshness agrees", () => {
  assert.equal(VERIFY_TARGET_HOURS, 48);
  assert.ok(VERIFY_ALERT_HOURS < VERIFY_TARGET_HOURS);
  // fresh = at most two calendar days (the promise); one more day is the margin for a failed run
  assert.equal(FRESH_MAX_DAYS * 24, VERIFY_TARGET_HOURS);
  assert.equal(AGING_MAX_DAYS, FRESH_MAX_DAYS + 1);
});

test("sourceUrlsOf: regulamin, extra sources and the fee table; https only, no duplicates, no tracking links", () => {
  assert.deepEqual(
    sourceUrlsOf({
      sourceUrl: A,
      additionalSourceUrls: [B, A, "http://insecure.example/x", "  ", "https://bankmiplaci.ebrokerpartner.pl/short/abc"],
      feesSourceUrl: B
    }),
    [A, B]
  );
  assert.deepEqual(sourceUrlsOf({ sourceUrl: null, additionalSourceUrls: null, feesSourceUrl: undefined }), []);
  assert.deepEqual(sourceUrlsOf({ sourceUrl: "https://bankmiplaci.ebrokerpartner.pl/short/5oz9g" }), []);
});

test("decideFromSnapshots: identical documents are UNCHANGED", () => {
  assert.deepEqual(decideFromSnapshots([snap(A, "h1"), snap(B, "h2")], [snap(B, "h2"), snap(A, "h1")]), { decision: "UNCHANGED" });
});

test("decideFromSnapshots: a different document is CHANGED and named", () => {
  assert.deepEqual(decideFromSnapshots([snap(A, "h1x"), snap(B, "h2")], [snap(A, "h1"), snap(B, "h2")]), { decision: "CHANGED", changedUrls: [A] });
});

test("decideFromSnapshots: a new or a dropped document is CHANGED too", () => {
  assert.deepEqual(decideFromSnapshots([snap(A, "h1"), snap(B, "h2")], [snap(A, "h1")]), { decision: "CHANGED", changedUrls: [B] });
  assert.deepEqual(decideFromSnapshots([snap(A, "h1")], [snap(A, "h1"), snap(B, "h2")]), { decision: "CHANGED", changedUrls: [B] });
});

test("decideFromSnapshots: an unreadable document beats everything, even a matching baseline", () => {
  const blocked = snap(B, null, { problem: "HTTP 403" });
  assert.deepEqual(decideFromSnapshots([snap(A, "h1"), blocked], [snap(A, "h1"), snap(B, "h2")]), { decision: "UNREACHABLE", unreachableUrls: [B] });
  assert.deepEqual(decideFromSnapshots([blocked], null), { decision: "UNREACHABLE", unreachableUrls: [B] });
});

test("decideFromSnapshots: without a baseline nothing is 'unchanged'; without documents nothing can be said", () => {
  assert.deepEqual(decideFromSnapshots([snap(A, "h1")], null), { decision: "NO_BASELINE" });
  assert.deepEqual(decideFromSnapshots([snap(A, "h1")], []), { decision: "NO_BASELINE" });
  assert.deepEqual(decideFromSnapshots([], [snap(A, "h1")]), { decision: "NO_SOURCES" });
});

test("decideFromSnapshots: a document the last check only attested through a browser has no hash to match", () => {
  const attested: SourceSnapshot = { url: A, ok: true, status: null, sha256: null, chars: null, viaBrowser: true };
  assert.deepEqual(decideFromSnapshots([snap(A, "h1")], [attested]), { decision: "CHANGED", changedUrls: [A] });
});

test("hours and overdue: 35 h is fine, 36 h raises the alarm, a missing date always does", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3600_000);
  assert.equal(hoursSinceVerified(ago(5), now), 5);
  assert.equal(hoursSinceVerified(new Date(now.getTime() + 3600_000), now), 0); // clock skew never goes negative
  assert.equal(hoursSinceVerified(null, now), null);
  assert.equal(hoursSinceVerified("nonsense", now), null);
  assert.equal(isVerificationOverdue(ago(35), now), false);
  assert.equal(isVerificationOverdue(ago(36), now), true);
  assert.equal(isVerificationOverdue(null, now), true);
  assert.equal(isVerificationOverdue(ago(47), now, VERIFY_TARGET_HOURS), false);
  assert.equal(isVerificationOverdue(ago(48), now, VERIFY_TARGET_HOURS), true);
});

test("dueForCheck: what the daily run picks up (everything older than half a day by default)", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const offers = [
    { slug: "a", lastVerifiedAt: new Date("2026-10-26T11:00:00Z") },
    { slug: "b", lastVerifiedAt: new Date("2026-10-25T20:00:00Z") },
    { slug: "c", lastVerifiedAt: new Date("2026-08-22T00:00:00Z") },
    { slug: "d", lastVerifiedAt: null }
  ];
  assert.deepEqual(dueForCheck(offers, now).map((o) => o.slug), ["b", "c", "d"]);
});

test("htmlToText: visible words only - scripts, styles, comments, head and markup do not count; entities are decoded", () => {
  const html = `<html><head><title>x</title><script>var t=1</script></head><body><!-- c --><style>p{}</style>
    <h1>Premia&nbsp;do&nbsp;800&nbsp;zł</h1><p>Warunek: <b>5</b> transakcji &amp; wpływ &#8211; 1000&#x20;zł</p><noscript>enable js</noscript></body></html>`;
  assert.equal(htmlToText(html), "Premia do 800 zł Warunek: 5 transakcji & wpływ – 1000 zł");
});

test("the hash ignores layout but reacts to any changed figure", () => {
  const a = htmlToText("<p>Premia 800 zł,   do 31.12.2026</p>");
  const b = htmlToText("<div>\n<span>Premia 800 zł,</span>\n<span>do 31.12.2026</span></div>");
  const c = htmlToText("<p>Premia 700 zł, do 31.12.2026</p>");
  assert.equal(sha256Hex(a), sha256Hex(b));
  assert.notEqual(sha256Hex(a), sha256Hex(c));
  assert.equal(normalizeText("a b\f\r\n c"), "a b c");
});

test("snapshotFromText: a shell page (script-rendered, blocked) proves nothing", () => {
  const shell = snapshotFromText("https://x.example/", 200, "Enable JavaScript to continue");
  assert.equal(shell.ok, false);
  assert.equal(shell.sha256, null);
  assert.match(shell.problem ?? "", /za mało tekstu/);
  const real = snapshotFromText("https://x.example/r.pdf", 200, "Regulamin ".repeat(MIN_DOCUMENT_CHARS));
  assert.equal(real.ok, true);
  assert.equal(real.sha256?.length, 64);
});

test("overdueDigestEmail: silent on good days, one escaped list otherwise", () => {
  assert.equal(overdueDigestEmail([], "https://bankmiplaci.pl/admin"), null);
  const mail = overdueDigestEmail(
    [{ id: "1", slug: "s", name: "Konto <b>X</b>", bankName: "Bank & Co", lastVerifiedAt: new Date("2026-10-20T08:00:00Z"), hours: 150 }],
    "https://bankmiplaci.pl/admin"
  )!;
  assert.match(mail.subject, /1 oferta czeka na weryfikację ponad 36 h/);
  assert.match(mail.html, /Bank &amp; Co – Konto &lt;b&gt;X&lt;\/b&gt;/);
  assert.match(mail.html, /150 h temu \(2026-10-20\)/);
  assert.doesNotMatch(mail.html, /<b>X/);
});
