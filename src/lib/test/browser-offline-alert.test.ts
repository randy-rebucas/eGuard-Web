import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const findMany = vi.fn();
vi.mock("../db", () => ({ db: { browserInstallation: { findMany: (...a: unknown[]) => findMany(...a) } } }));
const createAlertUnless = vi.fn(async (..._a: unknown[]) => true);
vi.mock("../engine", () => ({ createAlertUnless: (...a: unknown[]) => createAlertUnless(...a), resolveAlerts: vi.fn() }));
vi.mock("../rate-limit", () => ({ enforce: vi.fn() }));

const { raiseBrowserOfflineAlerts } = await import("../browser-health");

describe("raiseBrowserOfflineAlerts", () => {
  it("says protection may be off after a day's silence, and how to check", async () => {
    const now = Date.parse("2026-10-13T12:00:00Z");
    findMany.mockResolvedValueOnce([{
      id: "bi1", familyId: "f1", childId: "c1", browser: "CHROME", deviceLabel: "Mia's laptop", child: { name: "Mia" },
    }]);
    expect(await raiseBrowserOfflineAlerts(now)).toBe(1);
    // Only browsers silent for over 24 hours (a laptop closed overnight isn't)
    expect(findMany.mock.calls[0]![0]).toMatchObject({ where: { revokedAt: null, lastSeenAt: { lt: new Date(now - 24 * 3600_000) } } });
    const alert = createAlertUnless.mock.calls[0]![2] as { title: string; body: string; severity: string };
    expect(alert.title).toBe("eGuard may be off in this browser");
    expect(alert.severity).toBe("ATTENTION");
    // Both readings of the silence, and what to do
    expect(alert.body).toContain("If it's just been closed, its settings are still on");
    expect(alert.body).toContain("If eGuard was turned off or removed there, nothing is filtered");
    expect(alert.body).toContain("accept eGuard's new permissions");
  });
});
