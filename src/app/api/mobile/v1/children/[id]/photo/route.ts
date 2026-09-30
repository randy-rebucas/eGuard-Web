import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { childFor } from "@/lib/config-service";
import { ServiceError, notFound } from "@/lib/errors";
import { authed, photoUrl } from "@/lib/mobile-api";
import { readCapped } from "@/lib/request-body";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES = 2 * 1024 * 1024;

/** Checks the file really is the image type it claims (magic bytes), so nothing else is stored or served. */
function sniff(b: Buffer) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (b.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|mif1|msf1)$/.test(b.subarray(8, 12).toString("latin1"))) return "image/heic";
  return null;
}

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
  const declared = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!TYPES.includes(declared)) throw new ServiceError(415, "Upload a JPEG, PNG, WebP or HEIC image.", "unsupported_media_type");
  const data = await readCapped(req, MAX_BYTES, "Choose an image under 2 MB.");
  if (!data.length) throw new ServiceError(400, "The image is empty.", "invalid");
  if (sniff(data) !== declared) throw new ServiceError(415, "That file isn't a valid image.", "unsupported_media_type");
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
