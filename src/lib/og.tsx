import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_TAGLINE } from "@/lib/site";
import { FREE_CHILDREN } from "@/lib/plans";

/** 1200 × 630 share images for link previews (Messenger, Facebook, X). Brand gradient and logo, no photos of children. */
export const OG_SIZE = { width: 1200, height: 630 };

const logo = `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), "public/brand/logo-mark.svg")).toString("base64")}`;

export function shareImage({ eyebrow, title, footer = `Free for ${FREE_CHILDREN} · No card needed` }: { eyebrow?: string; title: string; footer?: string }) {
  const long = title.length > 60;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px",
        color: "#fff", backgroundImage: "linear-gradient(125deg, #0B2348 0%, #0F4FB8 48%, #1A8CFF 78%, #7FCBFF 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
          <img src={logo} width={76} height={76} alt="" />
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>eGuard</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {eyebrow ? (
            <div style={{ display: "flex", alignSelf: "flex-start", padding: "8px 18px", borderRadius: 999, background: "rgba(255,255,255,.16)",
              fontSize: 24, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>{eyebrow}</div>
          ) : null}
          <div style={{ display: "flex", fontSize: long ? 58 : 72, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 1000 }}>{title}</div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,.85)" }}>{footer}</div>
      </div>
    ),
    OG_SIZE,
  );
}

export const siteShareImage = () => shareImage({ title: SITE_TAGLINE });
