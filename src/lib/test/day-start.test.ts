import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));

const { dayStart } = await import("../queries");

describe("dayStart", () => {
  it("is local midnight, east and west of UTC", () => {
    expect(dayStart("2026-09-28", "Asia/Manila").toISOString()).toBe("2026-09-27T16:00:00.000Z");
    expect(dayStart("2026-09-28", "America/Los_Angeles").toISOString()).toBe("2026-09-28T07:00:00.000Z");
    expect(dayStart("2026-09-28", "UTC").toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });
  it("handles days either side of a DST change", () => {
    expect(dayStart("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(dayStart("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(dayStart("2026-10-04", "Australia/Sydney").toISOString()).toBe("2026-10-03T14:00:00.000Z");
    expect(dayStart("2026-10-05", "Australia/Sydney").toISOString()).toBe("2026-10-04T13:00:00.000Z");
  });
});
