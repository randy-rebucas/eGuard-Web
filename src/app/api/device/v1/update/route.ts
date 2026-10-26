import { NextResponse } from "next/server";
import { authDevice, unauthorized } from "@/lib/device-auth";
import { signPolicy } from "@/lib/browser-policy";
import { desktopRelease } from "@/lib/desktop-release";
import { ServiceError } from "@/lib/errors";
import { LIMITS, hit } from "@/lib/rate-limit";

/**
 * The desktop agent's update (desktop-agent spec section 10, "Updates"): the current release's files, in a manifest
 * signed like the catalog, so a computer installs only what eGuard signed. `{ manifest: null }` when no release is
 * set (DESKTOP_RELEASE). The agent compares versions itself (it asks every few hours, and at once when /sync's
 * minAppVersion is above its own), and refuses a manifest issued before the last one it accepted. Computers only.
 */
export async function GET(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  if (device.kind !== "COMPUTER") return NextResponse.json({ error: "Updates are for computers." }, { status: 404 });
  if ((await hit(`deviceupdate:${device.id}`, LIMITS.deviceUpdate)).limited) {
    return NextResponse.json({ error: "Too many update requests. Try again later." }, { status: 429 });
  }
  try {
    const release = desktopRelease();
    if (!release) return NextResponse.json({ manifest: null });
    // issuedAt is signed with the rest, so an agent can refuse an older manifest replayed by someone answering for the
    // server
    const manifest = { type: "eguard.desktop.update", version: release.version, issuedAt: Date.now(), files: release.files };
    return NextResponse.json({ manifest, ...signPolicy(manifest) });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    throw e;
  }
}
