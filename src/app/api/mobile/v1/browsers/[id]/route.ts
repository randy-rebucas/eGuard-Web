import { NextResponse } from "next/server";
import { removeBrowser } from "@/lib/browser-service";
import { ConfirmBody, authed, body } from "@/lib/mobile-api";

/** Removes a browser: its tokens stop working and the extension forgets the connection. Needs the password, or `confirm: "DELETE"` without one. */
export const DELETE = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, ConfirmBody);
  await removeBrowser(user, params.id, { password: b.password, phrase: b.confirm });
  return NextResponse.json({ ok: true });
});