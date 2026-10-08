import { NextResponse } from "next/server";
import { authed, body } from "@/lib/mobile-api";
import { PlaceInput, createPlace, listPlaces } from "@/lib/places";

/**
 * Location › Saved places: the places the parents named (Home, School). Listed on every plan, so places saved before
 * a move to Free can still be removed (DELETE works on any plan); adding and changing them needs location sharing.
 */
export const GET = authed(async ({ user }) => {
  return NextResponse.json({ places: await listPlaces(user.familyId) });
});

/**
 * Names a place: from the child's current location or a visit, or anywhere on the map (School before the first day).
 * Visits and current locations inside it are relabelled with its name straight away. Any parent; up to 30 places per
 * family.
 */
export const POST = authed(async ({ req, user }) => {
  const b = await body(req, PlaceInput);
  return NextResponse.json(await createPlace(user, b), { status: 201 });
});
