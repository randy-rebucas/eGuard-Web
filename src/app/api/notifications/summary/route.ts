import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";

export async function GET() {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ unread: await unreadCount(u.familyId, u.id) });
}
