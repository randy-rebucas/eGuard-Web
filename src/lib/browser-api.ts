import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { ServiceError } from "./errors";
import { readText } from "./request-body";

/** JSON for the browser extension; credentials and policies must never be cached. */
export const browserJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const browserError = (status: number, error: string, code: string) => browserJson({ error, code }, status);

/** Runs a /api/browser/v1 handler: parent-safe ServiceErrors become `{ error, code }`, anything else is a 500. */
export async function browserRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e); // Next's own control flow (e.g. bailing out of prerendering), not a failure
    if (e instanceof ServiceError) return browserError(e.status, e.message, e.code ?? "error");
    console.error("[browser-api]", e);
    return browserError(500, "eGuard is having trouble right now.", "server_error");
  }
}

/** The parsed body, or null when it's empty or not JSON. Past MAX_JSON_BYTES it throws a 413 (browserRoute answers it). */
export async function readBody(req: Request): Promise<unknown> {
  const text = await readText(req);
  try { return JSON.parse(text); } catch { return null; }
}
