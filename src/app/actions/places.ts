"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { toResult, type Result } from "@/lib/errors";
import * as places from "@/lib/places";

const Id = z.string().min(1, "Place not found.").max(64, "Place not found.");

/** Location pages and the child's Location tab show place names */
const refresh = () => revalidatePath("/", "layout");

export async function createPlace(input: { name: string; lat: number; lng: number; radiusM: number }): Promise<Result<{ name: string }>> {
  const u = await requireUser();
  return toResult(async () => {
    const p = await places.createPlace(u, input);
    refresh();
    return { name: p.name };
  });
}

export async function updatePlace(placeId: string, input: { name?: string; radiusM?: number; notifyArrive?: boolean; notifyLeave?: boolean }): Promise<Result<{ name: string }>> {
  const u = await requireUser();
  return toResult(async () => {
    const p = await places.updatePlace(u, Id.parse(placeId), input);
    refresh();
    return { name: p.name };
  });
}

export async function deletePlace(placeId: string): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => {
    await places.deletePlace(u, Id.parse(placeId));
    refresh();
    return {};
  });
}
