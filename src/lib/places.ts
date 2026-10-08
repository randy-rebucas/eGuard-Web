import "server-only";
import { z } from "zod";
import { db } from "./db";
import { audit } from "./audit";
import { invalid, notFound } from "./errors";
import { requireLocationSharing } from "./plan-access";
import type { Actor } from "./config-service";
import { placeFor } from "./location";
import { DEFAULT_RADIUS_M, MAX_PLACES, PLACE_RADII } from "./place-radii";

/**
 * Saved places: spots the parents name (Home, School). Devices don't name places, so without these every visit
 * is "Unnamed place". A fix inside one is labelled with its name (recordLocation); visits and current locations
 * point at the place, so renaming, resizing or removing it relabels what's already kept. Any parent can manage
 * them; they need a plan with location sharing. `notifyArrive` / `notifyLeave`: alert the parents when a child
 * arrives there / leaves (location.placeNotices).
 */

export const PlaceName = z.string({ error: "Name the place." }).trim().min(1, "Name the place.").max(40, "Keep the name under 40 characters.");
const radiusMessage = `Choose a radius of ${PLACE_RADII.join(", ")} m.`;
const Radius = z.number({ error: radiusMessage }).refine((r) => (PLACE_RADII as readonly number[]).includes(r), radiusMessage);
export const PlaceInput = z.object({
  name: PlaceName,
  lat: z.number({ error: "Choose where the place is." }).min(-90).max(90),
  lng: z.number({ error: "Choose where the place is." }).min(-180).max(180),
  radiusM: Radius.default(DEFAULT_RADIUS_M),
  notifyArrive: z.boolean().default(false),
  notifyLeave: z.boolean().default(false),
});
export const PlaceUpdate = z.object({ name: PlaceName.optional(), radiusM: Radius.optional(), notifyArrive: z.boolean().optional(), notifyLeave: z.boolean().optional() })
  .refine((x) => Object.values(x).some((v) => v !== undefined), "Send a name, a radius or a notice setting.");

const select = { id: true, name: true, lat: true, lng: true, radiusM: true, notifyArrive: true, notifyLeave: true } as const;
export type SavedPlace = { id: string; name: string; lat: number; lng: number; radiusM: number; notifyArrive: boolean; notifyLeave: boolean };

/** "arrive and leave", "arrive", "leave" or "off", for the audit log */
const notices = (p: { notifyArrive: boolean; notifyLeave: boolean }) =>
  p.notifyArrive && p.notifyLeave ? "arrive and leave" : p.notifyArrive ? "arrive" : p.notifyLeave ? "leave" : "off";

export const listPlaces = (familyId: string): Promise<SavedPlace[]> =>
  db.place.findMany({ where: { familyId }, orderBy: { name: "asc" }, select });

/**
 * Labels the family's unlabelled visits and current locations near `at` with the saved place they fall inside.
 * `radiusM` bounds the search (the largest radius involved in the change).
 */
async function relabelAround(familyId: string, at: { lat: number; lng: number }, radiusM: number) {
  const places = await listPlaces(familyId);
  if (!places.length) return;
  const dLat = radiusM / 111_320, dLng = radiusM / (111_320 * Math.max(0.01, Math.cos((at.lat * Math.PI) / 180)));
  const lat = { gte: at.lat - dLat, lte: at.lat + dLat }, lng = { gte: at.lng - dLng, lte: at.lng + dLng };
  const [visits, locations] = await Promise.all([
    db.locationVisit.findMany({ where: { child: { familyId }, placeId: null, lat, lng }, select: { id: true, lat: true, lng: true } }),
    db.deviceLocation.findMany({ where: { device: { familyId }, placeId: null, lat, lng }, select: { deviceId: true, lat: true, lng: true } }),
  ]);
  const byPlace = new Map<string, { visits: string[]; devices: string[] }>();
  const add = (p: SavedPlace | null, k: "visits" | "devices", id: string) => {
    if (!p) return;
    const g = byPlace.get(p.id) ?? { visits: [], devices: [] };
    g[k].push(id);
    byPlace.set(p.id, g);
  };
  for (const v of visits) add(placeFor(places, v), "visits", v.id);
  for (const l of locations) add(placeFor(places, { lat: l.lat!, lng: l.lng! }), "devices", l.deviceId);
  for (const [placeId, g] of byPlace) {
    const name = places.find((p) => p.id === placeId)!.name;
    await db.locationVisit.updateMany({ where: { id: { in: g.visits } }, data: { placeId, placeLabel: name } });
    await db.deviceLocation.updateMany({ where: { deviceId: { in: g.devices } }, data: { placeId, placeLabel: name } });
  }
}

/** Takes the place's name off everything labelled with it, so relabelAround can label it again (or not). */
async function unlink(placeId: string) {
  await db.locationVisit.updateMany({ where: { placeId }, data: { placeId: null, placeLabel: null } });
  await db.deviceLocation.updateMany({ where: { placeId }, data: { placeId: null, placeLabel: null } });
}

async function owned(actor: Actor, id: string) {
  const p = await db.place.findFirst({ where: { id, familyId: actor.familyId }, select });
  if (!p) throw notFound("Place");
  return p;
}

export async function createPlace(actor: Actor, input: z.input<typeof PlaceInput>) {
  await requireLocationSharing(actor.familyId);
  const b = PlaceInput.parse(input);
  // Locked per family: two parents (or web and app) adding at once could both pass the count
  const p = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`place.create:${actor.familyId}`}))`;
    if ((await tx.place.count({ where: { familyId: actor.familyId } })) >= MAX_PLACES) throw invalid(`You can save up to ${MAX_PLACES} places. Remove one first.`);
    return tx.place.create({ data: { familyId: actor.familyId, ...b }, select });
  });
  await relabelAround(actor.familyId, p, p.radiusM);
  await audit(actor.familyId, actor.name, "place.created", `${p.name} (${p.radiusM} m, notices ${notices(p)})`);
  return p;
}

export async function updatePlace(actor: Actor, id: string, input: z.input<typeof PlaceUpdate>) {
  // Another family's place is a 404 whatever their plan, as everywhere else
  const before = await owned(actor, id);
  await requireLocationSharing(actor.familyId);
  const b = PlaceUpdate.parse(input);
  const p = await db.place.update({ where: { id }, data: b, select });
  if (p.radiusM !== before.radiusM) {
    await unlink(id);
    await relabelAround(actor.familyId, p, Math.max(p.radiusM, before.radiusM));
  } else if (p.name !== before.name) {
    await db.locationVisit.updateMany({ where: { placeId: id }, data: { placeLabel: p.name } });
    await db.deviceLocation.updateMany({ where: { placeId: id }, data: { placeLabel: p.name } });
  }
  await audit(actor.familyId, actor.name, "place.updated", before.name === p.name ? `${p.name} (${p.radiusM} m, notices ${notices(p)})` : `${before.name} → ${p.name}`);
  return p;
}

/**
 * Removing a place takes its name off visits there; another saved place that covers them labels them instead.
 * Allowed on any plan, so a family that lost location sharing can still clear what they saved.
 */
export async function deletePlace(actor: Actor, id: string) {
  const p = await owned(actor, id);
  await unlink(id);
  await db.place.delete({ where: { id } });
  await relabelAround(actor.familyId, p, p.radiusM);
  await audit(actor.familyId, actor.name, "place.deleted", p.name);
}
