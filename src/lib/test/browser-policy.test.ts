import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../audit", () => ({ audit: vi.fn() }));

const policy = {
  id: "p1", childId: "c1", version: 3, safeBrowsing: true, safeSearch: true, blockedCategories: ["ADULT"],
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

const { updateBrowserPolicy } = await import("../browser-policy");
const actor = { id: "u1", name: "Randy", familyId: "f1", role: "FAMILY_ADMIN" as const };
// What the parent's stale form would send: it still has the allowed list from version 2
const staleForm = { ...policy, allowedDomains: [], schedule: null } as never;

describe("updateBrowserPolicy", () => {
  it("refuses a save based on an older version, so it can't undo a newer change", async () => {
    await expect(updateBrowserPolicy(actor as never, "c1", staleForm, "web", 2)).rejects.toMatchObject({ status: 409, code: "stale_version" });
    expect(transaction).not.toHaveBeenCalled();
  });
});
