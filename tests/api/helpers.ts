import { PrismaClient } from "@prisma/client";

export const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
export const API = `${BASE}/api/mobile/v1`;
export const db = new PrismaClient();

/** Every email the tests register, for cleanup. */
export const RUN = `t${Date.now().toString(36)}`;
export const email = (who: string) => `${who}.${RUN}@mobile-test.example`;
export const PASSWORD = "CorrectHorse123!";

/** Mailpit (docker compose `mail`), which the dev server's SMTP_URL points at. */
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

/** The token from the newest email sent to `to` whose link matches `path`. Waits for it, since it's sent after the response. */
async function mailToken(to: string, path: string, { after = 0 } = {}) {
  const pattern = new RegExp(`${path}\\?token=([\\w-]+)`);
  for (let i = 0; i < 50; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
    for (const msg of r.messages ?? []) {
      if (Date.parse(msg.Created) < after) continue;
      const full = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then((r) => r.json());
      const token = pattern.exec(full.Text)?.[1];
      if (token) return token;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No ${path} email reached ${to} (is Mailpit running? npm run db:up)`);
}

export const verificationToken = (to: string, o: { after?: number } = {}) => mailToken(to, "verify-email", o);
export const resetToken = (to: string, o: { after?: number } = {}) => mailToken(to, "reset-password", o);
export const inviteToken = (to: string, o: { after?: number } = {}) => mailToken(to, "accept-invite", o);

/** Family admin invites a parent, who accepts from the email with `password`. Returns the new parent's id and session token. */
export async function inviteAndAccept(adminToken: string, name: string, to: string, password: string) {
  const add = await call("POST", "/family/members", { token: adminToken, body: { name, email: to } });
  if (add.status !== 201) throw new Error(`invite failed: ${JSON.stringify(add.data)}`);
  const accepted = await call("POST", "/auth/accept-invite", { body: { token: await inviteToken(to), password } });
  if (accepted.status !== 200) throw new Error(`accept failed: ${JSON.stringify(accepted.data)}`);
  return { id: add.data.id as string, token: accepted.data.token as string };
}

/** Every email Mailpit holds for `to`, newest first (subject and text). */
export async function inbox(to: string) {
  const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) => r.json());
  return Promise.all((r.messages ?? []).map(async (m: { ID: string; Subject: string }) => {
    const full = await fetch(`${MAILPIT}/api/v1/message/${m.ID}`).then((r) => r.json());
    return { subject: m.Subject as string, text: full.Text as string };
  }));
}

/** Verifies a parent's email the way they would: from the link in their inbox. */
export async function verifyInbox(to: string) {
  const r = await call("POST", "/auth/verify-email", { body: { token: await verificationToken(to) } });
  if (r.status !== 200) throw new Error(`verify failed: ${JSON.stringify(r.data)}`);
}

type Opts ={ token?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> };

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
