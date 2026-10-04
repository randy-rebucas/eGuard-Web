import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({}));
vi.mock("../auth", () => ({ PASSWORD_TOO_LONG: "", passwordTooLong: () => false }));
vi.mock("../billing", () => ({}));
vi.mock("../web-billing", () => ({}));
vi.mock("../organizations", () => ({}));
vi.mock("../audit", () => ({}));
vi.mock("../email-verification", () => ({}));
vi.mock("../rate-limit", () => ({}));
vi.mock("../device-slots", () => ({}));

const { ChildSchema } = await import("../family-service");
const year = (y: number) => ChildSchema.safeParse({ name: "Mia", birthYear: y });

afterEach(() => { vi.useRealTimers(); });

describe("ChildSchema birth year", () => {
  it("accepts children who can still be under 18", () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T00:00:00Z") });
    expect(year(2026).success).toBe(true);
    expect(year(2008).success).toBe(true);
  });
  it("rejects anyone who is at least 18, and future years", () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T00:00:00Z") });
    expect(year(2007).error?.issues[0].message).toBe("eGuard is for children under 18.");
    expect(year(2027).error?.issues[0].message).toBe("Enter a valid birth year.");
  });
  it("uses the current year, not the year the server started", () => {
    // Noon-ish UTC on these days is the same calendar year in every time zone (getFullYear is local time)
    vi.useFakeTimers({ now: new Date("2026-12-31T00:00:00Z") });
    expect(year(2027).success).toBe(false);
    vi.setSystemTime(new Date("2027-01-01T12:00:00Z"));
    expect(year(2027).success).toBe(true);
    expect(year(2008).success).toBe(false);
  });
});
