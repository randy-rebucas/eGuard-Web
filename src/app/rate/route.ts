import { NextResponse } from "next/server";
import { storeFor } from "@/lib/review-prompts";
import { STORE_LINKS } from "@/components/brand-marks";

/**
 * /rate: where a parent care review invitation links (lib/parent-care templates only link to eGuard paths). Sends a
 * phone to its store's eGuard page; anything else, or an iPhone while eGuard isn't on the App Store yet, to Google Play.
 * It asks nothing first: everyone gets the same link, whatever they think of eGuard.
 */
export function GET(req: Request) {
  return NextResponse.redirect(storeFor(req.headers.get("user-agent")) ?? STORE_LINKS.googlePlay, 302);
}
