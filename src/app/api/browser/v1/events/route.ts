import { authBrowser } from "@/lib/browser-service";
import { EventsReport, recordEvents } from "@/lib/browser-health";
import { browserError, browserJson, browserRoute, readBody } from "@/lib/browser-api";

/** One day's blocked-page counts per category. Counts only: never a site, and nothing finer than a day. */
export function POST(req: Request) {
  return browserRoute(async () => {
    const inst = await authBrowser(req);
    if (!inst) return browserError(401, "This browser is no longer connected to eGuard.", "unauthorized");
    const parsed = EventsReport.safeParse(await readBody(req));
    if (!parsed.success) return browserError(400, "Those counts weren't understood.", "invalid_report");
    return browserJson({ ok: true, ...(await recordEvents(inst, parsed.data)) });
  });
}
