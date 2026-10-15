import "server-only";
import { ServiceError } from "./errors";

/**
 * Google reCAPTCHA v3 on the website's sign-in, create-account and forgot-password forms, so a botnet spread over
 * many addresses (which the per-address rate limits can't see) can't spray passwords or create accounts in bulk. v3
 * never shows a puzzle: Google scores each submission from 0 (a bot) to 1 (a person), and a score under
 * RECAPTCHA_MIN_SCORE (default 0.5) is turned down.
 * - On when RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY are both set; otherwise nothing is checked (development, tests).
 * - If Google can't be reached, the form goes through: an outage there mustn't lock every parent out.
 * - The apps don't use it. The mobile API has the same rate limits, and creating an account needs the emailed code.
 */

export const BOT_CHECK_FAILED = "We couldn't confirm this was sent by a person. Wait a moment and try again.";

const secret = () => process.env.RECAPTCHA_SECRET_KEY?.trim() || null;

/** The site key for the forms' script, or null when the check is off. */
export const botCheckSiteKey = () => (secret() ? process.env.RECAPTCHA_SITE_KEY?.trim() || null : null);

/** The hidden field the forms put the reCAPTCHA token in (components/auth-forms BotCheck). */
export const BOT_CHECK_FIELD = "g-recaptcha-response";

/** Scores below this are treated as a bot. */
const minScore = () => {
  const n = Number(process.env.RECAPTCHA_MIN_SCORE);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.5;
};

/** Throws 400 `bot_check` unless the token is valid for this form (`action`: "login", "register", "reset") and scores a person. */
export async function verifyHuman(token: FormDataEntryValue | null, ip: string | null, action: string) {
  const key = secret();
  if (!key || !botCheckSiteKey()) return;
  if (typeof token !== "string" || !token) throw new ServiceError(400, BOT_CHECK_FAILED, "bot_check");
  let data: { success?: boolean; score?: number; action?: string; "error-codes"?: string[] };
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: key, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    console.warn("[bot-check] reCAPTCHA unreachable, letting the form through", e instanceof Error ? e.message : e);
    return;
  }
  if (data.success && data.action === action && (data.score ?? 0) >= minScore()) return;
  // Logged so a threshold that turns away real parents shows up
  if (data.success) console.info("[bot-check] turned down", { action, tokenAction: data.action, score: data.score });
  throw new ServiceError(400, BOT_CHECK_FAILED, "bot_check");
}
