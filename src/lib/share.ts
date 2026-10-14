import { siteUrl } from "./site";

/**
 * What a parent sends when they tell someone about eGuard from Settings › Share eGuard. The Android and iOS apps'
 * Share eGuard rows use the same wording, kept in their own strings so the share sheet works offline: change all three
 * together. Only the public site's address and general wording: nothing about the family and no tracking parameters,
 * so the person it reaches learns nothing about who sent it.
 */
export function shareMessage() {
  const url = `${siteUrl()}/`;
  const text = "I use eGuard to help keep my kids safe on their phones: screen time, bedtime, app and website rules, and location, each one checked on the device. It's free to start.";
  return { title: "eGuard parental controls", text, url, message: `${text} ${url}` };
}

export type ShareMessage = ReturnType<typeof shareMessage>;

/** Each app's own "share this" link, opened in a new tab (or the app, on a phone). */
export const SHARE_CHANNELS = [
  { id: "facebook", label: "Facebook", href: (s: ShareMessage) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(s.url)}` },
  { id: "messenger", label: "Messenger", href: (s: ShareMessage) => `fb-messenger://share/?link=${encodeURIComponent(s.url)}`, phoneOnly: true },
  { id: "viber", label: "Viber", href: (s: ShareMessage) => `viber://forward?text=${encodeURIComponent(s.message)}`, phoneOnly: true },
  { id: "whatsapp", label: "WhatsApp", href: (s: ShareMessage) => `https://wa.me/?text=${encodeURIComponent(s.message)}` },
  { id: "x", label: "X", href: (s: ShareMessage) => `https://x.com/intent/post?text=${encodeURIComponent(s.text)}&url=${encodeURIComponent(s.url)}` },
  { id: "email", label: "Email", href: (s: ShareMessage) => `mailto:?subject=${encodeURIComponent(s.title)}&body=${encodeURIComponent(s.message)}` },
  { id: "sms", label: "Text message", href: (s: ShareMessage) => `sms:?&body=${encodeURIComponent(s.message)}`, phoneOnly: true },
] as const;
