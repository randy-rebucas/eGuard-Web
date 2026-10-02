import { useId } from "react";

/*
 * The landing page's audience and feature icons, drawn as inline SVG (they were 160px PNGs). Rendered on the server:
 * no image requests and no client JavaScript. Each is a rounded tile on a 64-unit grid with a glyph on top.
 */

type SvgProps = { className?: string };

/* ---------- "Built for Families, Schools and Communities": outlined blue glyphs on a pale tile ---------- */

const AUDIENCE_GLYPHS = {
  // Glyphs on Lucide's 24-unit grid (paths from lucide's users, landmark and building icons; communities drawn to match)
  family: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <path d="M16 3.128a4 4 0 0 1 0 7.744" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  school: (
    <>
      <path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" />
      <path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7M3 22h18" />
    </>
  ),
  community: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M6.5 21v-1.5a5.5 5.5 0 0 1 11 0V21" />
      <circle cx="5" cy="9.6" r="2.4" />
      <path d="M1.5 20v-1a4 4 0 0 1 3.6-4" />
      <circle cx="19" cy="9.6" r="2.4" />
      <path d="M22.5 20v-1a4 4 0 0 0-3.6-4" />
    </>
  ),
  business: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
};

export type Audience = keyof typeof AUDIENCE_GLYPHS;

export function AudienceIcon({ name, className }: SvgProps & { name: Audience }) {
  return (
    <svg className={className} viewBox="0 0 64 64" width={84} height={84} aria-hidden="true">
      <rect x="0.5" y="0.5" width="63" height="63" rx="16" fill="#F5F9FF" stroke="#E4EDF9" />
      <g transform="translate(17 17) scale(1.25)" fill="none" stroke="#1A8CFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {AUDIENCE_GLYPHS[name]}
      </g>
    </svg>
  );
}

/* ---------- "Everything You Need": filled, gradient glyphs on a tinted tile ---------- */

const pt = (r: number, a: number) => `${(32 + r * Math.cos(a)).toFixed(2)} ${(32 + r * Math.sin(a)).toFixed(2)}`;

/** An eight-tooth cog around (32, 32), with its hole cut out (evenodd). */
const GEAR = (() => {
  const step = (2 * Math.PI) / 8, outer = 15.5, inner = 11.5;
  const teeth = Array.from({ length: 8 }, (_, k) => {
    const a = k * step - Math.PI / 2;
    return `${pt(inner, a - step * 0.3)} L${pt(outer, a - step * 0.16)} L${pt(outer, a + step * 0.16)} L${pt(inner, a + step * 0.3)}`;
  });
  return `M${teeth.join(" L")} Z M38 32 a6 6 0 1 0 -12 0 a6 6 0 1 0 12 0 Z`;
})();

export type Feature = "setup" | "health" | "screen-time" | "apps" | "location" | "alerts";

const FEATURE_THEME: Record<Feature, { tint: string; from: string; to: string }> = {
  setup: { tint: "#E8FAF2", from: "#3BDDA0", to: "#10B57A" },
  health: { tint: "#E8F1FF", from: "#4FA0FF", to: "#1E6FE8" },
  "screen-time": { tint: "#F2EAFE", from: "#B87DFF", to: "#8B3DF0" },
  apps: { tint: "#FFF1E5", from: "#FFAE5C", to: "#F2730F" },
  location: { tint: "#FFEAEE", from: "#FF6B84", to: "#E8233F" },
  alerts: { tint: "#FFEAEE", from: "#FF6B84", to: "#E8233F" },
};

function FeatureGlyph({ name, fill }: { name: Feature; fill: string }) {
  switch (name) {
    case "setup":
      return <path d={GEAR} fill={fill} fillRule="evenodd" stroke={fill} strokeWidth={1.5} strokeLinejoin="round" />;
    case "health":
      return (
        <>
          <path d="M32 13.5 46.5 19v11c0 9.2-6.1 16.4-14.5 20-8.4-3.6-14.5-10.8-14.5-20V19Z" fill={fill} />
          <path d="m25.5 31.5 4.8 4.8 8.8-9.6" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "screen-time":
      return (
        <>
          <rect x="15" y="15" width="34" height="34" rx="10" fill={fill} />
          <circle cx="32" cy="32" r="10.5" fill="#fff" />
          <path d="M32 26v6.5h4.5" fill="none" stroke="#8B3DF0" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "apps":
      // A box seen from above: light lid, two shaded sides, and the notch of an opened flap at the front
      return (
        <>
          <path d="M32 13 48 21.5 32 30 16 21.5Z" fill="#FFC48A" />
          <path d="M16 21.5 32 30v21L16 42.5Z" fill={fill} />
          <path d="M48 21.5 32 30v21l16-8.5Z" fill="#E5650A" />
          <path d="M26.5 33.5 32 36.4l5.5-2.9v6L32 42.4l-5.5-2.9Z" fill="#FFE0BF" opacity={0.9} />
        </>
      );
    case "location":
      return (
        <>
          <path d="M32 51s-14.5-12.6-14.5-23.5a14.5 14.5 0 0 1 29 0C46.5 38.4 32 51 32 51Z" fill={fill} />
          <circle cx="32" cy="27.5" r="5.5" fill="#fff" />
        </>
      );
    case "alerts":
      return (
        <>
          <circle cx="32" cy="14.5" r="2.6" fill={fill} />
          <path d="M32 16.5c-7.3 0-12.5 5.6-12.5 12.8v7.4l-3.6 5.1a1.4 1.4 0 0 0 1.1 2.2h30a1.4 1.4 0 0 0 1.1-2.2l-3.6-5.1v-7.4c0-7.2-5.2-12.8-12.5-12.8Z" fill={fill} />
          <path d="M27.5 47.5a4.6 4.6 0 0 0 9 0Z" fill={fill} />
        </>
      );
  }
}

export function FeatureIcon({ name, className }: SvgProps & { name: Feature }) {
  const id = useId();
  const t = FEATURE_THEME[name];
  return (
    <svg className={className} viewBox="0 0 64 64" width={60} height={60} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={t.tint} />
      <FeatureGlyph name={name} fill={`url(#${id})`} />
    </svg>
  );
}
