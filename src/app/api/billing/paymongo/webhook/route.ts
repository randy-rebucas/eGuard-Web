import { NextResponse } from "next/server";
import { handlePaymongoEvent } from "@/lib/web-billing";
import { parseWebhookEvent, paymongoConfig, verifyWebhookSignature } from "@/lib/paymongo";
import { readText } from "@/lib/request-body";

/**
 * PayMongo webhooks: checkout_session.payment.paid, subscription.* and refund.succeeded. Register this
 * URL once per mode (test, live) in the PayMongo dashboard and put its secret in PAYMONGO_WEBHOOK_SECRET.
 *
 * Handling re-reads the purchase from PayMongo, so a repeated or replayed delivery changes nothing.
 */
export async function POST(req: Request) {
  const cfg = paymongoConfig();
  if (!cfg?.webhookSecret) return NextResponse.json({ error: "Not configured" }, { status: 501 });

  // The signature covers the exact bytes PayMongo sent, so read the body raw (capped: this runs before the signature check)
  let raw: string;
  try { raw = await readText(req); } catch { return NextResponse.json({ error: "Too large" }, { status: 413 }); }
  if (!verifyWebhookSignature(req.headers.get("paymongo-signature"), raw, cfg.webhookSecret, cfg.livemode)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const event = parseWebhookEvent(raw);
  // Anything but 2xx is retried up to 12 times, so acknowledge what we can't or needn't use
  if (!event) return NextResponse.json({ ok: true, ignored: "malformed" });
  if (event.livemode !== cfg.livemode) return NextResponse.json({ ok: true, ignored: "mode" });

  try {
    const r = await handlePaymongoEvent(event, { cfg });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    // PayMongo briefly unreachable while re-reading: fail so the delivery is retried later
    console.error("[billing] PayMongo webhook failed", event.type, event.id, e);
    return NextResponse.json({ error: "Try again" }, { status: 503 });
  }
}
