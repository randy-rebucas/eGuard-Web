import "server-only";
import { ServiceError } from "./errors";

/** Largest JSON body the mobile, device and browser APIs accept. Their real payloads are a few KB. */
export const MAX_JSON_BYTES = 64 * 1024;

/**
 * Reads the body, stopping as soon as it passes `max` bytes (Content-Length can be missing or wrong),
 * so an oversized request never sits whole in memory. Throws a 413 ServiceError when it's too large.
 */
export async function readCapped(req: Request, max: number, message = "The request is too large.") {
  const tooLarge = () => new ServiceError(413, message, "too_large");
  if (Number(req.headers.get("content-length") ?? 0) > max) throw tooLarge();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** The body as text, up to MAX_JSON_BYTES. */
export async function readText(req: Request, max = MAX_JSON_BYTES) {
  return (await readCapped(req, max)).toString("utf8");
}
