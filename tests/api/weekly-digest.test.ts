import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

// Captures every email instead of sending it
const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/mail", async (orig) => ({
  ...(await orig<typeof import("@/lib/mail")>()),
  sendMail: async (m: { to: string; subject: string; text: string }) => { mail.sent.push(m); },
}));
import { sendWeeklyDigests } from "@/lib/weekly-digest";

/** The weekly summary (src/lib/weekly-digest.ts) against the real database. */

const db = new PrismaClient();
const RUN = `w${Date.now().toString(36)}`;
const DOMAIN = `${RUN}@digest-test.example`;
// Sunday 2026-10-04, 7 PM in Manila: last week is Sep 27 – Oct 3
const SUNDAY_EVENING = new Date("2026-10-04T11:00:00Z");
let familyId = "";

beforeAll(async () => {
  const f = await db.family.create({
    data: {
      name: `Digest ${RUN}`, timezone: "Asia/Manila",
      users: { create: [
        { name: "Ana Santos", email: `admin.${DOMAIN}`, passwordHash: "x", role: "FAMILY_ADMIN", emailVerifiedAt: new Date() },
        { name: "Ben Santos", email: `optout.${DOMAIN}`, passwordHash: "x", role: "PARENT", emailVerifiedAt: new Date(), weeklySummary: false },
        { name: "Cy Santos", email: `unverified.${DOMAIN}`, passwordHash: "x", role: "PARENT" },
      ] },
    },
  });
  familyId = f.id;
  const child = await db.child.create({ data: { familyId, name: "Mia", birthYear: 2015 } });
  await db.device.create({ data: { familyId, childId: child.id, name: "Phone", model: "Pixel", platform: "ANDROID", osVersion: "15" } });
  await db.screenTimeDaily.createMany({ data: [
    { childId: child.id, date: new Date("2026-09-28T00:00:00Z"), minutes: 120 },
    { childId: child.id, date: new Date("2026-10-02T00:00:00Z"), minutes: 90 },
    // Outside the week: Saturday before and today (Sunday)
    { childId: child.id, date: new Date("2026-09-26T00:00:00Z"), minutes: 70 },
    { childId: child.id, date: new Date("2026-10-04T00:00:00Z"), minutes: 500 },
  ] });
});

afterAll(async () => {
  await db.family.deleteMany({ where: { id: familyId } });
  await db.$disconnect();
});

const ours = () => mail.sent.filter((m) => m.to.endsWith(DOMAIN));

describe("weekly summary", () => {
  it("isn't sent before Sunday 6 PM", async () => {
    await sendWeeklyDigests(new Date("2026-10-04T09:00:00Z"));
    expect(ours()).toHaveLength(0);
  });

  it("goes once to each verified parent who wants it, with last week's numbers", async () => {
    await sendWeeklyDigests(SUNDAY_EVENING);
    const sent = ours();
    expect(sent.map((m) => m.to)).toEqual([`admin.${DOMAIN}`]);
    expect(sent[0].subject).toBe("Your eGuard week: Sep 27 – Oct 3");
    expect(sent[0].text).toContain("Hi Ana,");
    expect(sent[0].text).toContain("Mia: 3h 30m this week");
    expect(sent[0].text).toContain("/reports?period=custom&from=2026-09-27&to=2026-10-03");

    await sendWeeklyDigests(new Date(SUNDAY_EVENING.getTime() + 20 * 60_000));
    expect(ours()).toHaveLength(1);
    expect((await db.family.findUniqueOrThrow({ where: { id: familyId } })).digestSentAt).toEqual(SUNDAY_EVENING);
  });
});
