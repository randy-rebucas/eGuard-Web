import "server-only";
import { NextResponse } from "next/server";
import { db } from "./db";
import { sha256 } from "./auth";
import { readText } from "./request-body";
import { ServiceError } from "./errors";

/** Resolves the device from `Authorization: Bearer <device token>`. */
export async function authDevice(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  return db.device.findUnique({ where: { tokenHash: sha256(token) }, include: { child: true } });
}

/**
 * `code: "device_unknown"`: no device has this token (a parent removed it, or it was never paired). Apps unpair only
 * on this code, so a 401 without it (a proxy, an outage) never wipes a child's phone.
 */
export const unauthorized = () =>
  NextResponse.json({ error: "Invalid or missing device token", code: "device_unknown" }, { status: 401 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

/** A 429 with `Retry-After` (seconds until the limit's window resets), so a device backs off instead of retrying at once. */
export const tooMany = (message: string, retryAfter: number) =>
  NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfter))) } });

/** What readJson returns for a body over MAX_JSON_BYTES: routes answer it with `tooLarge()` (413). */
export const TOO_LARGE = Symbol("too large");
export const tooLarge = () => NextResponse.json({ error: "The request is too large." }, { status: 413 });

/**
 * The parsed body, or null when it's empty or not JSON. Over MAX_JSON_BYTES (read no further than that) it's
 * TOO_LARGE, so the device hears 413 (send less) rather than 400 (malformed).
 */
export async function readJson(req: Request): Promise<unknown> {
  let text: string;
  try { text = await readText(req); } catch (e) {
    return e instanceof ServiceError && e.status === 413 ? TOO_LARGE : null;
  }
  try { return JSON.parse(text); } catch { return null; }
}
