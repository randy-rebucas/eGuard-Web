import "server-only";
import type { Alert } from "@prisma/client";
import { db } from "./db";
import { accessToken, type ServiceAccount } from "./google-play";

/**
 * Push notifications to the parent app, through Firebase Cloud Messaging (HTTP v1). One sender for Android and
 * iOS: the apps register FCM registration tokens (on iOS, from the Firebase Messaging SDK, which wraps APNs).
 *
 * Config:
 *   FCM_SERVICE_ACCOUNT   the Firebase project's service account JSON key (role "Firebase Cloud Messaging API Admin").
 *                         Its project_id is the project messages are sent from. Unset: nothing is pushed.
 */

type Fetch = typeof fetch;
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export function pushConfig(env: Record<string, string | undefined> = process.env) {
  const raw = env.FCM_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const account = JSON.parse(raw) as ServiceAccount & { project_id?: string };
    if (!account.client_email || !account.private_key || !account.project_id) return null;
    return { projectId: account.project_id, account };
  } catch {
    return null;
  }
}

export const pushAvailable = () => pushConfig() !== null;

export type PushMessage = { title: string; body: string; data?: Record<string, string> };

/** "sent", "gone" (the app was uninstalled or the token replaced: forget it) or "failed" (try another time). */
export type PushOutcome = "sent" | "gone" | "failed";

export async function sendPush(cfg: NonNullable<ReturnType<typeof pushConfig>>, token: string, m: PushMessage, f: Fetch = fetch): Promise<PushOutcome> {
  const auth = await accessToken(cfg.account, f, Date.now(), SCOPE);
  const res = await f(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: m.title, body: m.body },
        data: m.data ?? {},
        android: { priority: "HIGH", notification: { channel_id: "alerts" } },
        apns: { payload: { aps: { sound: "default" } } },
      },
    }),
  });
  if (res.ok) return "sent";
  // FCM says a token is dead with 404 UNREGISTERED, or 400 INVALID_ARGUMENT naming the token
  const err = (await res.json().catch(() => null)) as { error?: { status?: string; message?: string; details?: { errorCode?: string }[] } } | null;
  const codes = [err?.error?.status, ...(err?.error?.details ?? []).map((d) => d.errorCode)];
  if (res.status === 404 || codes.includes("UNREGISTERED") || (res.status === 400 && /registration token/i.test(err?.error?.message ?? ""))) return "gone";
  return "failed";
}

/** The notification for an alert: the same words as the alert in the app, and where tapping should go. */
export function alertPush(a: Pick<Alert, "id" | "title" | "subject" | "body" | "childId" | "category">): PushMessage {
  const body = a.body.length > 180 ? `${a.body.slice(0, 177)}…` : a.body;
  return {
    title: `${a.title} · ${a.subject}`,
    body,
    data: { type: "alert", alertId: a.id, category: a.category, ...(a.childId ? { childId: a.childId } : {}) },
  };
}

/** Sends to every phone of these parents; forgets tokens FCM reports as gone. Returns how many were delivered. */
export async function pushToUsers(userIds: string[], m: PushMessage, f: Fetch = fetch) {
  const cfg = pushConfig();
  if (!cfg || !userIds.length) return 0;
  const tokens = await db.pushToken.findMany({ where: { userId: { in: userIds } } });
  let sent = 0;
  for (const t of tokens) {
    try {
      const r = await sendPush(cfg, t.token, m, f);
      if (r === "sent") sent++;
      else if (r === "gone") await db.pushToken.deleteMany({ where: { id: t.id } });
    } catch (e) {
      console.error("[push] send failed", e);
    }
  }
  return sent;
}
