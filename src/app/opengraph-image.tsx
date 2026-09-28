import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Simple typographic share card: wordmark, tagline and the private-service note. Neutral colors only. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#fafafa",
          color: "#18181b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#18181b",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 20,
                height: 20,
                borderTopRightRadius: 12,
                borderBottomLeftRadius: 8,
                background: "#047857",
              }}
            />
          </div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: -0.5 }}>{site.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 88, fontWeight: 600, letterSpacing: -3, lineHeight: 1.02, maxWidth: 900 }}>
            {site.tagline}
          </div>
          <div style={{ fontSize: 32, color: "#52525b", lineHeight: 1.35, maxWidth: 900 }}>
            Know what your business needs to file, when it&apos;s due, and get it handled.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            borderTop: "2px solid #e4e4e7",
            paddingTop: 28,
            fontSize: 24,
            color: "#6b6b73",
          }}
        >
          {site.disclaimer}
        </div>
      </div>
    ),
    { ...size },
  );
}
