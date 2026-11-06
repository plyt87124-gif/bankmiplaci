import { buildLlmsTxt } from "@/lib/seo/llmsTxt";

// Plain text map of the site for AI models (llmstxt.org). Static: it links only to
// stable pages (see src/lib/seo/llmsTxt.ts), so a build-time render is enough.
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
