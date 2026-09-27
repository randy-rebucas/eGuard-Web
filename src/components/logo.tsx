import { useId } from "react";

// Keep in sync with scripts/generate-brand.mjs, which renders the same mark into the app icons.
const SHIELD = "M32 4C24.4 8 16.4 10.2 8.5 11.2V30c0 14.6 9.8 25.4 23.5 30 13.7-4.6 23.5-15.4 23.5-30V11.2C47.6 10.2 39.6 8 32 4Z";
const inset = (s: number) => `translate(32 32) scale(${s}) translate(-32 -32)`;

export function LogoMark({ size = 40 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="brand-mark" style={{ width: size, height: size }}>
      <defs>
        <linearGradient id={`${id}o`} x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4FD2FF" />
          <stop offset=".55" stopColor="#2394F5" />
          <stop offset="1" stopColor="#1560DB" />
        </linearGradient>
        <linearGradient id={`${id}i`} x1="18" y1="16" x2="46" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8BE0FF" />
          <stop offset="1" stopColor="#2B8EF2" />
        </linearGradient>
      </defs>
      <path d={SHIELD} fill={`url(#${id}o)`} />
      <path d={SHIELD} fill="#fff" transform={inset(0.76)} />
      <path d={SHIELD} fill={`url(#${id}i)`} transform={inset(0.6)} />
      <g strokeLinejoin="round" strokeWidth="1.2">
        <path d="M32 22.5 40.2 27.2 32 31.9 23.8 27.2Z" fill="#C4F0FF" stroke="#C4F0FF" />
        <path d="M23.8 27.2 32 31.9V41.3L23.8 36.6Z" fill="#1E9BF2" stroke="#1E9BF2" />
        <path d="M40.2 27.2 32 31.9V41.3L40.2 36.6Z" fill="#0B5FD4" stroke="#0B5FD4" />
      </g>
    </svg>
  );
}

export function Brand({ tagline = true }: { tagline?: boolean }) {
  return (
    <div className="brand">
      <LogoMark />
      <div>
        <div className="brand-name">eGuard</div>
        {tagline ? <div className="brand-tag">Digital Safety for Brighter Tomorrows</div> : null}
      </div>
    </div>
  );
}
