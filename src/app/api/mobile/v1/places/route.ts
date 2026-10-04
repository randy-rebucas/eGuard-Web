import { NextResponse } from "next/server";
import { authed, body } from "@/lib/mobile-api";
import { PlaceInput, createPlace, listPlaces } from "@/lib/places";
import { requireLocationSharing } from "@/lib/plan-access";

/** Location › Saved places: the places the parents named (Home, School). 403 `plan_required` on Free. */
export const GET = authed(async ({ user }) => {
  await requireLocationSharing(user.familyId);
  return NextResponse.json({ places: await listPlaces(user.familyId) });
});

/**
 * Names a place, e.g. from the child's current location or a visit. Visits and current locations inside it are
 * relabelled with its name straight away. Any parent; up to 30 places per family.
 */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, PlaceInput);
  return NextResponse.json(await createPlace(user, b), { status: 201 });
});
