import { getUser } from "@/lib/auth";
import { EXPORT_FILENAME, exportFamily } from "@/lib/account-export";

/**
 * Full export of the family's data (see lib/account-export).
 * POST, since it writes to the audit log: a GET could be fired by a link or prefetch. The session cookie
 * is SameSite=Lax, so another site can't submit this for the parent.
 */
export async function POST() {
  const u = await getUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  return new Response(JSON.stringify(await exportFamily(u), null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${EXPORT_FILENAME}"` },
  });
}
