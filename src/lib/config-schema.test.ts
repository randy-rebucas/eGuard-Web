import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./engine", () => ({ syncChildLimits: vi.fn() }));

const { ConfigSchema, ReportedConfigSchema } = await import("./config-service");

describe("ReportedConfigSchema", () => {
  it("accepts what a device can legitimately read back", () => {
    expect(ReportedConfigSchema.safeParse({ key: "SCREEN_TIME", dailyMinutes: 0, weekendMinutes: 0 }).success).toBe(true);
    expect(ReportedConfigSchema.safeParse({ key: "BEDTIME", enabled: true, start: "21:30", end: "06:00", days: "EVERY_DAY" }).success).toBe(true);
    expect(ReportedConfigSchema.safeParse({ key: "CONTENT", maxAgeRating: 0 }).success).toBe(true);
  });
  it("rejects shapes the parent's pages can't render", () => {
    // Missing start would crash to12h() on the dashboard
    expect(ReportedConfigSchema.safeParse({ key: "BEDTIME", enabled: true, end: "06:00", days: "EVERY_DAY" }).success).toBe(false);
    expect(ReportedConfigSchema.safeParse({ key: "SCREEN_TIME", dailyMinutes: "120", weekendMinutes: 120 }).success).toBe(false);
    expect(ReportedConfigSchema.safeParse({ key: "SCREEN_TIME", dailyMinutes: 99999, weekendMinutes: 0 }).success).toBe(false);
  });
  it("rejects extra fields, which the spec says must fail", () => {
    expect(ReportedConfigSchema.safeParse({ key: "LOCATION", sharing: true, accuracy: "high" }).success).toBe(false);
  });
});

describe("ConfigSchema bedtime", () => {
  it("needs different start and end times while it's on", () => {
    const b = (enabled: boolean) => ({ key: "BEDTIME", enabled, start: "21:00", end: "21:00", days: "EVERY_DAY" });
    expect(ConfigSchema.safeParse(b(true)).error?.issues[0].message).toBe("Bedtime needs different start and end times.");
    expect(ConfigSchema.safeParse(b(false)).success).toBe(true);
  });
});

describe("times", () => {
  it("accept only real 24-hour times, for parents and devices", () => {
    const bedtime = (start: string) => ({ key: "BEDTIME", enabled: true, start, end: "06:00", days: "EVERY_DAY" });
    for (const s of ["00:00", "09:30", "23:59"]) expect(ConfigSchema.safeParse(bedtime(s)).success, s).toBe(true);
    for (const s of ["24:00", "25:00", "99:99", "9:30", "12:60"]) {
      expect(ConfigSchema.safeParse(bedtime(s)).success, s).toBe(false);
      expect(ReportedConfigSchema.safeParse(bedtime(s)).success, s).toBe(false);
    }
  });
});
