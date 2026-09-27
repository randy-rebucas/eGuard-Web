import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authed, body } from "@/lib/mobile-api";
import { LIMITS, enforce } from "@/lib/rate-limit";
import { forwardTicket } from "@/lib/support";

/** Contact Support: this parent's requests, newest first. */
export const GET = authed(async ({ user }) => {
  const tickets = await db.supportTicket.findMany({
    where: { familyId: user.familyId, userId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, category: true, subject: true, message: true, status: true, createdAt: true },
  });
  return NextResponse.json({ tickets });
});

const Body = z.object({
  category: z.enum(["SETUP", "DEVICE", "BILLING", "ACCOUNT", "OTHER"]).default("OTHER"),
  subject: z.string().trim().min(3, "Add a short subject.").max(120),
  message: z.string().trim().min(10, "Tell us a little more so we can help.").max(5000),
});

export const POST = authed(async ({ req, user }) => {
  const b = await body(req, Body);
  await enforce(`support:${user.id}`, LIMITS.supportUser, "You've sent several requests. We'll reply to those first.");
  const t = await db.supportTicket.create({ data: { ...b, familyId: user.familyId, userId: user.id } });
  // Deliver it to the support inbox; the ticket is saved either way, so a mail hiccup isn't the parent's problem
  after(() => forwardTicket(t, user).catch((e) => console.error("[support] forwarding ticket failed", t.id, e)));
  return NextResponse.json({ id: t.id, status: t.status, createdAt: t.createdAt, message: "Thanks. We'll reply by email within one business day." }, { status: 201 });
});
