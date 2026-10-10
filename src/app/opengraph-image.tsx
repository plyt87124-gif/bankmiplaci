import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/ogFont";

export const alt = "Bankmiplaci.pl — porównywarka promocji bankowych";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colours = the "Papier i tusz" light tokens (src/app/globals.css).
const PAPER = "rgb(249, 247, 242)";
const INK = "rgb(26, 28, 32)";
const INK_MUTED = "rgb(88, 93, 102)";
const ACTION = "rgb(11, 94, 82)";
const LINE = "rgb(226, 222, 213)";

const HEADLINE = "Bankmiplaci.pl";
const EYEBROW = "Porównywarka promocji bankowych";
const TAGLINE = "Porównaj promocje bankowe i sprawdź, ile możesz zyskać";

export default async function Image() {
  // Google Fonts subsets the file to the glyphs we ask for, so the text passed
  // here must be the text that is actually drawn - including the upper-cased
  // eyebrow (textTransform: "uppercase" below needs the capital letters).
  const [serif, sansSemibold] = await Promise.all([
    loadGoogleFont("Source Serif 4", 600, HEADLINE),
    loadGoogleFont("Inter", 600, EYEBROW.toUpperCase() + TAGLINE)
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "90px",
          backgroundColor: PAPER,
          borderTop: `14px solid ${ACTION}`,
          fontFamily: "Inter"
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "26px",
            color: ACTION,
            fontWeight: 600,
            letterSpacing: "3px",
            textTransform: "uppercase",
            marginBottom: "32px"
          }}
        >
          {EYEBROW}
        </div>
        <div style={{ display: "flex", fontFamily: "Source Serif 4", fontSize: "116px", color: INK, fontWeight: 600 }}>
          {HEADLINE}
        </div>
        <div style={{ display: "flex", width: "120px", height: "4px", backgroundColor: LINE, margin: "36px 0" }} />
        <div style={{ display: "flex", fontSize: "40px", fontWeight: 600, color: INK_MUTED, maxWidth: "940px" }}>
          {TAGLINE}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Source Serif 4", data: serif, weight: 600 },
        { name: "Inter", data: sansSemibold, weight: 600 }
      ]
    }
  );
}
