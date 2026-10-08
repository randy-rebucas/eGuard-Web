/**
 * QA helpers for the dev database (never production). Run from the repo root:
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts session <email>
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts fixture [plan] [childName]
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts parent <fixtureFamilyId>   (a non-admin parent, for 403 checks)
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts alert <fixtureFamilyId> '{"title":"…","subject":"…"}'
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts usage <fixtureFamilyId> '{"apps":12,"changes":500}'
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts org <fixtureFamilyId>   (an organization it owns, with paid and refunded codes)
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts visits <fixtureFamilyId> '{"passing":900}'   (location history: a long stay, then a drive)
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts place <fixtureFamilyId> [name]   (a saved place, on any plan)
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts device <fixtureFamilyId> '{"offlineHours":48}'   (a phone, or '{"browser":true}')
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts staff   (STAFF=… console session; cookie eg_staff on console.localhost)
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts ticket <fixtureFamilyId>
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts purchase <fixtureFamilyId> '{"autoRenewing":false}'
 *   npx tsx --env-file=.env .claude/skills/qa-audit/scripts/qa.mts cleanup
 * Sessions last an hour and are marked userAgent "qa-audit"; fixture families are named "QA Audit Fixture".
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const FIXTURE = "QA Audit Fixture";
const MARK = "qa-audit";
const STAFF_EMAIL = "qa-staff@example.invalid";
const db = new PrismaClient();

if (/prod/i.test(process.env.NODE_ENV ?? "") || /prod/i.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refusing to run against what looks like a production database.");
  process.exit(1);
}

async function session(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, tokenHash: createHash("sha256").update(token).digest("hex"), userAgent: MARK, expiresAt: new Date(Date.now() + 3600e3) },
  });
  return token;
}

const [cmd, a, b] = process.argv.slice(2);
try {
  if (cmd === "session") {
    const u = await db.user.findUniqueOrThrow({ where: { email: a ?? "randy@example.com" } });
    console.log(`TOKEN=${await session(u.id)}`);
  } else if (cmd === "fixture") {
    const plan = a ?? "Free";
    const deviceLimit = plan === "Family Pro" ? 20 : plan === "eGuard Plus" ? 10 : 2;
    const f = await db.family.create({
      data: {
        name: FIXTURE, plan, deviceLimit,
        users: { create: { email: `qa-${Date.now()}@example.invalid`, name: "QA Parent", passwordHash: "x", role: "FAMILY_ADMIN", emailVerifiedAt: new Date() } },
        ...(b ? { children: { create: { name: b, birthYear: new Date().getFullYear() - 10 } } } : {}),
      },
      include: { users: true, children: true },
    });
    console.log(`TOKEN=${await session(f.users[0].id)} FAMILY=${f.id}${f.children[0] ? ` CHILD=${f.children[0].id}` : ""}`);
  } else if (cmd === "parent") {
    // Only into a fixture family, so cleanup removes it with the family
    const f = await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE } });
    const u = await db.user.create({
      data: { familyId: f.id, email: `qa-parent-${Date.now()}@example.invalid`, name: "QA Second Parent", passwordHash: "x", role: "PARENT", emailVerifiedAt: new Date() },
    });
    console.log(`TOKEN=${await session(u.id)} USER=${u.id}`);
  } else if (cmd === "alert") {
    // An alert in a fixture family; `b` is JSON for any Alert fields (title, subject, category, resolveKey, childId…)
    const f = await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE } });
    const al = await db.alert.create({ data: { severity: "INFO", category: "SYSTEM", icon: "bell", title: "QA alert", subject: "QA", body: "QA", ...JSON.parse(b ?? "{}"), familyId: f.id } });
    console.log(`ALERT=${al.id}`);
  } else if (cmd === "usage") {
    // Report data in a fixture family: `b` is JSON { apps: number of apps used yesterday, changes: ConfigChange rows today }
    const f = await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE }, include: { children: true } });
    // `todayTop`: the last n apps are also used today and listed as the child's apps, so on Free the Apps tab shows
    // them, not the week's most used
    const o = { apps: 0, changes: 0, todayTop: 0, ...JSON.parse(b ?? "{}") } as { apps: number; changes: number; todayTop: number };
    const child = f.children[0];
    const day = new Date(new Date(Date.now() - 864e5).toISOString().slice(0, 10) + "T00:00:00Z");
    await db.appUsageDaily.createMany({ data: Array.from({ length: o.apps }, (_, i) => ({ childId: child.id, date: day, app: `QA App ${i + 1}`, minutes: 100 - i })) });
    await db.screenTimeDaily.create({ data: { childId: child.id, date: day, minutes: Array.from({ length: o.apps }, (_, i) => 100 - i).reduce((s, m) => s + m, 0) } });
    await db.configChange.createMany({ data: Array.from({ length: o.changes }, (_, i) => ({ familyId: f.id, childId: child.id, key: "SCREEN_TIME" as const, title: `QA change ${i + 1}`, actor: "QA" })) });
    if (o.todayTop) {
      const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      await db.childApp.createMany({ data: Array.from({ length: o.apps }, (_, i) => ({ childId: child.id, name: `QA App ${i + 1}` })) });
      await db.appUsageDaily.createMany({ data: Array.from({ length: o.todayTop }, (_, i) => ({ childId: child.id, date: today, app: `QA App ${o.apps - i}`, minutes: 1 })) });
    }
    console.log(`apps=${o.apps} changes=${o.changes} todayTop=${o.todayTop}`);
  } else if (cmd === "org") {
    // An organization owned by a fixture family's admin, with a paid batch of 3 codes and a refunded batch of 2
    const f = await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE }, include: { users: true } });
    const owner = f.users.find((u) => u.role === "FAMILY_ADMIN")!;
    const now = new Date(), later = new Date(Date.now() + 300 * 864e5);
    const code = () => randomBytes(9).toString("base64url").toUpperCase().replace(/[^A-Z2-9]/g, "A").slice(0, 12).padEnd(12, "Q");
    const org = await db.organization.create({
      data: {
        name: FIXTURE, kind: "SCHOOL", joinCode: code().slice(0, 8), members: { create: { userId: owner.id, role: "OWNER" } },
        batches: { create: [
          { plan: "PLUS", months: 1, quantity: 3, amount: 1, state: "PAID", paidAt: now, purchaseToken: `qa-${randomBytes(6).toString("hex")}`, createdBy: owner.id, vouchers: { create: [0, 1, 2].map(() => ({ code: code(), expiresAt: later })) } },
          { plan: "PLUS", months: 1, quantity: 2, amount: 1, state: "VOIDED", paidAt: now, purchaseToken: `qa-${randomBytes(6).toString("hex")}`, createdBy: owner.id, vouchers: { create: [0, 1].map(() => ({ code: code(), expiresAt: later, revokedAt: now })) } },
        ] },
      },
    });
    console.log(`ORG=${org.id}`);
  } else if (cmd === "invite") {
    // An invitation to manage a fixture organization, from its owner, without sending email
    const org = await db.organization.findFirstOrThrow({ where: { id: a, name: FIXTURE }, include: { members: true } });
    const inv = await db.orgInvite.create({ data: { orgId: org.id, email: b!.toLowerCase(), invitedById: org.members[0].userId, expiresAt: new Date(Date.now() + 14 * 864e5) } });
    console.log(`INVITE=${inv.id}`);
  } else if (cmd === "visits") {
    // Location history for a fixture family's first child: history on, a sharing phone, a stay that began 3 days ago
    // and ended 6 hours ago, then a drive since (`passing` fixes 20 s apart, a 30-minute stay every 50th)
    const f = await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE }, include: { children: true } });
    const o = { passing: 900, ...JSON.parse(b ?? "{}") } as { passing: number };
    const child = f.children[0], now = Date.now(), start = now - 6 * 3600e3;
    await db.family.update({ where: { id: f.id }, data: { keepLocationHistory: true } });
    const d = await db.device.create({
      data: { familyId: f.id, childId: child.id, name: "QA Phone", model: "QA", platform: "ANDROID", osVersion: "14", lastSeenAt: new Date(),
        location: { create: { sharing: true, lat: 14.6, lng: 121.0, accuracyM: 20, locatedAt: new Date() } } },
    });
    const v = (at: number, until: number, i: number) => ({ deviceId: d.id, childId: child.id, lat: 14.6 + i * 1e-3, lng: 121.0, arrivedAt: new Date(at), lastSeenAt: new Date(until) });
    await db.locationVisit.createMany({ data: [
      v(now - 3 * 864e5, start - 60e3, 0),
      ...Array.from({ length: o.passing }, (_, i) => { const at = start + i * 20e3; return v(at, at + (i % 50 === 0 ? 1800e3 : 0), i + 1); }),
    ] });
    console.log(`DEVICE=${d.id} visits=${o.passing + 1}`);
  } else if (cmd === "device") {
    // A phone (or a browser) for a fixture family's first child; `b` is JSON { offlineHours, browser: true }
    const f = await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE }, include: { children: true } });
    const o = { offlineHours: 0, browser: false, ...JSON.parse(b ?? "{}") } as { offlineHours: number; browser: boolean };
    const child = f.children[0], lastSeenAt = new Date(Date.now() - o.offlineHours * 3600e3);
    const d = o.browser
      ? await db.browserInstallation.create({ data: { familyId: f.id, childId: child.id, deviceLabel: "QA Laptop", browser: "Chrome", extensionVersion: "1.0.0", platform: "win", lastSeenAt, protectionState: "PROTECTED" } })
      : await db.device.create({ data: { familyId: f.id, childId: child.id, name: "QA Phone", model: "QA", platform: "ANDROID", osVersion: "14", lastSeenAt } });
    console.log(`${o.browser ? "BROWSER" : "DEVICE"}=${d.id}`);
  } else if (cmd === "place") {
    // A saved place in a fixture family on any plan (the API refuses new places on Free)
    const f = await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE } });
    const p = await db.place.create({ data: { familyId: f.id, name: b ?? "QA Home", lat: 14.6, lng: 121.0 } });
    console.log(`PLACE=${p.id}`);
  } else if (cmd === "plan") {
    // Moves a fixture family to another plan without billing (downgrade checks: what's kept, paused or removable)
    const f = await db.family.update({ where: { id: (await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE } })).id }, data: { plan: b ?? "Free" } });
    console.log(`plan=${f.plan}`);
  } else if (cmd === "staff") {
    // A console session for a QA staff account that can't sign in (no real password or authenticator)
    const s = await db.staffUser.upsert({
      where: { email: STAFF_EMAIL }, update: { active: true },
      create: { email: STAFF_EMAIL, name: "QA Staff", passwordHash: "x", totpSecret: "x" },
    });
    const token = randomBytes(32).toString("base64url");
    await db.staffSession.create({
      data: { staffId: s.id, tokenHash: createHash("sha256").update(token).digest("hex"), userAgent: MARK, expiresAt: new Date(Date.now() + 3600e3) },
    });
    console.log(`STAFF=${token}`);
  } else if (cmd === "ticket") {
    // A support ticket from a fixture family, without emailing support
    const f = await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE }, include: { users: true } });
    const t = await db.supportTicket.create({ data: { familyId: f.id, userId: f.users[0].id, category: "other", subject: "QA ticket", message: "QA line one\nline two" } });
    console.log(`TICKET=${t.id}`);
  } else if (cmd === "purchase") {
    // A purchase that grants a fixture family its plan; `b` is JSON { productId, autoRenewing, state }
    const f = await db.family.findFirstOrThrow({ where: { id: a, name: FIXTURE } });
    const o = { productId: "plus_pass_month", autoRenewing: false, state: "PAID", ...JSON.parse(b ?? "{}") };
    const expiresAt = new Date(Date.now() + 20 * 864e5);
    await db.storePurchase.create({ data: { familyId: f.id, store: "PAYMONGO", purchaseToken: `qa-${randomBytes(6).toString("hex")}`, expiresAt, ...o } });
    await db.family.update({ where: { id: f.id }, data: { renewsAt: expiresAt } });
    console.log(`renewsAt=${expiresAt.toISOString()}`);
  } else if (cmd === "email") {
    // A fixture user's email, for invitations
    const u = await db.user.findFirstOrThrow({ where: { familyId: a, family: { name: FIXTURE } } });
    console.log(u.email);
  } else if (cmd === "cleanup") {
    const orgs = await db.organization.deleteMany({ where: { name: FIXTURE } });
    if (orgs.count) console.log(`deleted organizations=${orgs.count}`);
    const families = await db.family.deleteMany({ where: { name: FIXTURE } });
    const sessions = await db.session.deleteMany({ where: { userAgent: MARK } });
    // Its sessions and audit entries go with it
    const staff = await db.staffUser.deleteMany({ where: { email: STAFF_EMAIL } });
    await db.rateLimit.deleteMany({ where: { key: `staff:acct:${STAFF_EMAIL}` } });
    console.log(`deleted families=${families.count} sessions=${sessions.count} staff=${staff.count}`);
  } else {
    console.error("usage: qa.mts session <email> | fixture [plan] [childName] | parent <fixtureFamilyId> | alert <fixtureFamilyId> [json] | cleanup");
    process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
