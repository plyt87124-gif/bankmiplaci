/**
 * Human-readable labels for the extra source links under a promotion
 * ("Zobacz też"), derived from the URL itself so existing promotions get
 * descriptive text without a data migration.
 */

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function fileSlug(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(last)
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[_-]\d+$/, "");
  } catch {
    return "";
  }
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

/** Row label for the fees document: a DDO is not a "taryfa", so say what it is. */
export function describeFeesSource(url: string): string {
  return /(^|[^a-z])ddo([^a-z]|$)|dokument-dotycz|informacyjny-dokument/i.test(url)
    ? "Dokument informacyjny o opłatach"
    : "Taryfa opłat i prowizji";
}

/** Link text for one additional source URL. `index` is its 0-based position. */
export function describeAdditionalSource(url: string, index: number): string {
  const host = hostOf(url);
  const lower = url.toLowerCase();

  if (/(^|[^a-z])ddo([^a-z]|$)|dokument-dotycz|informacyjny-dokument/.test(lower)) {
    return "dokument informacyjny o opłatach";
  }
  if (/(^|[^a-z])toip([^a-z]|$)|taryfa|tabela-op|cennik/.test(lower)) {
    return "taryfa opłat i prowizji";
  }

  const slug = fileSlug(url);
  const isPdf = /\.pdf(\?|#|$)/.test(lower) || lower.includes("/dam/") || lower.includes("/asset/");

  if (/regulamin/.test(slug)) {
    const topic = slug
      .replace(/^regulamin[-_]?/, "")
      .replace(/^(sprzedazy-premiowej|promocji|konkursu|programu|oferty)[-_]?/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    return topic ? `regulamin: ${topic}` : "regulamin";
  }

  if (!isPdf) return `strona oferty w banku${host ? ` (${host})` : ""}`;
  if (slug && !UUID_LIKE.test(slug)) return `dokument: ${slug.replace(/[-_]+/g, " ")}`;
  return `dodatkowy dokument ${index + 1}${host ? ` (${host})` : ""}`;
}
