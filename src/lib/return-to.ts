/**
 * Where to send a parent after they sign in: the signed-in page they asked for. No "server-only", since
 * src/proxy.ts uses it too.
 */

/** Request header src/proxy.ts sets to the path (and query) of a signed-in page. */
export const PATH_HEADER = "x-eg-path";

/** Paths that would send the parent straight back to signing in. */
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password", "/accept-invite"];

/**
 * `next` if it's a path on this site to return to, otherwise null. Only a single leading slash is allowed:
 * "//evil.example" and "/\evil.example" are other sites to a browser, so they'd make this an open redirect.
 */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || next.length > 512) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  // Control characters (tabs, newlines) are dropped by URL parsers and can turn "/\t/evil" into "//evil"
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;
  const path = next.split(/[?#]/)[0];
  if (AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return next;
}

/** /login, carrying the page to return to when there is one worth keeping. */
export function loginPath(next: string | null) {
  return next && next !== "/dashboard" ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
