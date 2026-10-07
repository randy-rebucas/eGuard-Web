/**
 * The staff console's host (docs/console.md). src/proxy.ts rewrites every request on it to the /console pages, and
 * hides those pages on every other host. No "server-only", since the proxy uses it.
 */

/** The production console. */
export const CONSOLE_HOST = "console.eguard.family";

/**
 * The staff session cookie (lib/staff-auth). __Host-: the browser refuses it unless Secure, path=/ and no Domain,
 * so no other subdomain can set or read it. Plain in development, which runs over http.
 */
export const STAFF_COOKIE = process.env.NODE_ENV === "production" ? "__Host-eg_staff" : "eg_staff";

/** Console paths a signed-out visitor may open; anything else without the cookie is sent to /login by the proxy. */
export const CONSOLE_PUBLIC = ["/login", "/robots.txt"];

/**
 * Whether a request's Host header is the console: console.eguard.family, console.localhost (any port) in
 * development, or CONSOLE_HOST when set (a preview deployment's own console host).
 */
export function isConsoleHost(host: string | null | undefined, env: Record<string, string | undefined> = process.env) {
  if (!host) return false;
  const name = host.trim().toLowerCase().replace(/:\d+$/, "");
  if (name === CONSOLE_HOST) return true;
  const extra = env.CONSOLE_HOST?.trim().toLowerCase();
  if (extra && name === extra) return true;
  return env.NODE_ENV !== "production" && name === "console.localhost";
}
