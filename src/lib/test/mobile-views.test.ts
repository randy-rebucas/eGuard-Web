import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../engine", () => ({ ensureOfflineAlerts: async () => {} }));
vi.mock("../simulator", () => ({ touchSimulated: async () => {} }));
vi.mock("../family-service", () => ({ requestedApps: async () => new Set() }));

const { overviewLocation, mobileAlertAction, deviceProtectionSummary } = await import("../mobile-views");

describe("deviceProtectionSummary", () => {
  const s = (key: "healthy" | "issues" | "offline", issues = 0, firstCheck = false) => ({ key, issues, firstCheck });

  it("never calls an offline device healthy", () => {
    expect(deviceProtectionSummary([s("offline")])).toEqual({ state: "offline", label: "Offline" });
    expect(deviceProtectionSummary([s("healthy"), s("offline")])).toEqual({ state: "offline", label: "1 of 2 devices offline" });
    expect(deviceProtectionSummary([s("healthy"), s("healthy")])).toEqual({ state: "healthy", label: "Healthy" });
  });

  it("puts issues first and says when a device hasn't reported yet", () => {
    expect(deviceProtectionSummary([s("offline"), s("issues", 2)])).toEqual({ state: "issues", label: "2 issues" });
    expect(deviceProtectionSummary([s("issues", 10, true)])).toEqual({ state: "issues", label: "Waiting for first check" });
    expect(deviceProtectionSummary([])).toEqual({ state: "no_devices", label: "No devices yet" });
  });
});

describe("mobileAlertAction", () => {
  const alert = (a: Partial<Parameters<typeof mobileAlertAction>[0]>) =>
    ({ resolveKey: null, category: "SYSTEM", childId: null, deviceId: null, subject: "", title: "", resolvedAt: null, ...a }) as Parameters<typeof mobileAlertAction>[0];

  it("sends account notices to the page they're about, and plan changes to Subscription", () => {
    expect(mobileAlertAction(alert({ subject: "Subscription", title: "Welcome to eGuard Plus" }))?.type).toBe("MANAGE_SUBSCRIPTION");
    expect(mobileAlertAction(alert({ subject: "Organizations", title: "Joined Rizal High" }))?.type).toBe("VIEW_ORGANIZATIONS");
    expect(mobileAlertAction(alert({ subject: "Ana Cruz", title: "Parent joined" }))?.type).toBe("VIEW_FAMILY");
    // Anything else: no button rather than "Manage plan"
    expect(mobileAlertAction(alert({ subject: "Something new", title: "Notice" }))).toBeNull();
  });

  it("opens the website request, not the child's history", () => {
    expect(mobileAlertAction(alert({ category: "PROTECTION", childId: "c1", resolveKey: "WEBREQ:r1" })))
      .toEqual({ type: "REVIEW_SITE_REQUEST", label: "Review request", childId: "c1", requestId: "r1" });
  });

  it("sends browser alerts to the browser screens", () => {
    expect(mobileAlertAction(alert({ category: "DEVICES", childId: "c1", resolveKey: "BROWSER_REVOKED:b1" }))).toMatchObject({ type: "VIEW_BROWSERS", childId: null });
    expect(mobileAlertAction(alert({ category: "PROTECTION", childId: "c1", resolveKey: "BROWSER_DRIFT:b1" }))).toMatchObject({ type: "VIEW_BROWSERS", childId: "c1" });
  });

  it("has no button once resolved", () => {
    expect(mobileAlertAction(alert({ subject: "Subscription", resolvedAt: new Date() }))).toBeNull();
  });
});

const now = Date.parse("2026-10-02T06:00:00Z");
const at = (minAgo: number) => new Date(now - minAgo * 60_000);
const device = (id: string, location: { sharing: boolean; lat?: number; placeLabel?: string; locatedAt?: Date } | null, protections: { key: string; status: string; reported: unknown }[] = []) => ({
  id, name: id, lastSeenAt: at(1), protections,
  location: location && {
    sharing: location.sharing, lat: location.lat ?? null, lng: location.lat ?? null, accuracyM: 20,
    placeLabel: location.placeLabel ?? null, locatedAt: location.locatedAt ?? null, updatedAt: location.locatedAt ?? at(1),
  },
});
const paid = { locationSharing: true };

describe("overviewLocation", () => {
  it("shows nothing on a plan without location sharing", () => {
    const l = overviewLocation([device("a", { sharing: true, lat: 1, placeLabel: "Home", locatedAt: at(2) })], { locationSharing: false }, now);
    expect(l).toMatchObject({ sharing: false, state: "plan_required", placeLabel: null, updatedAt: null });
  });

  it("uses the newest fix, not the first device", () => {
    const l = overviewLocation([
      device("old", { sharing: true, lat: 1, placeLabel: "School", locatedAt: at(120) }),
      device("new", { sharing: true, lat: 2, placeLabel: "Park", locatedAt: at(3) }),
    ], paid, now);
    expect(l).toMatchObject({ state: "located", placeLabel: "Park", label: "Sharing enabled" });
    expect(l.updatedAt).toEqual(at(3));
  });

  it("is waiting, not off, when the LOCATION report says sharing but no location arrived yet", () => {
    const l = overviewLocation([device("a", null, [{ key: "LOCATION", status: "PASS", reported: { key: "LOCATION", sharing: true } }])], paid, now);
    expect(l).toMatchObject({ sharing: true, state: "waiting", label: "Waiting for location" });
  });

  it("says sharing off and no devices", () => {
    expect(overviewLocation([device("a", { sharing: false })], paid, now)).toMatchObject({ sharing: false, state: "sharing_off", label: "Sharing off" });
    expect(overviewLocation([], paid, now)).toMatchObject({ state: "no_devices", label: "No devices yet" });
  });
});
