import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./engine", () => ({ ensureOfflineAlerts: async () => {} }));
vi.mock("./simulator", () => ({ touchSimulated: async () => {} }));
vi.mock("./family-service", () => ({ requestedApps: async () => new Set() }));

const { overviewLocation } = await import("./mobile-views");

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
