import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("@/components/cards", () => ({ alertAction: () => null }));

const { dayRange } = await import("../views");

describe("dayRange", () => {
  it("names the month once within a month", () => {
    expect(dayRange("2026-09-03", "2026-09-09")).toBe("Sep 3 – 9");
  });
  it("names both months when the range crosses one", () => {
    expect(dayRange("2026-09-25", "2026-10-01")).toBe("Sep 25 – Oct 1");
    expect(dayRange("2026-12-29", "2027-01-04")).toBe("Dec 29 – Jan 4");
  });
});
