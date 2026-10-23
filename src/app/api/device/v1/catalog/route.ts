import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authDevice, unauthorized } from "@/lib/device-auth";
import { canonicalJson, signPolicy } from "@/lib/browser-policy";
import { ServiceError } from "@/lib/errors";
import { LIMITS, hit } from "@/lib/rate-limit";

/**
 * The desktop agent's catalog (lib/desktop-catalog.ts): games to always report, and publishers to skip. Signed like the
 * browser policy, so a computer can trust the copy it keeps. `version` is a hash of the entries, so any change shows,
 * a removed entry too; the agent sends the one it has as `?since=` and gets `{ version, unchanged: true }` when it's
 * the same. 503 when signing isn't configured: the agent keeps the copy it has.
 */
export async function GET(req: Request) {
  const device = await authDevice(req);
  if (!device) return unauthorized();
  if ((await hit(`devicecatalog:${device.id}`, LIMITS.deviceCatalog)).limited) {
    return NextResponse.json({ error: "Too many catalog requests. Try again later." }, { status: 429 });
  }
  const entries = await db.desktopCatalogEntry.findMany({
    orderBy: [{ kind: "asc" }, { matchType: "asc" }, { match: "asc" }],
    select: { kind: true, matchType: true, match: true, displayName: true, category: true, trending: true },
  });
  const version = createHash("sha256").update(canonicalJson(entries)).digest("hex").slice(0, 16);
  if (new URL(req.url).searchParams.get("since") === version) return NextResponse.json({ version, unchanged: true });
  // issuedAt is signed with the rest: the version can't say which catalog is newer, this lets an agent refuse an older
  // one replayed by someone answering for the server
  const catalog = { type: "eguard.desktop.catalog", version, issuedAt: Date.now(), entries };
  try {
    return NextResponse.json({ catalog, ...signPolicy(catalog) });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    throw e;
  }
}
