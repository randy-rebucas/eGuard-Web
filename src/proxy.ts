import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER } from "@/lib/return-to";
import { CONSOLE_PUBLIC, STAFF_COOKIE, isConsoleHost } from "@/lib/console-host";

/** The signed-in parent pages: requireUser() is told which one was asked for. */
const SIGNED_IN = [
  "/dashboard", "/children", "/devices", "/location", "/notifications", "/protection", "/reports", "/settings", "/organizations",
];

/** The staff console's pages live under this path, and are only ever reached through the console host. */
const CONSOLE = "/console";

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // console.eguard.family: every path is a console page (/families → /console/families). Nothing else of the site,
  // its APIs included, answers on that host.
  if (isConsoleHost(request.headers.get("host"))) {
    // Signed out: straight to sign-in, before any page renders. Having the cookie isn't being signed in; the pages
    // check the session itself (requireStaff).
    if (!request.cookies.has(STAFF_COOKIE) && !CONSOLE_PUBLIC.includes(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.rewrite(new URL(`${CONSOLE}${pathname === "/" ? "" : pathname}${search}`, request.url));
  }

  // Anywhere else the console doesn't exist: a path no page matches, so the site's own 404
  if (under(pathname, CONSOLE)) return NextResponse.rewrite(new URL("/_console-not-found", request.url));

  // Tells requireUser() which signed-in page was asked for, so signing in can return there (an alert email's
  // "Review request" link, a bookmark). Always overwritten, so a client can't send its own.
  if (SIGNED_IN.some((p) => under(pathname, p))) {
    const headers = new Headers(request.headers);
    headers.set(PATH_HEADER, pathname + search);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

/**
 * Every request but Next's own files and public images: the console host has to see all its paths (robots.txt
 * included) to keep the site's pages and APIs off it. Elsewhere the proxy only compares the host and the path.
 */
export const config = {
  matcher: ["/((?!_next/|__nextjs|favicon\\.ico$|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$).*)"],
};
