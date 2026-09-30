import { useId } from "react";

/* Simplified platform and browser marks for marketing illustrations (not the official logos).
   Gradient ids come from useId, so a mark can appear any number of times on one page. */

export function ChromeMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 24 4.95 13A22 22 0 0 1 43.05 13Z" fill="#EA4335" />
      <path d="M24 24 43.05 13A22 22 0 0 1 24 46Z" fill="#FBBC04" />
      <path d="M24 24 24 46A22 22 0 0 1 4.95 13Z" fill="#34A853" />
      <circle cx="24" cy="24" r="10" fill="#fff" /><circle cx="24" cy="24" r="7.8" fill="#4285F4" />
    </svg>
  );
}

export function EdgeMark() {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#35C1F1" /><stop offset=".55" stopColor="#1B87D8" /><stop offset="1" stopColor="#2FC96B" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${id})`} />
      <path d="M14 26.5C14 19 19 14.5 25 14.5c6.2 0 9.5 4.3 9.5 9.5H19.5c.4 5.2 4.6 8.5 10 8.5 2.8 0 5-.7 6.5-1.7" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FirefoxMark() {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFBD4F" /><stop offset=".5" stopColor="#FF4F5E" /><stop offset="1" stopColor="#9059FF" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${id})`} />
      <circle cx="26" cy="26" r="11" fill="#5B2BBF" opacity=".85" />
    </svg>
  );
}

export function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8ZM14.1 5.9c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z" />
    </svg>
  );
}

export function AndroidMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#3DDC84" d="M3 17a9 9 0 0 1 18 0Z" />
      <path d="m6.3 9.6-1.8-3M17.7 9.6l1.8-3" stroke="#3DDC84" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.4" cy="13.6" r="1.1" fill="#fff" /><circle cx="15.6" cy="13.6" r="1.1" fill="#fff" />
    </svg>
  );
}

/** Where to get each eGuard client. `null` means not published yet. */
export const STORE_LINKS = {
  googlePlay: "https://play.google.com/store/apps/details?id=com.devcom.eguard",
  appStore: null,
  chrome: "https://chromewebstore.google.com/detail/eguard-browser-protection/mbmebjjdmbnadjghjgakafhgmbhimadk",
  edge: "https://microsoftedge.microsoft.com/addons/detail/eguard-browser-protection/noapokcbieljofcaajebjdmddbjpeckd",
  firefox: null,
} as const;
