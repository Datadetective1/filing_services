import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const PINE = "#1f5a43";
const MARIGOLD = "#f2b23a";
const LINE = "rgba(31, 90, 67, 0.35)";

/**
 * The Filewell mark as the browser icon: a pine rounded square holding a white page
 * whose top corner is folded in marigold (the same geometry as LogoMark, on a
 * 32-unit grid scaled to the icon size).
 */
export default function Icon() {
  const u = size.width / 32;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "transparent" }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            width: "100%",
            height: "100%",
            borderRadius: 10 * u,
            background: PINE,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 9 * u,
              top: 7 * u,
              width: 14 * u,
              height: 18 * u,
              borderRadius: 2.5 * u,
              background: "#ffffff",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 17 * u,
              top: 7 * u,
              width: 6 * u,
              height: 6 * u,
              borderBottomLeftRadius: 2 * u,
              borderTopRightRadius: 2.5 * u,
              background: MARIGOLD,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 11.5 * u,
              top: 15 * u,
              width: 9 * u,
              height: 2 * u,
              borderRadius: u,
              background: LINE,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 11.5 * u,
              top: 19 * u,
              width: 6 * u,
              height: 2 * u,
              borderRadius: u,
              background: LINE,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
