import { PrismaClient } from "@prisma/client";

export const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
export const API = `${BASE}/api/mobile/v1`;
export const db = new PrismaClient();

/** Every email the tests register, for cleanup. */
export const RUN = `t${Date.now().toString(36)}`;
export const email = (who: string) => `${who}.${RUN}@mobile-test.example`;
export const PASSWORD = "CorrectHorse123!";

type Opts = { token?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> };

export async function call(method: string, path: string, o: Opts = {}) {
  const headers: Record<string, string> = { "x-eguard-client": "ios", ...o.headers };
  if (o.token) headers.authorization = `Bearer ${o.token}`;
  if (o.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    method, headers, body: o.raw ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
  });
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data, headers: res.headers };
}

/** The child's device, talking to /api/device/v1 like the Android/iOS child app does. */
export function childDevice(token: string) {
  return (path: string, body: unknown = {}) => call("POST", `${BASE}/api/device/v1${path}`, { token, body });
}

export async function pairDevice(parentToken: string, childId: string, platform: "ANDROID" | "IOS", name: string) {
  const code = await call("POST", `/children/${childId}/pairing-code`, { token: parentToken });
  const pair = await call("POST", `${BASE}/api/device/v1/pair`, {
    body: { code: code.data.code, platform, name, model: "Test", kind: "PHONE", osVersion: platform === "IOS" ? "iOS 18" : "Android 15", appVersion: "1.0.0" },
  });
  if (pair.status !== 201) throw new Error(`pair failed: ${JSON.stringify(pair.data)}`);
  return { deviceId: pair.data.deviceId as string, send: childDevice(pair.data.token) };
}

const stripKey = (c: Record<string, unknown>) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== "key"));

/** Sync, then report back exactly what was requested (plus the full policy if a check was asked for). */
export async function applyAndReport(send: ReturnType<typeof childDevice>) {
  const sync = await send("/sync");
  const applied = new Map<string, Record<string, unknown>>();
  if (sync.data.fullReportRequested) for (const p of sync.data.policy) applied.set(p.key, stripKey(p.config));
  for (const r of sync.data.requests) applied.set(r.key, stripKey(r.config));
  const protections = [...applied].map(([key, config]) => ({ key, config }));
  if (protections.length) await send("/report", { protections, full: sync.data.fullReportRequested });
  return sync.data;
}

export async function cleanup() {
  await db.family.deleteMany({ where: { users: { some: { email: { endsWith: `.${RUN}@mobile-test.example` } } } } });
  await db.$disconnect();
}
