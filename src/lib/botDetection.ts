/**
 * Basic, deliberately non-aggressive bot/crawler detection for
 * /out/[slug] — catches the obvious cases (well-known crawlers, generic
 * HTTP client libraries, headless browsers, a missing User-Agent) so
 * they don't pollute click stats. Not a WAF: no attempt at catching a
 * bot that spoofs a real browser's User-Agent — that would need much
 * more (and much riskier, false-positive-prone) machinery than "block
 * obvious bots without ever blocking a real user" calls for here.
 */
const BOT_PATTERNS =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|embedly|quora link preview|outbrain|pinterest|redditbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|curl\/|wget\/|python-requests|python-urllib|go-http-client|okhttp|java\/|headlesschrome|phantomjs|puppeteer|playwright/i;

export function isLikelyBot(userAgent: string): boolean {
  if (!userAgent.trim()) return true; // real browsers always send a User-Agent
  return BOT_PATTERNS.test(userAgent);
}
