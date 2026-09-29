import { authBrowser } from "@/lib/browser-service";
import { policyForInstallation } from "@/lib/browser-policy";
import { browserError, browserJson, browserRoute } from "@/lib/browser-api";

/**
 * The child's browser policy for this installation, signed (ECDSA P-256 over canonical JSON) so the extension
 * can reject anything that didn't come from eGuard. Counts as a check-in; a removed browser gets 401.
 */
export function GET(req: Request) {
  return browserRoute(async () => {
    const inst = await authBrowser(req);
    if (!inst) return browserError(401, "This browser is no longer connected to eGuard.", "unauthorized");
    return browserJson(await policyForInstallation(inst));
  });
}
