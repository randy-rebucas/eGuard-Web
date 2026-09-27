import { NextResponse } from "next/server";
import { unreadCount } from "@/lib/queries";
import { authed } from "@/lib/mobile-api";

/** Badge count: unresolved, unread alerts above INFO severity. */
export const GET = authed(async ({ user }) => NextResponse.json({ unread: await unreadCount(user.familyId, user.id) }));
