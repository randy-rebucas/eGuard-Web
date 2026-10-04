import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ childApp: { findMany: vi.fn() } }));
const requested = vi.hoisted(() => ({ set: new Set<string>() }));
vi.mock("../db", () => ({ db }));
vi.mock("../family-service", () => ({ requestedApps: async () => requested.set }));

const { capAppUsage, nameableApps } = await import("../plan-access");

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

// 3 apps waiting for approval, little used; 4 allowed apps used a lot (the case that leaked names on Free)
const apps = [["PendA", "PENDING", 1], ["PendB", "PENDING", 2], ["PendC", "PENDING", 3], ["UsedA", "ALLOWED", 90], ["UsedB", "ALLOWED", 80], ["UsedC", "ALLOWED", 70], ["UsedD", "ALLOWED", 60]] as const;
const minutes = (n: string) => apps.find((a) => a[0] === n)?.[2] ?? 0;

describe("nameableApps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requested.set = new Set();
    db.childApp.findMany.mockResolvedValue(apps.map(([name, approval]) => ({ name, approval })));
  });

  it("names only what the Apps tab shows when the plan hides some", async () => {
    const may = await nameableApps("c1", 5, minutes);
    expect(apps.map(([n]) => n).filter(may)).toEqual(["PendA", "PendB", "PendC", "UsedA", "UsedB"]);
  });
  it("keeps an app the child asked for again visible", async () => {
    requested.set = new Set(["UsedD"]);
    expect((await nameableApps("c1", 5, minutes))("UsedD")).toBe(true);
  });
  it("names anything when nothing is hidden, including usage without an app row", async () => {
    expect((await nameableApps("c1", 10, minutes))("Unlisted")).toBe(true);
    expect((await nameableApps("c1", null, minutes))("UsedD")).toBe(true);
    // No plan limit: nothing to look up
    expect(db.childApp.findMany).toHaveBeenCalledTimes(1);
  });
});
