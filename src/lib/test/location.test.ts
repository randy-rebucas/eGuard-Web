import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ db: {} }));

import { FRESH_MS, childLocation, durationLabel, locationPolicy, placeFor, stayed, visitSpan, waitingText } from "../location";

const now = Date.parse("2026-10-04T10:00:00Z");
const min = 60_000;

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
