import { NextResponse } from "next/server";
import { z } from "zod";
import { handlePlayNotification } from "@/lib/billing";
import { googlePlayConfig } from "@/lib/google-play";
import { ServiceError } from "@/lib/errors";
import { readText } from "@/lib/request-body";
import { verifyIdToken } from "@/lib/social-auth";

/**
 * Google Play Real-time Developer Notifications, delivered by a Cloud Pub/Sub push subscription with
 * authentication turned on. Pub/Sub signs each push with a Google OIDC token for the subscription's
 * service account; we accept only that account and audience:
 *   GOOGLE_PLAY_RTDN_AUDIENCE          the audience set on the push subscription (e.g. this URL)
 *   GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT   the push subscription's service account email
 */

const Message = z.object({ message: z.object({ data: z.string() }) });
const Notification = z.object({
  packageName: z.string(),
  subscriptionNotification: z.object({ purchaseToken: z.string(), notificationType: z.number().optional() }).optional(),
  voidedPurchaseNotification: z.object({ purchaseToken: z.string() }).optional(),
  testNotification: z.unknown().optional(),
});

export async function POST(req: Request) {
  const audience = process.env.GOOGLE_PLAY_RTDN_AUDIENCE?.trim();
  const pusher = process.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT?.trim().toLowerCase();
  const cfg = googlePlayConfig();
  if (!audience || !pusher || !cfg) return NextResponse.json({ error: "Not configured" }, { status: 501 });

  const auth = req.headers.get("authorization") ?? "";
  try {
    const id = await verifyIdToken("google", auth.startsWith("Bearer ") ? auth.slice(7).trim() : "", { audiences: [audience] });
    if (!id.emailVerified || id.email !== pusher) throw new ServiceError(401, "unexpected sender", "invalid_token");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let n: z.infer<typeof Notification>;
  try {
    const msg = Message.parse(JSON.parse(await readText(req)));
    n = Notification.parse(JSON.parse(Buffer.from(msg.message.data, "base64").toString("utf8")));
  } catch {
    // Malformed messages would be redelivered forever; acknowledge and drop them
    return NextResponse.json({ ok: true, ignored: "malformed" });
  }
  if (n.packageName !== cfg.packageName) return NextResponse.json({ ok: true, ignored: "package" });

  const token = n.voidedPurchaseNotification?.purchaseToken ?? n.subscriptionNotification?.purchaseToken;
  if (!token) return NextResponse.json({ ok: true, ignored: "type" });
  try {
    const r = await handlePlayNotification({ purchaseToken: token, voided: !!n.voidedPurchaseNotification }, { cfg });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    // A non-2xx makes Pub/Sub retry later, which is what we want when Google Play is briefly unreachable
    console.error("[billing] RTDN failed", e);
    return NextResponse.json({ error: "Try again" }, { status: 503 });
  }
}
