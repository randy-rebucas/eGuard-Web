/**
 * Why a "Continue with Google / LinkedIn" sign-in came back without signing in. The callback (app/auth) redirects
 * with ?oauth=<code>&provider=<provider>, and the sign-in, create account and security pages show the message.
 * No "server-only": the pages read it too.
 */
const MESSAGES: Record<string, (provider: string) => string> = {
  cancelled: (p) => `Sign-in with ${p} was cancelled. Nothing changed.`,
  expired: () => "That sign-in expired, or another one was started since. Try again.",
  wrong_password: (p) => `That password isn't right, so ${p} wasn't linked.`,
  password_not_set: (p) => `Set a password before linking ${p}.`,
  provider_unavailable: (p) => `Couldn't reach ${p}. Try again in a moment.`,
  provider_not_configured: (p) => `Sign in with ${p} isn't available right now. Use your email and password.`,
  invalid_token: (p) => `Sign-in with ${p} didn't work. Try again.`,
  email_required: (p) => `Your ${p} account needs a verified email address to use eGuard.`,
  guardian_required: (p) => `No eGuard account uses that ${p} account yet. To create one, confirm you're a parent or guardian, then continue with ${p} again.`,
  mailbox_taken: () => "An eGuard account already uses another spelling of this email. Sign in with your password instead.",
  linked_elsewhere: (p) => `That ${p} account already signs in to a different eGuard account.`,
  rate_limited: () => "Too many attempts. Wait a few minutes and try again.",
  failed: (p) => `Something went wrong signing in with ${p}. Try again.`,
};

const LABELS: Record<string, string> = { google: "Google", linkedin: "LinkedIn", apple: "Apple" };

/** The message for a callback's ?oauth= code, or null when there's none (or it's not one of ours). */
export function oauthMessage(code: unknown, provider: unknown): string | null {
  if (typeof code !== "string" || !Object.hasOwn(MESSAGES, code)) return null;
  return MESSAGES[code]((typeof provider === "string" && LABELS[provider]) || "that provider");
}
