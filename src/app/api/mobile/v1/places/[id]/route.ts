import { NextResponse } from "next/server";
import { authed, body } from "@/lib/mobile-api";
import { PlaceUpdate, deletePlace, updatePlace } from "@/lib/places";

/** Renames a saved place or changes its radius; what's labelled with it is relabelled. */
export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const b = await body(req, PlaceUpdate);
  return NextResponse.json(await updatePlace(user, params.id, b));
});

/** Removes a saved place. Visits there lose its name (another saved place covering them names them instead). */
export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await deletePlace(user, params.id);
  return NextResponse.json({ ok: true });
});
