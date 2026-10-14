import { planWith } from "./plans";

/**
 * Sentences that tell a parent to buy or upgrade. The iPhone app mustn't show them (App Store guideline 3.1.1: no
 * pointing to purchases outside the app), so alerts, pushes and messages sent to it drop them; the web and Android
 * keep them. Each must be written as its own sentence so dropping it leaves the rest readable.
 */
export const APPS_UPGRADE = `See and manage every app with ${planWith((e) => e.appMonitoringLimit == null).name}.`;
export const KEEP_PLAN = "Buy another pass or turn on auto-renew in Settings › Subscription to keep it.";
export const KEEP_SPONSORED = "To keep the same features, choose a plan in Settings › Subscription.";

const PURCHASE_SENTENCES = [APPS_UPGRADE, KEEP_PLAN, KEEP_SPONSORED];

/** `text` without the purchase sentences, for the iPhone app. */
export function storeNeutral(text: string) {
  let out = text;
  for (const s of PURCHASE_SENTENCES) out = out.split(s).join("");
  return out.replace(/\s{2,}/g, " ").trim();
}

/** The text for a client: unchanged except on iOS. */
export const forClient = (text: string, ios: boolean) => (ios ? storeNeutral(text) : text);
