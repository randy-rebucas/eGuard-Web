import "server-only";
import { NextResponse } from "next/server";
import { db } from "./db";
import { sha256 } from "./auth";

/** Resolves the device from `Authorization: Bearer <device token>`. */
export async function authDevice(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  return db.device.findUnique({ where: { tokenHash: sha256(token) }, include: { child: true } });
}

export const unauthorized = () => NextResponse.json({ error: "Invalid or missing device token" }, { status: 401 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { return null; }
}
