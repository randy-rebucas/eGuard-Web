import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER } from "@/lib/return-to";

/**
 * Tells requireUser() which signed-in page was asked for, so signing in can return there (an alert email's
 * "Review request" link, a bookmark). Always overwritten, so a client can't send its own.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

/** Only the signed-in pages; never static files, images or the APIs. */
export const config = {
  matcher: [
    "/dashboard/:path*", "/children/:path*", "/devices/:path*", "/location/:path*", "/notifications/:path*",
    "/protection/:path*", "/reports/:path*", "/settings/:path*", "/organizations/:path*",
  ],
};
