import "server-only";
import type { Alert } from "@prisma/client";
import { db } from "./db";
import { accessToken, type ServiceAccount } from "./google-play";
import { storeNeutral } from "./store-neutral";

/**
 * Push through Firebase Cloud Messaging (HTTP v1): alerts to the parent app, and silent wakes to child devices
 * ([wakeDevices]). One sender for Android and iOS: the apps register FCM registration tokens (on iOS, from the
 * Firebase Messaging SDK, which wraps APNs). Parents register theirs at /me/push-tokens; devices send theirs on /sync.
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
        android: { priority: "HIGH", notification: { channel_id: "parent_alerts" } }, // the Android app's alert channel
        apns: { payload: { aps: { sound: "default" } } },
      },
    }),
  });
  return outcome(res);
}

async function outcome(res: Response): Promise<PushOutcome> {
  if (res.ok) return "sent";
  // FCM says a token is dead with 404 UNREGISTERED, or 400 INVALID_ARGUMENT naming the token
  const err = (await res.json().catch(() => null)) as { error?: { status?: string; message?: string; details?: { errorCode?: string }[] } } | null;
  const codes = [err?.error?.status, ...(err?.error?.details ?? []).map((d) => d.errorCode)];
  if (res.status === 404 || codes.includes("UNREGISTERED") || (res.status === 400 && /registration token/i.test(err?.error?.message ?? ""))) return "gone";
  return "failed";
}

/**
 * A silent "sync now" to a child's device: data only, so nothing is shown, and the app runs a sync cycle.
 * Android gets it at high priority (delivered in Doze); iOS as a background push (content-available), which the
 * system may delay or batch, so a device's regular polling stays the guarantee.
 */
export async function sendWake(cfg: NonNullable<ReturnType<typeof pushConfig>>, token: string, reason: string, f: Fetch = fetch): Promise<PushOutcome> {
  const auth = await accessToken(cfg.account, f, Date.now(), SCOPE);
  const res = await f(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        data: { type: "sync", reason },
        // Collapsed: three quick changes need one sync, not three
        android: { priority: "HIGH", ttl: "600s", collapse_key: "sync" },
        apns: {
          headers: { "apns-push-type": "background", "apns-priority": "5", "apns-collapse-id": "sync" },
          payload: { aps: { "content-available": 1 } },
        },
      },
    }),
  });
  return outcome(res);
}

/**
 * Wakes these child devices so they sync now (a new change, a check, extra time). Best effort and never throws:
 * a device without a token, or with push unconfigured, still gets the change on its next poll. Forgets dead tokens.
 */
export async function wakeDevices(deviceIds: string[], reason: string, f: Fetch = fetch) {
  const cfg = pushConfig();
  if (!cfg || !deviceIds.length) return 0;
  let sent = 0;
  try {
    const devices = await db.device.findMany({ where: { id: { in: [...new Set(deviceIds)] }, pushToken: { not: null } }, select: { id: true, pushToken: true } });
    await Promise.all(devices.map(async (d) => {
      try {
        const r = await sendWake(cfg, d.pushToken!, reason, f);
        if (r === "sent") sent++;
        // Only if it's still this token: the device may have sent a new one meanwhile
        else if (r === "gone") await db.device.updateMany({ where: { id: d.id, pushToken: d.pushToken }, data: { pushToken: null } });
      } catch (e) {
        console.error("[push] wake failed", e);
      }
    }));
  } catch (e) {
    console.error("[push] wake failed", e);
  }
  return sent;
}

/** Wakes every device of these children (app rules, extra time: things every device of the child applies). */
export async function wakeChildDevices(childIds: string[], reason: string) {
  if (!pushConfig() || !childIds.length) return 0;
  try {
    const devices = await db.device.findMany({ where: { childId: { in: childIds }, pushToken: { not: null } }, select: { id: true } });
    return await wakeDevices(devices.map((d) => d.id), reason);
  } catch (e) {
    console.error("[push] wake failed", e);
    return 0;
  }
}

/**
 * The notification for an alert: the same words as the alert in the app, and where tapping should go. `action` is
 * the alert's `mobileAlertAction`, flattened into `actionType`, `deviceId`, `key` and `requestId` (FCM data values
 * are strings), so a tap opens the screen the alert's button opens.
 */
export function alertPush(
  a: Pick<Alert, "id" | "title" | "subject" | "body" | "childId" | "category">,
  action?: { type: string; childId?: string | null; deviceId?: string; key?: string; requestId?: string } | null,
): PushMessage {
  const body = a.body.length > 180 ? `${a.body.slice(0, 177)}…` : a.body;
  const childId = action?.childId ?? a.childId;
  return {
    title: `${a.title} · ${a.subject}`,
    body,
    data: {
      type: "alert", alertId: a.id, category: a.category,
      ...(childId ? { childId } : {}),
      ...(action ? { actionType: action.type } : {}),
      ...(action?.deviceId ? { deviceId: action.deviceId } : {}),
      ...(action?.key ? { key: action.key } : {}),
      ...(action?.requestId ? { requestId: action.requestId } : {}),
    },
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
      // iPhones get the alert without sentences about buying a plan, as in the app (storeNeutral)
      const r = await sendPush(cfg, t.token, t.platform === "IOS" ? { ...m, body: storeNeutral(m.body) } : m, f);
      if (r === "sent") sent++;
      else if (r === "gone") await db.pushToken.deleteMany({ where: { id: t.id } });
    } catch (e) {
      console.error("[push] send failed", e);
    }
  }
  return sent;
}
