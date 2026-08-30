import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/ogFont";

export const alt = "Bankmiplaci.pl — porównywarka promocji bankowych";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEADLINE = "Bankmiplaci.pl";
const EYEBROW = "Porównywarka promocji bankowych";
const TAGLINE = "Porównaj promocje bankowe i sprawdź, ile możesz zyskać";

export default async function Image() {
  const [interBold, interSemibold] = await Promise.all([
    loadGoogleFont("Inter", 700, HEADLINE),
    loadGoogleFont("Inter", 600, EYEBROW + TAGLINE)
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
          backgroundColor: "rgb(14, 27, 42)",
          fontFamily: "Inter"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "36px" }}>
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "9999px",
              backgroundColor: "rgb(34, 199, 174)",
              display: "flex"
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: "28px",
              color: "rgb(34, 199, 174)",
              fontWeight: 600,
              letterSpacing: "3px",
              textTransform: "uppercase"
            }}
          >
            {EYEBROW}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: "108px", color: "rgb(246, 247, 245)", fontWeight: 700 }}>
          {HEADLINE}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "40px",
            fontWeight: 600,
            color: "rgb(163, 174, 186)",
            marginTop: "32px",
            maxWidth: "920px"
          }}
        >
          {TAGLINE}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Inter", data: interBold, weight: 700 }, { name: "Inter", data: interSemibold, weight: 600 }] }
  );
}
