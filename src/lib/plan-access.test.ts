import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({}));

const { capAppUsage } = await import("./plan-access");

const rows = [
  { app: "YouTube", minutes: 90 }, { app: "Roblox", minutes: 60 }, { app: "Others", minutes: 25 },
  { app: "Chrome", minutes: 20 }, { app: "Duolingo", minutes: 5 },
];

describe("capAppUsage", () => {
  it("names only the plan's limit of apps and sums the rest", () => {
    const r = capAppUsage(rows, 2);
    expect(r.named.map((a) => a.app)).toEqual(["YouTube", "Roblox"]);
    // The device's own Others row is never named, and counts toward Others
    expect(r.others).toBe(25 + 20 + 5);
    expect(r.hidden).toBe(2);
  });
  it("names every app without a limit", () => {
    const r = capAppUsage(rows, null);
    expect(r.named).toHaveLength(4);
    expect(r.others).toBe(25);
    expect(r.hidden).toBe(0);
  });
});
