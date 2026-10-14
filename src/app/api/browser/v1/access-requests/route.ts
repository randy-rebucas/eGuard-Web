import { z } from "zod";
import { authBrowser } from "@/lib/browser-service";
import { createAccessRequest, requestJson, requestsForInstallation } from "@/lib/browser-access";
import { browserError, browserJson, browserRoute, readBody } from "@/lib/browser-api";
import { LIMITS, hit } from "@/lib/rate-limit";

const Body = z.object({ domain: z.string().min(1).max(253), reason: z.string().max(280).nullish() });
const unauthorized = () => browserError(401, "This browser is no longer connected to eGuard.", "unauthorized");

/** The child asks a parent to open a blocked site. Asking again while one is open returns it (200). */
export function POST(req: Request) {
  return browserRoute(async () => {
    const inst = await authBrowser(req);
    if (!inst) return unauthorized();
    const parsed = Body.safeParse(await readBody(req));
    if (!parsed.success) return browserError(400, "That isn't a website address.", "invalid_domain");
    const { request, created } = await createAccessRequest(inst, parsed.data);
    return browserJson({ request: requestJson(request) }, created ? 201 : 200);
  });
}

/** This browser's recent requests and their answers. */
export function GET(req: Request) {
  return browserRoute(async () => {
    const inst = await authBrowser(req);
    if (!inst) return unauthorized();
    // Read on every block page; the page shows no request status meanwhile, nothing else is affected
    if ((await hit(`browseraccesslist:${inst.id}`, LIMITS.browserAccessList)).limited) {
      return browserError(429, "Too many requests. Try again in a few minutes.", "rate_limited");
    }
    return browserJson({ requests: (await requestsForInstallation(inst)).map(requestJson) });
  });
}