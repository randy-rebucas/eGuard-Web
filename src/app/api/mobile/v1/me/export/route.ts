import { EXPORT_FILENAME, exportFamily } from "@/lib/account-export";
import { authed } from "@/lib/mobile-api";

/**
 * Settings › Export my data: the same JSON file as the website's export. The app saves or shares it
 * (Files / share sheet). POST, since each export is recorded in the family's audit log.
 */
export const POST = authed(async ({ user }) => new Response(JSON.stringify(await exportFamily(user), null, 2), {
  headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${EXPORT_FILENAME}"`, "Cache-Control": "no-store" },
}));
