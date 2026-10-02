import "server-only";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { z } from "zod";
import { userForToken, type SessionUser } from "./auth";
import { ServiceError } from "./errors";
import { readText } from "./request-body";

/** Helpers for the parent mobile API (`/api/mobile/v1`). Auth is `Authorization: Bearer <session token>`. */

export const API_VERSION = "1";

export function bearer(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export const apiError = (status: number, error: string, code?: string) =>
  NextResponse.json({ error, ...(code ? { code } : {}) }, { status });

/** "iOS app" / "Android app" from the `X-eGuard-Client` header, used in history ("Randy on iOS app"). */
export function clientLabel(req: Request) {
  const c = (req.headers.get("x-eguard-client") ?? "").toLowerCase();
  return c === "ios" ? "iOS app" : c === "android" ? "Android app" : "mobile app";
}

export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown = {};
  const text = await readText(req);
  if (text) {
    try { raw = JSON.parse(text); } catch { throw new ServiceError(400, "Request body must be valid JSON.", "invalid_json"); }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
    throw new ServiceError(400, `${path}${issue.message}`, "invalid");
  }
  return parsed.data;
}

export function query<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new ServiceError(400, parsed.error.issues[0].message, "invalid");
  return parsed.data;
}

function toResponse(e: unknown) {
  unstable_rethrow(e); // Next's own control flow (e.g. bailing out of prerendering), not a failure
  if (e instanceof ServiceError) return apiError(e.status, e.message, e.code);
  if (e instanceof z.ZodError) return apiError(400, e.issues[0].message, "invalid");
  console.error("[mobile-api]", e);
  return apiError(500, "Something went wrong. Try again.", "server_error");
}

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (c: { req: Request; user: SessionUser; params: P }) => Promise<Response>;

/** Route handler that requires a signed-in parent. */
export function authed<P = Record<string, never>>(fn: Handler<P>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await userForToken(bearer(req));
      if (!user) return apiError(401, "Sign in again to continue.", "unauthorized");
      return await fn({ req, user, params: await ctx.params });
    } catch (e) {
      return toResponse(e);
    }
  };
}

/** Route handler that doesn't need a session (sign in, register, help articles). */
export function open<P = Record<string, never>>(fn: (c: { req: Request; params: P }) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      return await fn({ req, params: await ctx.params });
    } catch (e) {
      return toResponse(e);
    }
  };
}

/**
 * Body of a deletion (account, child, device, browser): the parent's `password`, or `confirm: "DELETE"` when the
 * account has none (`hasPassword: false`, Apple/Google sign-in).
 */
export const ConfirmBody = z.object({ password: z.string().max(200).optional(), confirm: z.string().max(20).optional() });

export function requireAdminUser(user: SessionUser) {
  if (user.role !== "FAMILY_ADMIN") throw new ServiceError(403, "Only the family admin can do this.", "forbidden");
}

/** Relative URL of a child's photo, cache-busted by its update time. */
export const photoUrl = (childId: string, updatedAt: Date | null | undefined) =>
  updatedAt ? `/api/mobile/v1/children/${childId}/photo?v=${updatedAt.getTime()}` : null;
