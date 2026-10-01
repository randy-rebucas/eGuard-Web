import "server-only";
import type { Organization, VoucherBatch } from "@prisma/client";
import { db } from "./db";
import { appUrl } from "./email-verification";
import { escapeHtml, sendMail } from "./mail";
import { peso, shortDate } from "./format";
import { type PaidPlanId, planById } from "./plans";

/**
 * Who hears about what in organizations (docs/organizations.md › Notifications).
 *
 * Organization admins get email: changes to who manages the organization, its join code and API keys, payments and
 * refunds, codes about to pass their redeem-by date, and one email a day with activity **counts** (families
 * joined and left, codes redeemed and cancelled). Nothing sent to an organization names a family.
 *
 * Families get an alert in eGuard when they join or leave an organization or redeem a code, and the
 * family's other parents are emailed, since it changes who the family is connected to.
 *
 * Sending never fails the action that caused it: failures are logged.
 */

type Person = { id: string; email: string; name: string; tz: string };
type Message = { subject: string; paragraphs: string[]; link: string; cta: string; footer?: string };

const first = (name: string) => name.split(/\s+/)[0];
const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;
const codes = (n: number) => `${n} code${n === 1 ? "" : "s"}`;
const planName = (plan: string) => planById(plan as PaidPlanId).name;
const orgLink = (orgId: string) => `${appUrl()}/organizations/${orgId}`;
const ACTIVITY_FOOTER = `You get these emails because "Email alerts" is on in Settings › Notifications.`;

function render(p: Person, m: Message) {
  const footer = m.footer ? `\n\n${m.footer}` : "";
  return {
    to: p.email,
    subject: m.subject,
    text: `Hi ${first(p.name)},\n\n${m.paragraphs.join("\n\n")}\n\n${m.cta}: ${m.link}${footer}\n\n— eGuard`,
    html: `<p>Hi ${escapeHtml(first(p.name))},</p>${m.paragraphs.map((x) => `<p>${escapeHtml(x)}</p>`).join("")}`
      + `<p><a href="${m.link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600">${escapeHtml(m.cta)}</a></p>`
      + (m.footer ? `<p style="color:#555;font-size:13px">${escapeHtml(m.footer)}</p>` : ""),
  };
}

async function deliver(people: Person[], build: (p: Person) => Message) {
  const results = await Promise.allSettled(people.map((p) => sendMail(render(p, build(p)))));
  for (const r of results) if (r.status === "rejected") console.error("[org-notifications] email failed", r.reason);
  return results.filter((r) => r.status === "fulfilled").length;
}

const toPerson = (u: { id: string; email: string; name: string; family: { timezone: string } }): Person =>
  ({ id: u.id, email: u.email, name: u.name, tz: u.family.timezone });

/**
 * The organization's admins with a verified email. `activity` (the daily email, joins and leaves) also
 * respects their "Email alerts" setting; changes to who manages it and to money are always sent.
 */
async function orgAdmins(orgId: string, { except = [], activity = false }: { except?: string[]; activity?: boolean } = {}) {
  const users = await db.user.findMany({
    where: { orgRoles: { some: { orgId } }, id: { notIn: except }, emailVerifiedAt: { not: null }, ...(activity ? { notifyEmail: true } : {}) },
    include: { family: { select: { timezone: true } } },
  });
  return users.map(toPerson);
}

async function person(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, include: { family: { select: { timezone: true } } } });
  return u?.emailVerifiedAt ? toPerson(u) : null;
}

/** Runs a notification without letting it fail the caller. */
async function safely(what: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[org-notifications] ${what} failed`, e);
  }
}

/* ---------- Who manages the organization ---------- */

export const notifyAdminAdded = (org: Organization, addedId: string, by: { id: string; name: string }) => safely("admin added", async () => {
  const added = await db.user.findUniqueOrThrow({ where: { id: addedId } });
  const you = await person(addedId);
  if (you) {
    await deliver([you], () => ({
      subject: `You're now an admin of ${org.name} on eGuard`,
      paragraphs: [
        `${by.name} added you as an admin of ${org.name}. You can share its join code, buy sponsor codes that pay for families' plans, and see how many families joined. You never see which families joined or used a code.`,
        `If you don't know this organization, open it and choose "Stop managing".`,
      ],
      link: orgLink(org.id), cta: `Open ${org.name}`,
    }));
  }
  const others = await orgAdmins(org.id, { except: [by.id, addedId] });
  await deliver(others, () => ({
    subject: `${added.name} was added as an admin of ${org.name}`,
    paragraphs: [`${by.name} added ${added.name} (${added.email}) as an admin of ${org.name}. Admins can see and hand out its sponsor codes and buy more.`],
    link: orgLink(org.id), cta: "See admins",
  }));
});

export const notifyAdminRemoved = (org: Organization, removed: { id: string; name: string; email: string }, by: { id: string; name: string }) => safely("admin removed", async () => {
  const self = removed.id === by.id;
  if (!self) {
    const you = await person(removed.id);
    if (you) {
      await deliver([you], () => ({
        subject: `You no longer manage ${org.name} on eGuard`,
        paragraphs: [`${by.name} removed you as an admin of ${org.name}. You can no longer see its codes or buy more. Your own family's account isn't affected.`],
        link: `${appUrl()}/settings/organizations`, cta: "Open Settings",
      }));
    }
  }
  const others = await orgAdmins(org.id, { except: [by.id, removed.id] });
  await deliver(others, () => ({
    subject: self ? `${removed.name} stopped managing ${org.name}` : `${removed.name} was removed as an admin of ${org.name}`,
    paragraphs: [self
      ? `${removed.name} (${removed.email}) stopped managing ${org.name}.`
      : `${by.name} removed ${removed.name} (${removed.email}) as an admin of ${org.name}.`],
    link: orgLink(org.id), cta: "See admins",
  }));
});

/** `by` is null when ownership passed automatically because the owner is deleting their account (`except`). */
export const notifyOwnerMade = (org: Organization, ownerId: string, by: { id: string; name: string } | null, except: string[] = []) => safely("owner made", async () => {
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId } });
  const you = await person(ownerId);
  if (you) {
    await deliver([you], () => ({
      subject: `You're now an owner of ${org.name} on eGuard`,
      paragraphs: [by
        ? `${by.name} made you an owner of ${org.name}. Owners can also add and remove admins and make other admins owners.`
        : `The owner of ${org.name} deleted their eGuard account, so you're its owner now, as its longest-serving admin. Owners can add and remove admins and make other admins owners.`],
      link: orgLink(org.id), cta: `Open ${org.name}`,
    }));
  }
  const others = await orgAdmins(org.id, { except: [ownerId, ...except, ...(by ? [by.id] : [])] });
  await deliver(others, () => ({
    subject: `${owner.name} is now an owner of ${org.name}`,
    paragraphs: [by ? `${by.name} made ${owner.name} an owner of ${org.name}.` : `${owner.name} is now the owner of ${org.name}, because its previous owner deleted their eGuard account.`],
    link: orgLink(org.id), cta: "See admins",
  }));
});

export const notifyJoinCodeReplaced = (org: Organization, joinCode: string, by: { id: string; name: string }) => safely("join code replaced", async () => {
  const others = await orgAdmins(org.id, { except: [by.id] });
  await deliver(others, () => ({
    subject: `${org.name} has a new join code`,
    paragraphs: [
      `${by.name} replaced the join code of ${org.name}. The new code is ${joinCode}. The old code no longer works, so update anything you shared it in.`,
      "Families who already joined stay joined.",
    ],
    link: orgLink(org.id), cta: `Open ${org.name}`,
  }));
});

/* ---------- API keys ---------- */

const ACCESS_TEXT: Record<string, string> = { READ: "read-only", WRITE: "read and cancel codes" };

export const notifyApiKeyCreated = (org: Organization, key: { name: string; prefix: string; access: string }, by: { id: string; name: string }) => safely("api key created", async () => {
  await deliver(await orgAdmins(org.id, { except: [by.id] }), () => ({
    subject: `New API key for ${org.name}`,
    paragraphs: [
      `${by.name} created an API key for ${org.name}: "${key.name}" (${key.prefix}…, ${ACCESS_TEXT[key.access] ?? key.access}).`,
      "API keys let other systems read the organization's codes and counts. If you don't recognize this key, revoke it on the organization's page.",
    ],
    link: orgLink(org.id), cta: "See API keys",
  }));
});

export const notifyApiKeyRevoked = (org: Organization, key: { name: string; prefix: string }, by: { id: string; name: string }) => safely("api key revoked", async () => {
  await deliver(await orgAdmins(org.id, { except: [by.id] }), () => ({
    subject: `API key revoked for ${org.name}`,
    paragraphs: [`${by.name} revoked the API key "${key.name}" (${key.prefix}…) for ${org.name}. Anything still using it gets an error now.`],
    link: orgLink(org.id), cta: "See API keys",
  }));
});

/* ---------- Payments ---------- */

export const notifyBatchPaid = (batchId: string) => safely("batch paid", async () => {
  const b = await db.voucherBatch.findUniqueOrThrow({ where: { id: batchId }, include: { org: true, vouchers: { take: 1 } } });
  const admins = await orgAdmins(b.orgId);
  await deliver(admins, (p) => ({
    subject: `Your ${codes(b.quantity)} for ${b.org.name} are ready`,
    paragraphs: [
      `We received ${peso(b.amount)} for ${codes(b.quantity)} of ${planName(b.plan)} for ${months(b.months)} each.`,
      `Each code gives one family ${planName(b.plan)} for ${months(b.months)}. Families redeem them in Settings › Subscription. Codes can be redeemed until ${b.vouchers[0] ? shortDate(b.vouchers[0].expiresAt, p.tz) : "12 months from today"}.`,
      "Codes work like gift cards: anyone with a code can use it, so share each one with one family only.",
    ],
    link: orgLink(b.orgId), cta: "See your codes",
  }));
});

/** A checkout nobody paid. Only the admin who started it is told. */
export const notifyBatchExpired = (b: VoucherBatch & { org: Organization }) => safely("batch expired", async () => {
  const buyer = await person(b.createdBy);
  if (!buyer || !(await db.orgMember.findUnique({ where: { orgId_userId: { orgId: b.orgId, userId: buyer.id } } }))) return;
  await deliver([buyer], () => ({
    subject: `Your order of sponsor codes for ${b.org.name} wasn't completed`,
    paragraphs: [`The payment for ${codes(b.quantity)} of ${planName(b.plan)} (${peso(b.amount)}) wasn't completed, so no codes were created and you weren't charged. You can order them again at any time.`],
    link: orgLink(b.orgId), cta: "Buy codes",
  }));
});

export const notifyBatchRefunded = (b: VoucherBatch & { org: Organization }, cancelled: number) => safely("batch refunded", async () => {
  const admins = await orgAdmins(b.orgId);
  await deliver(admins, () => ({
    subject: `Refund for ${b.org.name}'s sponsor codes`,
    paragraphs: [
      `The payment of ${peso(b.amount)} for ${codes(b.quantity)} of ${planName(b.plan)} was refunded.`,
      cancelled
        ? `${codes(cancelled)} that hadn't been used ${cancelled === 1 ? "was" : "were"} cancelled and no longer work. Families who already redeemed a code keep their plan until it ends.`
        : "All of its codes had already been redeemed. Those families keep their plan until it ends.",
    ],
    link: orgLink(b.orgId), cta: "See your codes",
  }));
});

/* ---------- Scheduled (maintenance job) ---------- */

/** Codes still unused this close to their redeem-by date get one reminder per batch. */
const EXPIRY_WARN_MS = 30 * 864e5;
/** The activity email goes out at most once a day. */
const DIGEST_EVERY_MS = 24 * 3600_000;
/** Activity kept for the daily email. */
export const ORG_EVENT_RETENTION_DAYS = 30;

export async function sendCodeExpiryReminders(now = new Date()) {
  const due = await db.voucherBatch.findMany({
    where: {
      state: "PAID", expiryRemindedAt: null,
      vouchers: { some: { redeemedAt: null, revokedAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + EXPIRY_WARN_MS) } } },
    },
    include: { org: true },
  });
  let sent = 0;
  for (const b of due) {
    const claimed = await db.voucherBatch.updateMany({ where: { id: b.id, expiryRemindedAt: null }, data: { expiryRemindedAt: now } });
    if (!claimed.count) continue;
    const unused = await db.voucher.findMany({ where: { batchId: b.id, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } }, orderBy: { expiresAt: "asc" } });
    if (!unused.length) continue;
    await safely("expiry reminder", async () => {
      sent += await deliver(await orgAdmins(b.orgId), (p) => ({
        subject: `${codes(unused.length)} for ${b.org.name} must be redeemed by ${shortDate(unused[0].expiresAt, p.tz)}`,
        paragraphs: [
          `${codes(unused.length)} of ${planName(b.plan)} for ${months(b.months)} ${unused.length === 1 ? "hasn't" : "haven't"} been redeemed yet. After ${shortDate(unused[0].expiresAt, p.tz)} ${unused.length === 1 ? "it stops" : "they stop"} working, and unused codes aren't refunded.`,
          "Hand them out to families soon so none go to waste.",
        ],
        link: orgLink(b.orgId), cta: "See your codes",
      }));
    });
  }
  return { due: due.length, sent };
}

type Counts = { JOINED: number; LEFT: number; REDEEMED: number; CANCELLED: number };

function activityLines(c: Counts) {
  const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;
  return [
    c.JOINED ? `${n(c.JOINED, "family", "families")} joined` : null,
    c.LEFT ? `${n(c.LEFT, "family", "families")} left` : null,
    c.REDEEMED ? `${n(c.REDEEMED, "sponsor code was", "sponsor codes were")} redeemed` : null,
    c.CANCELLED ? `${n(c.CANCELLED, "sponsor code was", "sponsor codes were")} cancelled` : null,
  ].filter((x): x is string => !!x);
}

/**
 * Once a day, per organization with new activity: counts of families joining and leaving and codes redeemed
 * and cancelled since the last email, with current totals. Counts only, by design.
 */
export async function sendOrgDigests(now = new Date()) {
  const dueBefore = new Date(now.getTime() - DIGEST_EVERY_MS);
  const orgs = await db.organization.findMany({
    where: { OR: [{ digestSentAt: null }, { digestSentAt: { lte: dueBefore } }], events: { some: {} } },
  });
  let sent = 0;
  for (const org of orgs) {
    const since = org.digestSentAt ?? new Date(0);
    const events = await db.orgEvent.groupBy({ by: ["kind"], where: { orgId: org.id, createdAt: { gt: since, lte: now } }, _count: true });
    if (!events.length) continue;
    const claimed = await db.organization.updateMany({ where: { id: org.id, digestSentAt: org.digestSentAt }, data: { digestSentAt: now } });
    if (!claimed.count) continue;
    const c: Counts = { JOINED: 0, LEFT: 0, REDEEMED: 0, CANCELLED: 0 };
    for (const e of events) if (e.kind in c) c[e.kind as keyof Counts] = e._count;
    const lines = activityLines(c);
    if (!lines.length) continue;
    const [families, available] = await Promise.all([
      db.orgMembership.count({ where: { orgId: org.id } }),
      db.voucher.count({ where: { batch: { orgId: org.id, state: "PAID" }, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
    ]);
    await safely("digest", async () => {
      sent += await deliver(await orgAdmins(org.id, { activity: true }), () => ({
        subject: `${org.name}: ${lines.join(", ")}`,
        paragraphs: [
          `Since ${org.digestSentAt ? "our last update" : "you set it up"}: ${lines.join(", ")}.`,
          `${org.name} now has ${families} ${families === 1 ? "family" : "families"} and ${codes(available)} ready to hand out.`,
          "For families' privacy, eGuard never tells an organization which families joined or used its codes.",
        ],
        link: orgLink(org.id), cta: `Open ${org.name}`, footer: ACTIVITY_FOOTER,
      }));
    });
  }
  return { orgs: orgs.length, sent };
}

/* ---------- The family's side ---------- */

type FamilyNotice = { title: string; body: string; icon: string; subject: string; cta: string; link: string };

/** An alert for the family, and an email to its parents (the one who did it only when `alsoActor`). */
async function tellFamily(familyId: string, actorId: string, n: FamilyNotice, { alsoActor = false } = {}) {
  await db.alert.create({
    // Marked as notified: parents are emailed here, so the maintenance job shouldn't email it again
    data: { familyId, severity: "INFO", category: "SYSTEM", icon: n.icon, title: n.title, body: n.body, subject: n.subject, notifiedAt: new Date() },
  });
  const parents = await db.user.findMany({
    where: { familyId, emailVerifiedAt: { not: null }, notifyEmail: true, ...(alsoActor ? {} : { id: { not: actorId } }) },
    include: { family: { select: { timezone: true } } },
  });
  await deliver(parents.map(toPerson), () => ({
    subject: `eGuard: ${n.title}`, paragraphs: [n.body], link: n.link, cta: n.cta, footer: ACTIVITY_FOOTER,
  }));
}

const PRIVACY = "The organization only sees how many families joined, never your children, devices, settings or activity.";

export const notifyFamilyJoined = (org: Organization, actor: { id: string; name: string; familyId: string }) => safely("family joined", async () => {
  await db.orgEvent.create({ data: { orgId: org.id, kind: "JOINED" } });
  await tellFamily(actor.familyId, actor.id, {
    title: `Joined ${org.name}`, icon: "building", subject: "Organizations",
    body: `${actor.name} joined ${org.name} with its code. ${PRIVACY} The family admin can leave at any time in Settings › Organizations.`,
    link: `${appUrl()}/settings/organizations`, cta: "Open Organizations",
  });
});

export const notifyFamilyLeft = (org: Organization, actor: { id: string; name: string; familyId: string }) => safely("family left", async () => {
  await db.orgEvent.create({ data: { orgId: org.id, kind: "LEFT" } });
  await tellFamily(actor.familyId, actor.id, {
    title: `Left ${org.name}`, icon: "building", subject: "Organizations",
    body: `${actor.name} left ${org.name}. Your family no longer counts toward it. A plan it already sponsored keeps running until it ends.`,
    link: `${appUrl()}/settings/organizations`, cta: "Open Organizations",
  });
});

export const notifyCodeRedeemed = (
  org: Organization, actor: { id: string; name: string; familyId: string },
  r: { plan: string; months: number; expiresAt: Date },
) => safely("code redeemed", async () => {
  await db.orgEvent.create({ data: { orgId: org.id, kind: "REDEEMED" } });
  const tz = (await db.family.findUniqueOrThrow({ where: { id: actor.familyId } })).timezone;
  await tellFamily(actor.familyId, actor.id, {
    title: `${r.plan} sponsored by ${org.name}`, icon: "ticket", subject: "Subscription",
    body: `${actor.name} redeemed a sponsor code from ${org.name}: ${r.plan} for ${months(r.months)}, until ${shortDate(r.expiresAt, tz)}. We'll remind you a few days before it ends. ${org.name} sees that one of its codes was used, never which family used it.`,
    link: `${appUrl()}/settings/subscription`, cta: "See your plan",
  }, { alsoActor: true });
});

/** Admin-cancelled codes are counted in the daily email. */
export const recordCodeCancelled = (orgId: string) => safely("code cancelled", () => db.orgEvent.create({ data: { orgId, kind: "CANCELLED" } }));
