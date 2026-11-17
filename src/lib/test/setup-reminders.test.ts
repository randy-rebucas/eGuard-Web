import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../email-verification", () => ({ appUrl: () => "https://app.test" }));
const sendMail = vi.hoisted(() => vi.fn());
vi.mock("../mail", async () => ({ sendMail, escapeHtml: (await vi.importActual<typeof import("../mail")>("../mail")).escapeHtml }));
const db = vi.hoisted(() => ({ family: { findMany: vi.fn(), updateMany: vi.fn() }, user: { findMany: vi.fn() } }));
vi.mock("../db", () => ({ db }));

const { reminderDue, nameList, setupReminderEmail, addChildReminderEmail, sendSetupReminders, STEPS, START_WITHIN_DAYS } = await import("../setup-reminders");

const DAY = 864e5;
// 10:00 in Manila (UTC+8): inside the sending window
const now = new Date("2026-11-17T02:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const state = (o: Partial<Parameters<typeof reminderDue>[0]> = {}) => ({ since: ago(2), sent: 0, lastAt: null, timezone: "Asia/Manila", ...o });

describe("reminderDue", () => {
  it("sends the first a day after the child was added, not before", () => {
    expect(reminderDue(state({ since: ago(0.5) }), now)).toBe(false);
    expect(reminderDue(state({ since: ago(1) }), now)).toBe(true);
  });

  it("spaces later steps by the gap between them", () => {
    expect(reminderDue(state({ since: ago(4), sent: 1, lastAt: ago(3) }), now)).toBe(true);
    // Found late: step 2 waits for 3 days after step 1, though the child was added long ago
    expect(reminderDue(state({ since: ago(30), sent: 1, lastAt: ago(1) }), now)).toBe(false);
    expect(reminderDue(state({ since: ago(30), sent: 2, lastAt: ago(STEPS[2] - STEPS[1]) }), now)).toBe(true);
  });

  it("stops after the last step", () => {
    expect(reminderDue(state({ since: ago(60), sent: STEPS.length, lastAt: ago(30) }), now)).toBe(false);
  });

  it("doesn't start for old accounts, but finishes a sequence already started", () => {
    expect(reminderDue(state({ since: ago(START_WITHIN_DAYS + 1) }), now)).toBe(false);
    expect(reminderDue(state({ since: ago(START_WITHIN_DAYS + 1), sent: 1, lastAt: ago(5) }), now)).toBe(true);
  });

  it("only sends in the family's daytime", () => {
    // 02:00 UTC is 21:00 the day before in New York
    expect(reminderDue(state({ timezone: "America/New_York" }), now)).toBe(false);
  });
});

describe("setupReminderEmail", () => {
  it("names the children", () => {
    expect(nameList(["Mia"])).toBe("Mia");
    expect(nameList(["Mia", "Leo"])).toBe("Mia and Leo");
    expect(nameList(["Mia", "Leo", "Sam"])).toBe("Mia, Leo and Sam");
  });

  it("gives the phone steps and asks for the browser extension", () => {
    const m = setupReminderEmail({ step: 0, parent: "Ana", children: ["Mia"], hasBrowser: false });
    expect(m.subject).toBe("Finish setting up eGuard: connect Mia's phone");
    expect(m.text).toMatch(/^Hi Ana,/);
    expect(m.text).toContain("https://app.test/devices#pair");
    expect(m.text).toContain("https://app.test/devices#add-browser");
    expect(m.text).toContain("chromewebstore.google.com");
    expect(m.text).toContain("addons.mozilla.org");
    expect(m.text).toContain("microsoftedge.microsoft.com");
    expect(m.html).toContain("Protect Mia&#39;s browser too");
  });

  it("acknowledges a browser already connected instead of asking again", () => {
    const m = setupReminderEmail({ step: 1, parent: "Ana", children: ["Mia", "Leo"], hasBrowser: true });
    expect(m.subject).toBe("Mia and Leo aren't protected yet");
    expect(m.text).toContain("already protected");
    expect(m.text).not.toContain("https://app.test/devices#add-browser");
    expect(m.text).not.toContain("extension below");
  });

  it("escapes names in the html", () => {
    const m = setupReminderEmail({ step: 2, parent: "<b>", children: ["<i>x</i>"], hasBrowser: false });
    expect(m.subject.startsWith("Last reminder")).toBe(true);
    expect(m.html).not.toContain("<i>x</i>");
    expect(m.html).not.toContain("<b>");
  });
});

describe("addChildReminderEmail", () => {
  it("asks for the child first, then the phone and browser", () => {
    const m = addChildReminderEmail({ step: 0, parent: "Ana" });
    expect(m.subject).toBe("Finish setting up eGuard: add your child");
    expect(m.text).toMatch(/^Hi Ana,/);
    expect(m.text).toContain("https://app.test/children/new");
    expect(m.text).toContain("play.google.com");
    expect(m.text).toContain("chromewebstore.google.com");
    expect(m.text).toContain("stop once you add a child");
    expect(addChildReminderEmail({ step: 2, parent: "" }).subject).toBe("Last reminder: finish setting up eGuard");
  });
});

describe("sendSetupReminders", () => {
  beforeEach(() => vi.clearAllMocks());

  const withKids = { id: "f1", timezone: "Asia/Manila", setupReminders: 0, setupRemindedAt: null, children: [{ name: "Mia", createdAt: ago(2) }], browsers: [] };
  const noKids = { id: "f2", timezone: "Asia/Manila", createdAt: ago(2), childReminders: 0, childRemindedAt: null };
  /** The no-children scan runs first, then the no-devices one */
  const scans = (none: unknown[], some: unknown[]) => db.family.findMany.mockResolvedValueOnce(none).mockResolvedValueOnce(some);

  it("claims the step, then emails each verified parent with email alerts on", async () => {
    scans([], [withKids]);
    db.family.updateMany.mockResolvedValue({ count: 1 });
    db.user.findMany.mockResolvedValue([{ email: "a@x.ph", name: "Ana Cruz" }, { email: "b@x.ph", name: "Ben" }]);
    const r = await sendSetupReminders(now);
    expect(db.family.findMany.mock.calls[1][0].where).toEqual({ setupReminders: { lt: STEPS.length }, children: { some: {} }, devices: { none: {} } });
    expect(db.family.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", setupReminders: 0, devices: { none: {} } }, data: { setupReminders: 1, setupRemindedAt: now },
    });
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({ familyId: "f1", notifyEmail: true, emailVerifiedAt: { not: null } });
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail.mock.calls[0][0].text).toMatch(/^Hi Ana,/);
    expect(sendMail.mock.calls[0][0].subject).toContain("Mia");
    expect(r.noDevices).toEqual({ families: 1, due: 1, sent: 2, failed: 0 });
  });

  it("asks a family with no children to add one, claiming on its own counter", async () => {
    scans([noKids], []);
    db.family.updateMany.mockResolvedValue({ count: 1 });
    db.user.findMany.mockResolvedValue([{ email: "a@x.ph", name: "Ana" }]);
    const r = await sendSetupReminders(now);
    expect(db.family.findMany.mock.calls[0][0].where).toMatchObject({ childReminders: { lt: STEPS.length }, children: { none: {} } });
    expect(db.family.updateMany).toHaveBeenCalledWith({
      where: { id: "f2", childReminders: 0, children: { none: {} } }, data: { childReminders: 1, childRemindedAt: now },
    });
    expect(sendMail.mock.calls[0][0].subject).toBe("Finish setting up eGuard: add your child");
    expect(r.noChildren).toEqual({ families: 1, due: 1, sent: 1, failed: 0 });
  });

  it("sends nothing when another run claimed it, or a child or device was added meanwhile", async () => {
    scans([noKids], [withKids]);
    db.family.updateMany.mockResolvedValue({ count: 0 });
    const r = await sendSetupReminders(now);
    expect(sendMail).not.toHaveBeenCalled();
    expect(r.noChildren.due + r.noDevices.due).toBe(0);
  });

  it("skips families not yet due without claiming", async () => {
    scans([{ ...noKids, createdAt: ago(0.2) }], [{ ...withKids, children: [{ name: "Mia", createdAt: ago(0.2) }] }]);
    await sendSetupReminders(now);
    expect(db.family.updateMany).not.toHaveBeenCalled();
  });

  it("counts a failed email and carries on", async () => {
    scans([], [withKids]);
    db.family.updateMany.mockResolvedValue({ count: 1 });
    db.user.findMany.mockResolvedValue([{ email: "a@x.ph", name: "Ana" }, { email: "b@x.ph", name: "Ben" }]);
    sendMail.mockRejectedValueOnce(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await sendSetupReminders(now);
    expect(r.noDevices).toMatchObject({ sent: 1, failed: 1 });
  });
});
