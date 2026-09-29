import { authBrowser } from "@/lib/browser-service";
import { HealthReport, recordHealth } from "@/lib/browser-health";
import { browserError, browserJson, browserRoute, readBody } from "@/lib/browser-api";

/**
 * The extension's self-checks and the policy version it enforces. eGuard compares them with the child's
 * current policy and raises or resolves the family's alerts (drift, private windows, Safe Browsing).
 */
export function POST(req: Request) {
  return browserRoute(async () => {
    const inst = await authBrowser(req);
    if (!inst) return browserError(401, "This browser is no longer connected to eGuard.", "unauthorized");
    const parsed = HealthReport.safeParse(await readBody(req));
    if (!parsed.success) return browserError(400, "That health report wasn't understood.", "invalid_report");
    return browserJson({ ok: true, ...(await recordHealth(inst, parsed.data)) });
  });
}
