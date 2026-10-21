import "server-only";
import { db } from "../db";
import { appUrl } from "../email-verification";
import { escapeHtml, sendMail } from "../mail";
import { pushConfig, sendPush } from "../push";
import { storeNeutral } from "../store-neutral";
import type { Channel } from "./definitions";
import { DeliveryError } from "./queue";
import type { Rendered } from "./templates";

/**
 * One interface over the three channels. Each adapter reuses what the app already has: lib/mail (Resend in
 * production, Mailpit elsewhere), lib/push (FCM and the parent's registered phones) and the app itself for in-app.
 * An adapter reports only what really happened: ACCEPTED means the provider took it (neither Resend nor FCM confirm
 * delivery to us), DELIVERED is only claimed for in-app, where the message is in the app once stored.
 */

export type Outbound = {
  messageId: string;
  /** The message's token: its tracked link and its email's opt-out link */
  token: string;
  user: { id: string; email: string; name: string };
  rendered: Rendered;
};

export type DeliveryResult = { status: "ACCEPTED" | "DELIVERED"; providerRef?: string | null };

export type ChannelAdapter = { channel: Channel; send: (o: Outbound) => Promise<DeliveryResult> };

/** The tracked link: records the click, then opens the app page (api/care/open/[token]) */
export const trackedLink = (token: string) => `${appUrl()}/api/care/open/${encodeURIComponent(token)}`;
const optOutPage = (token: string) => `${appUrl()}/unsubscribe?t=${encodeURIComponent(token)}`;
const optOutEndpoint = (token: string) => `${appUrl()}/api/email/unsubscribe?t=${encodeURIComponent(token)}`;

/** The email for one message. Pure apart from the app's URL, so it's tested without sending. */
export function careEmail(r: Rendered, firstName: string, token: string) {
  const link = trackedLink(token);
  const why = "You get these because you turned on email tips and reminders in Settings › Notifications.";
  return {
    subject: r.title,
    text: `Hi ${firstName},\n\n${r.body}\n\n${r.cta}: ${link}\n\n${why} Stop these emails: ${optOutPage(token)}\n\n— eGuard`,
    html: `<p>Hi ${escapeHtml(firstName)},</p><p>${escapeHtml(r.body)}</p>`
      + `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">${escapeHtml(r.cta)}</a></p>`
      + `<p style="color:#555;font-size:13px">${escapeHtml(why)} <a href="${escapeHtml(optOutPage(token))}" style="color:#555">Stop these emails</a></p>`,
    // RFC 8058 one-click: mail apps' own Unsubscribe button posts here (api/email/unsubscribe)
    headers: { "List-Unsubscribe": `<${optOutEndpoint(token)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export const emailAdapter: ChannelAdapter = {
  channel: "EMAIL",
  async send(o) {
    await sendMail({ to: o.user.email, ...careEmail(o.rendered, o.user.name.trim().split(/\s+/)[0] ?? "", o.token) });
    return { status: "ACCEPTED" };
  },
};

/**
 * To every phone the parent is signed in on. Accepted when FCM took it for at least one; tokens FCM reports gone are
 * forgotten, as for alerts. No phone left: a permanent failure (eligibility checks this first, so it's a race).
 */
export const pushAdapter: ChannelAdapter = {
  channel: "PUSH",
  async send(o) {
    const cfg = pushConfig();
    if (!cfg) throw new DeliveryError("push_not_configured", false);
    const tokens = await db.pushToken.findMany({ where: { userId: o.user.id } });
    if (!tokens.length) throw new DeliveryError("no_push_token", false);
    const data = { type: "care", messageId: o.messageId, link: o.rendered.link };
    let sent = 0, failed = 0;
    for (const t of tokens) {
      const body = t.platform === "IOS" ? storeNeutral(o.rendered.body) : o.rendered.body;
      const r = await sendPush(cfg, t.token, { title: o.rendered.title, body: body.length > 180 ? `${body.slice(0, 177)}…` : body, data }).catch(() => "failed" as const);
      if (r === "sent") sent++;
      else if (r === "gone") await db.pushToken.deleteMany({ where: { id: t.id } });
      else failed++;
    }
    if (sent) return { status: "ACCEPTED", providerRef: `fcm:${sent}` };
    throw new DeliveryError(failed ? "push_failed" : "no_push_token", failed > 0);
  },
};

/** Already stored by the runner: the Safety plan page and the app's list show it from there. */
export const inAppAdapter: ChannelAdapter = {
  channel: "IN_APP",
  send: async () => ({ status: "DELIVERED" }),
};

export const ADAPTERS: Record<Channel, ChannelAdapter> = { PUSH: pushAdapter, EMAIL: emailAdapter, IN_APP: inAppAdapter };

/**
 * Which channels can deliver to this parent at all, before their choices: push needs FCM configured, a registered
 * phone and their device-wide "Push notifications" switch on; email needs a verified address (and, in production,
 * a mail provider: sendMail fails loudly without one, and the job retries then gives up).
 */
export async function availableChannels(user: { id: string; notifyPush: boolean; emailVerifiedAt: Date | null }): Promise<Record<Channel, boolean>> {
  const push = !!pushConfig() && user.notifyPush && (await db.pushToken.count({ where: { userId: user.id } })) > 0;
  return { PUSH: push, EMAIL: !!user.emailVerifiedAt, IN_APP: true };
}
