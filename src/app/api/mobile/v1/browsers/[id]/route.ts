import { NextResponse } from "next/server";
import { z } from "zod";
import { removeBrowser } from "@/lib/browser-service";
import { authed, body } from "@/lib/mobile-api";

/** Removes a browser: its tokens stop working and the extension forgets the connection. Needs the parent's password. */
export const DELETE = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, z.object({ password: z.string().optional() }));
  await removeBrowser(user, params.id, b.password ?? "");
  return NextResponse.json({ ok: true });
});