import "server-only";
import { NextResponse } from "next/server";
import { ServiceError } from "./errors";

/** JSON for the browser extension; credentials and policies must never be cached. */
export const browserJson = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const browserError = (status: number, error: string, code: string) => browserJson({ error, code }, status);

/** Runs a /api/browser/v1 handler: parent-safe ServiceErrors become `{ error, code }`, anything else is a 500. */
export async function browserRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ServiceError) return browserError(e.status, e.message, e.code ?? "error");
    console.error("[browser-api]", e);
    return browserError(500, "eGuard is having trouble right now.", "server_error");
  }
}

export async function readBody(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return null; }
}
