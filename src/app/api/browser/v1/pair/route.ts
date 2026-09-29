import { z } from "zod";
import { pairBrowser } from "@/lib/browser-service";
import { browserError, browserJson, browserRoute, readBody } from "@/lib/browser-api";
import { LIMITS, clientIpFrom, hit, ipKey } from "@/lib/rate-limit";

const Body = z.object({
  // Parents may type "ABCD-2345" or "abcd 2345"
  code: z.string().transform((s) => s.replace(/[\s-]/g, "").toUpperCase()).pipe(z.string().min(6).max(12)),
  browser: z.string().trim().min(1).max(40),
  browserVersion: z.string().trim().max(40).nullable(),
  extensionVersion: z.string().trim().min(1).max(20),
  platform: z.string().trim().min(1).max(40),
});

/** Exchange a one-time BROWSER pairing code (from the parent dashboard) for installation credentials. */
export function POST(req: Request) {
  return browserRoute(async () => {
    // Shares the per-address budget with device pairing: codes are guessable in either place
    if ((await hit(ipKey("pair", clientIpFrom(req.headers)), LIMITS.pairIp)).limited) {
      return browserError(429, "Too many attempts. Wait a few minutes and try again.", "rate_limited");
    }
    const parsed = Body.safeParse(await readBody(req));
    if (!parsed.success) return browserError(400, "Pairing code is invalid or expired", "invalid_code");
    return browserJson(await pairBrowser(parsed.data), 201);
  });
}
