import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const PINE = "#1f5a43";
const MARIGOLD = "#f2b23a";
const LINE = "rgba(31, 90, 67, 0.35)";

/**
 * Home-screen icon: the Filewell page on a full-bleed pine square (the device
 * applies its own rounded mask), on the same 32-unit grid as LogoMark.
 */
export default function AppleIcon() {
  const u = size.width / 32;
  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", background: PINE }}>
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
          style={{ position: "absolute", left: 11.5 * u, top: 15 * u, width: 9 * u, height: 2 * u, borderRadius: u, background: LINE }}
        />
        <div
          style={{ position: "absolute", left: 11.5 * u, top: 19 * u, width: 6 * u, height: 2 * u, borderRadius: u, background: LINE }}
        />
      </div>
    ),
    { ...size },
  );
}
