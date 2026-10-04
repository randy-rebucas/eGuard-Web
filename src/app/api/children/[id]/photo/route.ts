import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { ServiceError } from "@/lib/errors";
import { readCapped } from "@/lib/request-body";
import { PHOTO_MAX_BYTES, WEB_PHOTO_TYPES, checkPhoto, childPhotoSrc, photoType } from "@/lib/child-photo";

/**
 * A child's photo for the web, signed in with the session cookie (the mobile app has its own route with a bearer
 * token). GET serves it; PUT (the raw image as the body) and DELETE come from the child's Profile card.
 */

const fail = (e: unknown) => {
  if (e instanceof ServiceError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  throw e;
};

/** Signed-in parent, and a child in their family; writes must come from eGuard's own pages. */
async function access(req: Request, ctx: RouteContext<"/api/children/[id]/photo">, write = false) {
  const u = await getUser();
  if (!u) throw new ServiceError(401, "Sign in again to continue.", "unauthorized");
  // Belt and braces with SameSite cookies: another site can't make the parent's browser change a photo
  if (write && req.headers.get("sec-fetch-site") === "cross-site") throw new ServiceError(403, "Not allowed.", "forbidden");
  const { id } = await ctx.params;
  await childFor(u.familyId, id);
  return id;
}

export async function GET(req: Request, ctx: RouteContext<"/api/children/[id]/photo">) {
  try {
    const id = await access(req, ctx);
    const photo = await db.childPhoto.findUnique({ where: { childId: id } });
    if (!photo) return NextResponse.json({ error: "Photo not found.", code: "not_found" }, { status: 404 });
    // The URL carries the photo's version, so it can be cached for good; private: it's this family's child
    return new Response(new Uint8Array(photo.data), {
      headers: { "Content-Type": photo.contentType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request, ctx: RouteContext<"/api/children/[id]/photo">) {
  try {
    const id = await access(req, ctx, true);
    const declared = photoType(req.headers.get("content-type"), WEB_PHOTO_TYPES);
    const data = await readCapped(req, PHOTO_MAX_BYTES, "Choose an image under 2 MB.");
    checkPhoto(declared, data);
    const photo = await db.childPhoto.upsert({
      where: { childId: id },
      create: { childId: id, contentType: declared, data },
      update: { contentType: declared, data },
    });
    return NextResponse.json({ photo: childPhotoSrc(id, photo) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/children/[id]/photo">) {
  try {
    const id = await access(req, ctx, true);
    await db.childPhoto.deleteMany({ where: { childId: id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
