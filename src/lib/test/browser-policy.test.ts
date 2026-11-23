import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../audit", () => ({ audit: vi.fn() }));

const policy = {
  id: "p1", childId: "c1", version: 3, safeBrowsing: true, safeSearch: true, youtubeRestrict: "MODERATE", blockedCategories: ["ADULT"],
  // example.org was allowed "always" from an access request, after the parent opened the form at version 2
  blockedDomains: [], allowedDomains: ["example.org"], unknownSitesPolicy: "ALLOW", schedule: null, temporaryAllows: [],
  updatedAt: new Date(), updatedBy: "Ana",
};
const transaction = vi.fn();
vi.mock("../db", () => ({
  db: {
    child: { findFirst: vi.fn(async () => ({ id: "c1", name: "Mia", familyId: "f1" })) },
    browserPolicy: { findUnique: vi.fn(async () => policy) },
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

const { BrowserPolicyInput, defaultCategories, describeBrowserPolicy, updateBrowserPolicy, withWebMode } = await import("../browser-policy");
const actor = { id: "u1", name: "Randy", familyId: "f1", role: "FAMILY_ADMIN" as const };
// What the parent's stale form would send: it still has the allowed list from version 2
const staleForm = { ...policy, allowedDomains: [], schedule: null } as never;

describe("updateBrowserPolicy", () => {
  it("refuses a save based on an older version, so it can't undo a newer change", async () => {
    await expect(updateBrowserPolicy(actor as never, "c1", staleForm, "web", 2)).rejects.toMatchObject({ status: 409, code: "stale_version" });
    expect(transaction).not.toHaveBeenCalled();
  });

  // The form as an app that doesn't show YouTube Restricted Mode yet sends it: every field but that one
  const { youtubeRestrict: _omit, ...withoutYoutube } = policy;
  const appForm = BrowserPolicyInput.parse(withoutYoutube);

  it("keeps the saved YouTube level when a client leaves it out", async () => {
    expect(appForm.youtubeRestrict).toBeUndefined();
    // Same settings otherwise: nothing to write, and the level isn't reset
    expect(await updateBrowserPolicy(actor as never, "c1", appForm, "Android app", 3)).toBe(policy);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("saves a new YouTube level", async () => {
    let data: Record<string, unknown> | undefined;
    // Capture the write, then stop it (count 0 reads as a conflict)
    transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
      fn({ browserPolicy: { updateMany: async (a: { data: Record<string, unknown> }) => ((data = a.data), { count: 0 }) } }));
    await expect(updateBrowserPolicy(actor as never, "c1", { ...appForm, youtubeRestrict: "STRICT" }, "web", 3)).rejects.toMatchObject({ status: 409 });
    expect(data).toMatchObject({ youtubeRestrict: "STRICT" });
  });

  it("refuses an unknown YouTube level", () => {
    expect(BrowserPolicyInput.safeParse({ ...policy, youtubeRestrict: "LOW" }).success).toBe(false);
  });
});

describe("browser policy defaults and summary", () => {
  it("blocks proxies and translators at every age", () => {
    for (const age of [6, 10, 15, 17]) expect(defaultCategories(age)).toContain("PROXY");
  });

  it("names the YouTube level in the change history", () => {
    expect(describeBrowserPolicy(policy)).toContain("YouTube Restricted Mode moderate");
    expect(describeBrowserPolicy({ ...policy, youtubeRestrict: "OFF" })).toContain("YouTube Restricted Mode off");
  });

  it("names the other-sites choice and focus hours, so changing them doesn't log as no change", () => {
    const allow = describeBrowserPolicy({ ...policy, unknownSitesPolicy: "ALLOW", schedule: null });
    const block = describeBrowserPolicy({ ...policy, unknownSitesPolicy: "BLOCK", schedule: { enabled: true, startTime: "21:00", endTime: "06:00" } });
    expect(allow).toContain("other sites open");
    expect(block).toContain("only allowed sites open");
    expect(block).toContain("focus hours 21:00–06:00");
    expect(allow).not.toBe(block);
  });
});

describe("withWebMode", () => {
  const p = { blockedCategories: ["ADULT"], blockedDomains: ["x.com"], allowedDomains: ["kids.org"], unknownSitesPolicy: "ALLOW", safeSearch: true, youtubeRestrict: "MODERATE", safeBrowsing: true };
  it("blocks every site not allowed for Allowed sites only", () => {
    expect(withWebMode(p, "ALLOWLIST")).toEqual({ ...p, unknownSitesPolicy: "BLOCK" });
  });
  it("filters nothing when Web Filtering is off, keeping Safe Browsing and the allowed list", () => {
    expect(withWebMode(p, "OFF")).toEqual({ ...p, blockedCategories: [], blockedDomains: [], unknownSitesPolicy: "ALLOW", safeSearch: false, youtubeRestrict: "OFF" });
  });
  it("uses the browser protection settings as they are for Filter, or with no Web Filtering setting", () => {
    expect(withWebMode(p, "FILTER")).toBe(p);
    expect(withWebMode(p, undefined)).toBe(p);
  });
});
