import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../email-verification", () => ({ appUrl: () => "https://app.test" }));
vi.mock("../mail", async () => ({ sendMail: vi.fn(), escapeHtml: (s: string) => s.replace(/</g, "&lt;") }));

const { digestWeek, digestDue, digestEmail, DIGEST_WINDOW_MS } = await import("../weekly-digest");

const MANILA = "Asia/Manila";

describe("digestWeek", () => {
  it("is this Sunday 6 PM local once it has passed, covering Sunday to Saturday before it", () => {
    // Sunday 2026-10-04, 7 PM in Manila (UTC+8)
    const w = digestWeek(new Date("2026-10-04T11:00:00Z"), MANILA);
    expect(w.dueAt.toISOString()).toBe("2026-10-04T10:00:00.000Z");
    expect(w).toMatchObject({ from: "2026-09-27", to: "2026-10-03" });
  });

  it("is last Sunday before 6 PM on a Sunday, and midweek", () => {
    expect(digestWeek(new Date("2026-10-04T09:00:00Z"), MANILA).dueAt.toISOString()).toBe("2026-09-27T10:00:00.000Z");
    expect(digestWeek(new Date("2026-10-07T03:00:00Z"), MANILA).dueAt.toISOString()).toBe("2026-10-04T10:00:00.000Z");
  });

  it("is 6 PM local on the Sunday clocks change", () => {
    // US DST ends Sunday 2026-11-01: 6 PM is then UTC-5
    expect(digestWeek(new Date("2026-11-02T00:00:00Z"), "America/New_York").dueAt.toISOString()).toBe("2026-11-01T23:00:00.000Z");
  });
});

describe("digestDue", () => {
  const sundayEvening = new Date("2026-10-04T11:00:00Z");

  it("is due once, on Sunday evening", () => {
    expect(digestDue({ timezone: MANILA, digestSentAt: null }, sundayEvening)).not.toBeNull();
    expect(digestDue({ timezone: MANILA, digestSentAt: new Date("2026-09-27T10:05:00Z") }, sundayEvening)).not.toBeNull();
    expect(digestDue({ timezone: MANILA, digestSentAt: new Date("2026-10-04T10:05:00Z") }, sundayEvening)).toBeNull();
  });

  it("skips a week missed by more than the window instead of sending it midweek", () => {
    const late = new Date(new Date("2026-10-04T10:00:00Z").getTime() + DIGEST_WINDOW_MS + 60_000);
    expect(digestDue({ timezone: MANILA, digestSentAt: null }, late)).toBeNull();
  });
});

describe("digestEmail", () => {
  const content = {
    family: "Santos <Family>", from: "2026-09-27", to: "2026-10-03",
    health: { score: 9, total: 10, offline: 1 }, avg: 150, prevAvg: 120,
    children: [{ name: "Mia", minutes: 1050 }], topApps: [{ app: "YouTube", minutes: 300 }],
    changes: 2, attention: 1, requests: 0,
  };

  it("summarises the week with the trend and what's waiting", () => {
    const m = digestEmail(content, "Ana", "https://app.test/reports");
    expect(m.subject).toBe("Your eGuard week: Sep 27 – Oct 3");
    expect(m.text).toContain("9 of 10 checks passing (1 device offline");
    expect(m.text).toContain("2h 30m a day on average, 30m more than the week before");
    expect(m.text).toContain("Mia: 17h 30m this week");
    expect(m.text).toContain("Most used: YouTube (5h)");
    expect(m.text).toContain("Waiting for you: 1 alert");
    expect(m.html).toContain("Santos &lt;Family>");
  });

  it("leaves out the trend with nothing to compare, and the waiting line when nothing waits", () => {
    const m = digestEmail({ ...content, prevAvg: null, attention: 0 }, "Ana", "x");
    expect(m.text).toContain("2h 30m a day on average\n");
    expect(m.text).not.toContain("Waiting for you");
  });
});
