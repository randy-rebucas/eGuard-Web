import { describe, expect, it } from "vitest";
import { PHOTO_TYPES, WEB_PHOTO_TYPES, checkPhoto, childPhotoSrc, photoType, sniffImage } from "../child-photo";

const bytes = (...b: number[]) => new Uint8Array([...b, ...Array(16).fill(0)]);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"));
const HEIC = bytes(0, 0, 0, 0x18, ...ascii("ftypheic"));

describe("sniffImage", () => {
  it("knows each image type by its first bytes", () => {
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(PNG)).toBe("image/png");
    expect(sniffImage(WEBP)).toBe("image/webp");
    expect(sniffImage(HEIC)).toBe("image/heic");
  });
  it("is null for anything else", () => {
    expect(sniffImage(bytes(...ascii("<svg")))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("photoType", () => {
  it("reads the declared type, ignoring parameters and case", () => {
    expect(photoType("Image/JPEG; charset=binary")).toBe("image/jpeg");
  });
  it("lets the app send HEIC, but not the web", () => {
    expect(photoType("image/heic", PHOTO_TYPES)).toBe("image/heic");
    expect(() => photoType("image/heic", WEB_PHOTO_TYPES)).toThrow("Upload a JPEG, PNG or WebP image.");
  });
  it("refuses other types with a 415", () => {
    expect(() => photoType("image/svg+xml")).toThrow(expect.objectContaining({ status: 415 }));
    expect(() => photoType(null)).toThrow(expect.objectContaining({ status: 415 }));
  });
});

describe("checkPhoto", () => {
  it("accepts an image that is what it says", () => {
    expect(() => checkPhoto("image/png", PNG)).not.toThrow();
  });
  it("refuses an empty body and a file in disguise", () => {
    expect(() => checkPhoto("image/jpeg", new Uint8Array())).toThrow("The image is empty.");
    expect(() => checkPhoto("image/jpeg", PNG)).toThrow("That file isn't a valid image.");
  });
});

describe("childPhotoSrc", () => {
  const at = new Date("2026-10-04T08:00:00Z");
  it("versions the URL, so a new photo is never hidden by the cache", () => {
    expect(childPhotoSrc("c1", { updatedAt: at, contentType: "image/jpeg" })).toBe(`/api/children/c1/photo?v=${at.getTime()}`);
  });
  it("gives initials without a photo, and for HEIC most browsers can't draw", () => {
    expect(childPhotoSrc("c1", null)).toBeNull();
    expect(childPhotoSrc("c1", { updatedAt: at, contentType: "image/heic" })).toBeNull();
  });
});
