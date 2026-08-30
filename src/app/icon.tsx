import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/ogFont";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const interBold = await loadGoogleFont("Inter", 700, "B");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgb(14, 27, 42)",
          borderRadius: "6px"
        }}
      >
        <div
          style={{
            display: "flex",
            color: "rgb(34, 199, 174)",
            fontSize: 22,
            fontWeight: 700
          }}
        >
          B
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Inter", data: interBold, weight: 700 }] }
  );
}
