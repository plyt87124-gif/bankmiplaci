/**
 * Loads a Google Font as raw TTF bytes for use with next/og's ImageResponse.
 * Needed because ImageResponse's own bundled default font fails to load on
 * this project's Windows dev environment (a file:// path-resolution bug in
 * Next 14.2.15's bundled @vercel/og) — supplying our own font sidesteps
 * that fallback path entirely, and also guarantees correct rendering of
 * Polish diacritics, which the bundled default font may not cover.
 *
 * `text` should include every character actually used in the image (Google
 * Fonts subsets the file to just those glyphs) — pass the exact copy.
 */
export async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(cssUrl).then((res) => res.text());
  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype)'\)/);
  const fontUrl = match?.[1];
  if (!fontUrl) throw new Error(`loadGoogleFont: no font URL found for ${family}`);
  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) throw new Error(`loadGoogleFont: failed to fetch font file (${fontRes.status})`);
  return fontRes.arrayBuffer();
}
