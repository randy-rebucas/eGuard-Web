import { NextResponse } from "next/server";
import { z } from "zod";
import { PairingOptions, createPairingCode } from "@/lib/family-service";
import { authed, body } from "@/lib/mobile-api";

/** No body (or no kind) means a code for the phone app, as before. */
const Options = z.preprocess((v) => (v && typeof v === "object" && "kind" in v ? v : { kind: "DEVICE" }), PairingOptions);

/**
 * Add a device: a one-time code (15 minutes). DEVICE codes go to /api/device/v1/pair (the child's phone app);
 * `{ "kind": "BROWSER", "deviceLabel": "Mia's MacBook" }` makes a code for the browser extension (/api/browser/v1/pair).
 */
export const POST = authed<{ id: string }>(async ({ req, user, params }) =>
  NextResponse.json(await createPairingCode(user, params.id, await body(req, Options)), { status: 201 }));