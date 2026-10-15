import type { Intent } from "./oauth-web";

/**
 * Where a "Continue with Google / LinkedIn" that didn't sign in goes back to, with ?oauth=<code> for the page's
 * message (lib/oauth-errors). A sign-in for an account that doesn't exist yet goes to create account, which has
 * the guardian confirmation it needs.
 */
export function failurePath(intent: Intent, code: string, provider: string, next: string | null) {
  const q = new URLSearchParams({ oauth: code, provider });
  if (intent === "link") return `/settings/security?${q}`;
  if (intent === "register" || code === "guardian_required") return `/register?${q}`;
  if (next) q.set("next", next);
  return `/login?${q}`;
}
