import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#17231d";
const MUTED = "#4b5650";
const PINE = "#1f5a43";
const MARIGOLD = "#f2b23a";
const PAPER = "#fafaf7";
const BORDER = "#e3e1d8";

/**
 * The brand faces as TTF from Google Fonts (satori can't read woff2). If the fetch
 * fails, the card still renders in the default face.
 */
async function googleFont(query: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${query}`)).text();
    const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * Share card in the brand's own colors (pine, marigold, warm paper) with a real
 * small-business photograph. Plain and private-looking on purpose: no seals, no
 * flags, no government blue, and the not-a-government-agency line is always on it.
 */
export default async function OpengraphImage() {
  const photo = await readFile(join(process.cwd(), "src/assets/photos/owner-coffee-shop.jpg"));
  const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;
  const u = 52 / 32;
  const [display, body] = await Promise.all([
    googleFont("Bricolage+Grotesque:opsz,wght@96,700"),
    googleFont("Figtree:wght@500"),
  ]);
  const fonts = [
    ...(display ? [{ name: "Display", data: display, weight: 700 as const, style: "normal" as const }] : []),
    ...(body ? [{ name: "Body", data: body, weight: 500 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK, fontFamily: "Body" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 700,
            padding: "64px 0 56px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ position: "relative", display: "flex", width: 52, height: 52, borderRadius: 10 * u, background: PINE }}>
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
                style={{ position: "absolute", left: 11.5 * u, top: 15 * u, width: 9 * u, height: 2 * u, borderRadius: u, background: "rgba(31, 90, 67, 0.35)" }}
              />
              <div
                style={{ position: "absolute", left: 11.5 * u, top: 19 * u, width: 6 * u, height: 2 * u, borderRadius: u, background: "rgba(31, 90, 67, 0.35)" }}
              />
            </div>
            <div style={{ fontFamily: "Display", fontSize: 40, fontWeight: 700, letterSpacing: -1.2 }}>{site.name}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: "Display",
                fontSize: 80,
                fontWeight: 700,
                letterSpacing: -3,
                lineHeight: 1.02,
              }}
            >
              <div style={{ display: "flex" }}>Never miss a</div>
              <div style={{ position: "relative", display: "flex", alignSelf: "flex-start" }}>
                <div
                  style={{
                    position: "absolute",
                    left: -4,
                    right: -6,
                    bottom: 6,
                    height: 26,
                    background: MARIGOLD,
                  }}
                />
                <div style={{ position: "relative", display: "flex" }}>business filing.</div>
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 29, color: MUTED, lineHeight: 1.38, maxWidth: 580 }}>
              Know what your business needs to file, when it&apos;s due, and get it handled.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              borderTop: `2px solid ${BORDER}`,
              paddingTop: 22,
              fontSize: 21,
              color: MUTED,
              maxWidth: 580,
            }}
          >
            {site.disclaimer}
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", flex: 1, padding: "40px 40px 40px 0" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoSrc}
            alt=""
            width={460}
            height={550}
            style={{ width: 460, height: 550, objectFit: "cover", borderRadius: 28 }}
          />
          <div
            style={{
              position: "absolute",
              left: 24,
              bottom: 68,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 20px",
              borderRadius: 18,
              background: "#ffffff",
              boxShadow: "0 18px 36px -18px rgba(23, 35, 29, 0.45)",
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: PINE }} />
            Pennsylvania annual reports today
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
