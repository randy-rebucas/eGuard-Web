import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { notFound } from "@/lib/errors";
import { authed, photoUrl } from "@/lib/mobile-api";
import { readCapped } from "@/lib/request-body";
import { PHOTO_MAX_BYTES, checkPhoto, photoType } from "@/lib/child-photo";

/** The child's photo. Needs the parent's bearer token like every other endpoint. */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  await childFor(user.familyId, params.id);
  const photo = await db.childPhoto.findUnique({ where: { childId: params.id } });
  if (!photo) throw notFound("Photo");
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
});

/** Upload the raw image as the request body (Content-Type: image/jpeg, png, webp or heic; up to 2 MB). */
export const PUT = authed<{ id: string }>(async ({ req, user, params }) => {
  await childFor(user.familyId, params.id);
  const declared = photoType(req.headers.get("content-type"));
  const data = await readCapped(req, PHOTO_MAX_BYTES, "Choose an image under 2 MB.");
  checkPhoto(declared, data);
  const photo = await db.childPhoto.upsert({
    where: { childId: params.id },
    create: { childId: params.id, contentType: declared, data },
    update: { contentType: declared, data },
  });
  return NextResponse.json({ photoUrl: photoUrl(params.id, photo.updatedAt) });
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await childFor(user.familyId, params.id);
  await db.childPhoto.deleteMany({ where: { childId: params.id } });
  return NextResponse.json({ ok: true });
});
