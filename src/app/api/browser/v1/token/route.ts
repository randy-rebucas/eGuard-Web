import { z } from "zod";
import { refreshBrowserTokens } from "@/lib/browser-service";
import { browserError, browserJson, browserRoute, readBody } from "@/lib/browser-api";
import { LIMITS, clientIpFrom, hit, ipKey } from "@/lib/rate-limit";

const Body = z.object({ installationId: z.string().min(1).max(40), refreshToken: z.string().min(20).max(200) });

const limited = () => browserError(429, "Too many attempts. Wait a few minutes and try again.", "rate_limited");

/** Rotate the refresh token and get a new 15-minute access token. */
export function POST(req: Request) {
  return browserRoute(async () => {
    if ((await hit(ipKey("browser-token", clientIpFrom(req.headers)), LIMITS.browserTokenIp)).limited) return limited();
    const parsed = Body.safeParse(await readBody(req));
    if (!parsed.success) return browserError(401, "This browser is no longer connected to eGuard.", "unauthorized");
    if ((await hit(`browser-token:${parsed.data.installationId}`, LIMITS.browserTokenInstallation)).limited) return limited();
    return browserJson(await refreshBrowserTokens(parsed.data.installationId, parsed.data.refreshToken));
  });
}
