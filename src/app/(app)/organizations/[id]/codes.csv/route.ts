import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import { codesCsv } from "@/lib/organizations";

/** An organization's sponsor codes as CSV, for its admins. Never includes who redeemed a code. */
export async function GET(_: Request, ctx: RouteContext<"/organizations/[id]/codes.csv">) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const { name, csv } = await codesCsv(u, id);
    const file = `${name.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "organization"}-codes.csv`;
    return new NextResponse(csv, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${file}"`, "cache-control": "no-store" },
    });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
