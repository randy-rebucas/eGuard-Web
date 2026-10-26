import { z } from "zod";
import { ServiceError } from "@/lib/errors";

/** The desktop agent's program files: an update carries all three, so the guard's copy is always one version. */
const PROGRAMS = ["eguard-service.exe", "eguard-agent.exe", "eguard-guard.exe"] as const;

const File = z.object({
  name: z.enum(PROGRAMS),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  url: z.string().url().refine((u) => /^https?:\/\//.test(u)),
});

const Release = z.object({
  version: z.string().max(20).regex(/^\d+(\.\d+){0,3}$/),
  files: z.array(File).length(3).refine((f) => new Set(f.map((x) => x.name)).size === 3, "each program once"),
});

export type DesktopRelease = z.infer<typeof Release>;

/**
 * The Windows agent's current release (desktop-agent spec section 10, "Updates"), from DESKTOP_RELEASE: JSON
 * `{ "version": "0.2.0", "files": [{ "name", "size", "sha256", "url" }] }` naming the three program files of a build
 * signed with eGuard's code-signing certificate, uploaded where computers can download them (https). null when
 * unset: no update is offered. A value that doesn't parse is a mistake in the deployment, not "no update": 503, so
 * it shows. The agent checks everything again (signature, names, hashes, Authenticode, its own version).
 */
export function desktopRelease(raw = process.env.DESKTOP_RELEASE): DesktopRelease | null {
  const v = raw?.trim();
  if (!v) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    parsed = undefined;
  }
  const r = Release.safeParse(parsed);
  if (!r.success) {
    console.error("[device] DESKTOP_RELEASE is malformed", r.error?.issues[0]);
    throw new ServiceError(503, "eGuard can't offer updates right now. Try again later.", "release_misconfigured");
  }
  return r.data;
}
