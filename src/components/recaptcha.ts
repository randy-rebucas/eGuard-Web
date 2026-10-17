/** Google reCAPTCHA v3's script, loaded once on demand (lib/bot-check checks the tokens on the server). */

declare global {
  interface Window {
    grecaptcha?: { ready: (cb: () => void) => void; execute: (siteKey: string, o: { action: string }) => Promise<string> };
  }
}

let recaptchaScript: Promise<void> | undefined;
export function loadRecaptcha(siteKey: string) {
  return (recaptchaScript ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    s.async = true;
    s.onload = () => window.grecaptcha?.ready(() => resolve());
    s.onerror = () => { recaptchaScript = undefined; reject(new Error("reCAPTCHA didn't load")); };
    document.head.appendChild(s);
  }));
}

/** A fresh token for `action`, loading the script first if needed. Null if Google can't be reached (the server lets that through). */
export async function recaptchaToken(siteKey: string, action: string) {
  try {
    await loadRecaptcha(siteKey);
    return await window.grecaptcha!.execute(siteKey, { action });
  } catch {
    return null;
  }
}
