import { serializeJsonLd } from "@/lib/seo/jsonld";

interface JsonLdProps {
  /**
   * One JSON-LD object (from the builders in "@/lib/seo"), or an array of
   * them. `null`/`undefined` (e.g. `faqLd([])`) renders nothing.
   */
  data: Record<string, unknown> | ReadonlyArray<Record<string, unknown>> | null | undefined;
}

/**
 * Renders structured data as `<script type="application/ld+json">`.
 *
 * Always use this instead of a hand-written dangerouslySetInnerHTML: the
 * payload contains database text (offer names, summaries, article titles),
 * and a bare `JSON.stringify` would let a title such as `</script><script>...`
 * end the tag and inject markup. serializeJsonLd escapes `<`, `>`, `&` and the
 * U+2028/U+2029 line separators.
 *
 * Server component - no client JS.
 */
export function JsonLd({ data }: JsonLdProps) {
  if (data == null) return null;
  if (Array.isArray(data) && data.length === 0) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
