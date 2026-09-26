import { useId } from "react";

export function LogoMark({ size = 40 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="brand-mark" style={{ width: size, height: size }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5BB8F7" />
          <stop offset="1" stopColor="#1673C4" />
        </linearGradient>
      </defs>
      <path d="M20 3.5 6.5 8.6v10.2c0 8.3 5.7 15.4 13.5 17.7 7.8-2.3 13.5-9.4 13.5-17.7V8.6L20 3.5Z" fill={`url(#${id})`} />
      <path d="M20 3.5v33c7.8-2.3 13.5-9.4 13.5-17.7V8.6L20 3.5Z" fill="#0B2348" opacity=".18" />
      <circle cx="15.2" cy="16.2" r="2.6" fill="#fff" />
      <circle cx="24.8" cy="16.2" r="2.6" fill="#fff" />
      <circle cx="20" cy="21.4" r="1.9" fill="#fff" opacity=".85" />
      <path d="M11.4 26.2c1-3.1 2.4-4.8 3.8-4.8s2.2.8 2.7 1.7M28.6 26.2c-1-3.1-2.4-4.8-3.8-4.8s-2.2.8-2.7 1.7M16.6 28.2c.6-2 1.9-3.1 3.4-3.1s2.8 1.1 3.4 3.1" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ tagline = true }: { tagline?: boolean }) {
  return (
    <div className="brand">
      <LogoMark />
      <div>
        <div className="brand-name">e<b>Guard</b></div>
        {tagline ? <div className="brand-tag">Digital Safety for Better Tomorrows</div> : null}
      </div>
    </div>
  );
}
