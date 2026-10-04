import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: { checkRun: { findMany: vi.fn() }, configRequest: { findMany: vi.fn(), updateMany: vi.fn() }, alert: { create: vi.fn() } } }));
vi.mock("../engine", () => ({ finalizeCheckRun: vi.fn() }));
vi.mock("../browser-health", () => ({}));
vi.mock("../billing", () => ({}));
vi.mock("../web-billing", () => ({}));
vi.mock("../organizations", () => ({}));
vi.mock("../org-notifications", () => ({}));
vi.mock("../email-verification", () => ({}));
vi.mock("../mail", () => ({}));
vi.mock("../plan-access", () => ({}));
vi.mock("../push", () => ({}));

type Fn = ReturnType<typeof vi.fn>;
const { isChildRequest, worthEmail, closeStaleWork, OPEN_CHANGE_DAYS } = await import("../maintenance");
const { isDismissible } = await import("../health");
const { db } = (await import("../db")) as unknown as { db: { checkRun: { findMany: Fn }; configRequest: { findMany: Fn; updateMany: Fn }; alert: { create: Fn } } };
const { finalizeCheckRun } = (await import("../engine")) as unknown as { finalizeCheckRun: Fn };

const alert = (a: Partial<{ severity: string; category: string; resolveKey: string | null }>) =>
  ({ severity: "INFO", category: "SYSTEM", resolveKey: null, ...a }) as Parameters<typeof worthEmail>[0];

describe("alert emails", () => {
  it("emails a child's app request, which is in the APPS category", () => {
    const a = alert({ severity: "ATTENTION", category: "APPS", resolveKey: "APPREQ:child1:Roblox" });
    expect(isChildRequest(a)).toBe(true);
    expect(worthEmail(a)).toBe(true);
  });

  it("treats a website access request as a child's request too", () => {
    expect(isChildRequest(alert({ severity: "ATTENTION", category: "PROTECTION", resolveKey: "WEBREQ:req1" }))).toBe(true);
  });

  it("still skips other app notices", () => {
    expect(worthEmail(alert({ category: "APPS", resolveKey: null }))).toBe(false);
    expect(worthEmail(alert({ severity: "ATTENTION", category: "SCREEN_TIME" }))).toBe(false);
  });

  it("keeps emailing tampering and anything that needs action", () => {
    const changed = alert({ severity: "ATTENTION", category: "PROTECTION", resolveKey: "BEDTIME:device1" });
    expect(worthEmail(changed)).toBe(true);
    expect(isChildRequest(changed)).toBe(false);
    expect(worthEmail(alert({ severity: "ACTION_REQUIRED", category: "APPS" }))).toBe(true);
  });
});

describe("closeStaleWork", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const bedtime = { key: "BEDTIME", enabled: true, start: "21:00", end: "06:30", days: "EVERY_DAY" };
  const req = (id: string, batchId: string, device: string) => ({
    id, batchId, key: "BEDTIME", desired: bedtime, childId: "mia", child: { name: "Mia", familyId: "fam" }, device: { name: device },
  });

  it("finishes check runs left running and gives up week-old changes, leaving newer ones alone", async () => {
    db.checkRun.findMany.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);
    db.configRequest.findMany.mockResolvedValue([req("q1", "b1", "Galaxy A54"), req("q2", "b1", "Tablet")]);
    db.configRequest.updateMany.mockResolvedValue({ count: 2 });

    expect(await closeStaleWork(now)).toEqual({ checks: 2, requests: 2, notices: 1 });

    // Only runs well past their 12 s, so a check still being polled is untouched
    expect(db.checkRun.findMany).toHaveBeenCalledWith({ where: { status: "RUNNING", createdAt: { lt: new Date("2026-10-04T11:50:00Z") } }, select: { id: true } });
    expect(finalizeCheckRun.mock.calls).toEqual([["r1"], ["r2"]]);
    const open = ["PENDING", "DELIVERED", "AWAITING_PARENT"];
    expect(db.configRequest.findMany.mock.calls[0][0].where).toEqual({ status: { in: open }, createdAt: { lt: new Date(now.getTime() - OPEN_CHANGE_DAYS * 864e5) } });
    // Cancels only those, and only while still open: one a device confirmed meanwhile stays verified
    const { where, data } = db.configRequest.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: { in: ["q1", "q2"] }, status: { in: open } });
    expect(data.status).toBe("CANCELLED");
  });

  it("tells the parent once per change, as a dismissible notice that offers to try again", async () => {
    db.alert.create.mockClear();
    db.checkRun.findMany.mockResolvedValue([]);
    db.configRequest.findMany.mockResolvedValue([req("q1", "b1", "Galaxy A54"), req("q2", "b1", "Tablet"), req("q3", "b2", "Tablet")]);
    db.configRequest.updateMany.mockResolvedValue({ count: 3 });

    expect((await closeStaleWork(now)).notices).toBe(2);
    const first = db.alert.create.mock.calls[0][0].data;
    expect(first).toMatchObject({
      familyId: "fam", childId: "mia", severity: "INFO", category: "PROTECTION",
      title: "Bedtime change wasn't confirmed", subject: "Mia's Galaxy A54 and Tablet", toValue: "9:00 PM – 6:30 AM",
      resolveKey: "BEDTIME:expired:b1",
    });
    expect(first.body).toMatch(/Mia's earlier setting stays in place/);
    // Info: the parent can dismiss it, and it isn't emailed
    expect(isDismissible({ ...first, resolvedAt: null })).toBe(true);
    expect(worthEmail(first)).toBe(false);
  });

  it("does nothing more when nothing is stale", async () => {
    db.alert.create.mockClear();
    db.configRequest.updateMany.mockClear();
    db.checkRun.findMany.mockResolvedValue([]);
    db.configRequest.findMany.mockResolvedValue([]);
    expect(await closeStaleWork(now)).toEqual({ checks: 0, requests: 0, notices: 0 });
    expect(db.configRequest.updateMany).not.toHaveBeenCalled();
    expect(db.alert.create).not.toHaveBeenCalled();
  });
});
