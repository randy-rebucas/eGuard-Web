import { NextResponse } from "next/server";
import { authed, body } from "@/lib/mobile-api";
import { TicketSchema, createTicket, listTickets } from "@/lib/support";

/** Contact Support: this parent's requests, newest first. */
export const GET = authed(async ({ user }) => NextResponse.json({ tickets: await listTickets(user) }));

export const POST = authed(async ({ req, user }) => {
  const t = await createTicket(user, await body(req, TicketSchema));
  return NextResponse.json({ id: t.id, status: t.status, createdAt: t.createdAt, message: "Thanks. We'll reply by email within one business day." }, { status: 201 });
});
