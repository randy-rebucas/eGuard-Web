import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ db: {} }));

import { FRESH_MS, LEAVE_MARGIN_M, childLocation, durationLabel, isDayKey, locationPolicy, placeFor, placeMove, shiftDay, stayed, thinRoute, visitSpan, waitingText } from "../location";

const now = Date.parse("2026-10-04T10:00:00Z");
const min = 60_000;

describe("placeMove", () => {
  const home = { id: "home", lat: 14.6, lng: 121.0, radiusM: 150 };
  const school = { id: "school", lat: 14.61, lng: 121.0, radiusM: 150 }; // ~1.1 km north
  const m = (metres: number) => 14.6 + metres / 111_195; // metres north of home

  it("arrives at a place from nowhere, and leaves it for nowhere", () => {
    expect(placeMove([home], null, { lat: m(20), lng: 121.0 })).toMatchObject({ place: home, arrived: home, left: null });
    expect(placeMove([home], "home", { lat: m(500), lng: 121.0 })).toMatchObject({ place: null, arrived: null, left: home });
  });
  it("staying put is neither", () => {
    expect(placeMove([home], "home", { lat: m(30), lng: 121.0 })).toMatchObject({ place: home, arrived: null, left: null });
  });
  it("wobbling just past the edge is still there; clearly past it is leaving", () => {
    expect(placeMove([home], "home", { lat: m(150 + LEAVE_MARGIN_M - 5), lng: 121.0 })).toMatchObject({ place: home, left: null });
    expect(placeMove([home], "home", { lat: m(150 + LEAVE_MARGIN_M + 20), lng: 121.0 }).left).toBe(home);
    // A rough fix gets its accuracy as the margin
    expect(placeMove([home], "home", { lat: m(260), lng: 121.0, accuracyM: 150 }).left).toBeNull();
  });
  it("the margin only holds a device at the place it was at, never pulls it into one", () => {
    expect(placeMove([home], null, { lat: m(170), lng: 121.0 })).toMatchObject({ place: null, arrived: null });
  });
  it("going from one place straight to another is a leave and an arrive", () => {
    expect(placeMove([home, school], "home", { lat: 14.61, lng: 121.0 })).toMatchObject({ place: school, arrived: school, left: home });
  });
  it("a removed place isn't left", () => {
    expect(placeMove([school], "home", { lat: m(500), lng: 121.0 })).toMatchObject({ left: null, arrived: null });
  });
});

describe("day keys", () => {
  it("accepts only real dates", () => {
    expect(isDayKey("2026-10-05")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-1-5")).toBe(false);
    expect(isDayKey(undefined)).toBe(false);
  });
  it("shifts across months and years", () => {
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("thinRoute", () => {
  // A stay every 50th visit, passing-by fixes a minute apart in between (a long drive)
  const day = Array.from({ length: 1000 }, (_, i) => {
    const at = new Date(now + i * min);
    return { i, arrivedAt: at, lastSeenAt: new Date(at.getTime() + (i % 50 === 0 ? 30 * min : 0)) };
  });

  it("leaves a day under the cap alone", () => {
    expect(thinRoute(day.slice(0, 300), 300)).toHaveLength(300);
  });
  it("keeps every stay, fits the cap, keeps order and the end of the route", () => {
    const kept = thinRoute(day, 300);
    expect(kept).toHaveLength(300);
    expect(kept.filter(stayed)).toHaveLength(20);
    expect(kept.map((v) => v.i)).toEqual([...kept.map((v) => v.i)].sort((a, b) => a - b));
    expect(kept.at(-1)!.i).toBe(999);
    // Spread out, not the first 280 passing fixes
    expect(kept.filter((v) => v.i > 900).length).toBeGreaterThan(20);
  });
  it("keeps only stays when they alone fill the cap", () => {
    expect(thinRoute(day, 10).every(stayed)).toBe(true);
  });
});

describe("placeFor", () => {
  const home = { id: "home", lat: 14.6, lng: 121.0, radiusM: 150 };
  const school = { id: "school", lat: 14.6015, lng: 121.0, radiusM: 250 }; // about 167 m north of home

  it("finds the place a point falls inside", () => {
    expect(placeFor([home], { lat: 14.6005, lng: 121.0 })?.id).toBe("home"); // ~56 m
    expect(placeFor([home], { lat: 14.61, lng: 121.0 })).toBeNull(); // ~1.1 km
  });
  it("picks the nearest when places overlap", () => {
    expect(placeFor([school, home], { lat: 14.6002, lng: 121.0 })?.id).toBe("home");
    expect(placeFor([home, school], { lat: 14.6013, lng: 121.0 })?.id).toBe("school");
  });
});

describe("stays and spans", () => {
  const v = (fromMin: number, toMin: number) => ({ arrivedAt: new Date(now + fromMin * min), lastSeenAt: new Date(now + toMin * min) });

  it("counts a visit as a stay once it spans a sync", () => {
    expect(stayed(v(0, 0))).toBe(false);
    expect(stayed(v(0, 3))).toBe(false);
    expect(stayed(v(0, 5))).toBe(true);
  });
  it("labels durations", () => {
    expect(durationLabel(45 * min)).toBe("45 min");
    expect(durationLabel(390 * min)).toBe("6 h 30 min");
    expect(durationLabel(120 * min)).toBe("2 h");
    expect(durationLabel((51 * 60) * min)).toBe("2 days 3 h");
  });
  it("shows one time when passing by, and the next day across midnight", () => {
    const tz = "Asia/Manila"; // UTC+8: now is 6:00 PM
    expect(visitSpan(v(0, 0), tz)).toBe("6:00 PM");
    expect(visitSpan(v(0, 90), tz)).toBe("6:00 PM – 7:30 PM · 1 h 30 min");
    expect(visitSpan(v(300, 780), tz)).toBe("11:00 PM – 7:00 AM next day · 8 h");
  });
});

describe("childLocation and the parent's setting", () => {
  const dev = (id: string, o: { location?: { sharing: boolean; lat: number | null; locatedAt?: number } | null; reported?: boolean } = {}) => ({
    id, name: id, lastSeenAt: new Date(now),
    location: o.location ? { sharing: o.location.sharing, lat: o.location.lat, lng: o.location.lat == null ? null : 121, accuracyM: 20, placeLabel: null, locatedAt: o.location.locatedAt ? new Date(o.location.locatedAt) : null, updatedAt: new Date(now) } : null,
    protections: o.reported === undefined ? [] : [{ key: "LOCATION", status: "PASS", reported: { key: "LOCATION", sharing: o.reported } }],
  });

  it("waits for a device that hasn't reported, instead of calling sharing off", () => {
    const l = childLocation([dev("Pixel")], now, true);
    expect(l).toMatchObject({ state: "waiting", sharing: false, unreported: { id: "Pixel" } });
    expect(waitingText(l)).toBe("Waiting for Pixel to report whether location sharing is on.");
    expect(childLocation([dev("Pixel")], now).state).toBe("waiting");
  });
  it("is off when the parent's setting is off, or a device said so", () => {
    expect(childLocation([dev("Pixel")], now, false)).toMatchObject({ state: "sharing_off", unreported: null });
    expect(childLocation([dev("Pixel", { reported: false }), dev("iPad")], now, true)).toMatchObject({ state: "sharing_off", offDevice: { id: "Pixel" }, unreported: null });
  });
  it("waits for a first fix once a device shares", () => {
    const l = childLocation([dev("Pixel", { reported: true })], now, true);
    expect(l).toMatchObject({ state: "waiting", sharing: true, unreported: null });
    expect(waitingText(l)).toBe("Sharing is on. Waiting for the first location from the device.");
  });
  it("stays live for a resting device between 15-minute fixes", () => {
    const at = (m: number) => childLocation([dev("Pixel", { location: { sharing: true, lat: 14.6, locatedAt: now - m * min } })], now);
    expect(at(16).fresh).toBe(true);
    expect(at(FRESH_MS / min + 1).fresh).toBe(false);
  });
  it("reads the parent's setting from the child's policies", () => {
    expect(locationPolicy([{ key: "LOCATION", config: { key: "LOCATION", sharing: true } }])).toBe(true);
    expect(locationPolicy([{ key: "LOCATION", config: { key: "LOCATION", sharing: false } }])).toBe(false);
    expect(locationPolicy([{ key: "BEDTIME", config: {} }])).toBeUndefined();
  });
});
