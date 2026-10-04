import { ServiceError } from "./errors";

/**
 * Child photos, stored in ChildPhoto (one per child). The mobile API (bearer token) and the web (session cookie)
 * each have a route; both check uploads here.
 */

/** What the mobile app may upload. HEIC is how iPhones save photos. */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
/** What the web uploads: browsers other than Safari can't draw HEIC, and the web page re-encodes to JPEG anyway. */
export const WEB_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** The image type the bytes really are (magic bytes), so nothing but an image is stored or served. */
export function sniffImage(b: Uint8Array) {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|mif1|msf1)$/.test(ascii(8, 12))) return "image/heic";
  return null;
}

/** The declared Content-Type, if it's one of `types`; otherwise a 415 the parent can act on. */
export function photoType(header: string | null, types = PHOTO_TYPES) {
  const declared = (header ?? "").split(";")[0].trim().toLowerCase();
  if (!types.includes(declared)) {
    throw new ServiceError(415, types.includes("image/heic") ? "Upload a JPEG, PNG, WebP or HEIC image." : "Upload a JPEG, PNG or WebP image.", "unsupported_media_type");
  }
  return declared;
}

/** Throws unless `data` is a non-empty image of the declared type. */
export function checkPhoto(declared: string, data: Uint8Array) {
  if (!data.length) throw new ServiceError(400, "The image is empty.", "invalid");
  if (sniffImage(data) !== declared) throw new ServiceError(415, "That file isn't a valid image.", "unsupported_media_type");
}

/**
 * Where the web shows a child's photo, or null for initials. `v` changes with each upload, so the long cache on the
 * image never shows an old photo. HEIC (from an iPhone) gets initials: most browsers can't draw it.
 */
export function childPhotoSrc(childId: string, photo: { updatedAt: Date; contentType: string } | null | undefined) {
  if (!photo || !WEB_PHOTO_TYPES.includes(photo.contentType)) return null;
  return `/api/children/${childId}/photo?v=${photo.updatedAt.getTime()}`;
}
