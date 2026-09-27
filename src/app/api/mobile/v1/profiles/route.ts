import { NextResponse } from "next/server";
import { z } from "zod";
import { authed, query } from "@/lib/mobile-api";
import { PROFILES, recommendedProfile } from "@/lib/profiles";

const Query = z.object({ age: z.coerce.number().int().min(0).max(18).optional() });

/** Choose a protection profile. With `?age=` the recommended one is flagged. */
export const GET = authed(async ({ req }) => {
  const { age } = query(req, Query);
  const rec = age != null ? recommendedProfile(age) : null;
  return NextResponse.json({ profiles: PROFILES.map((p) => ({ ...p, recommended: p.id === rec })) });
});
