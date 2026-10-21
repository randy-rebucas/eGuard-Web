import { describe, expect, it } from "vitest";
import {
  addDays, afterQuietHours, clock, clock12, daysSince, inQuietHours, localDay, localMinute, parseClock, previousMonth, slot, slotsBetween, weekOf, weekday,
} from "../parent-care/schedule";

const MANILA = "Asia/Manila";

describe("parent-care schedule", () => {
  it("turns a local slot into the right instant", () => {
    // 7:30 PM in Manila (UTC+8) is 11:30 UTC
    expect(slot("2026-10-21", 1170, MANILA).toISOString()).toBe("2026-10-21T11:30:00.000Z");
    expect(localMinute(new Date("2026-10-21T11:30:00Z"), MANILA)).toBe(1170);
    expect(localDay(new Date("2026-10-21T17:00:00Z"), MANILA)).toBe("2026-10-22");
  });

  it("keeps the local time across a daylight-saving change", () => {
    // New York leaves DST on Sunday 2026-11-01: 7:30 PM is UTC-4 the day before and UTC-5 that day
    expect(slot("2026-10-31", 1170, "America/New_York").toISOString()).toBe("2026-10-31T23:30:00.000Z");
    expect(slot("2026-11-01", 1170, "America/New_York").toISOString()).toBe("2026-11-02T00:30:00.000Z");
  });

  it("knows quiet hours that run over midnight, and none when start equals end", () => {
    expect(inQuietHours(22 * 60, 21 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(6 * 60 + 59, 21 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(7 * 60, 21 * 60, 7 * 60)).toBe(false);
    expect(inQuietHours(12 * 60, 13 * 60, 14 * 60)).toBe(false);
    expect(inQuietHours(13 * 60 + 30, 13 * 60, 14 * 60)).toBe(true);
    expect(inQuietHours(3 * 60, 0, 0)).toBe(false);
  });

  it("moves a time inside quiet hours to when they end", () => {
    // 11 PM Manila → 7 AM next day
    expect(afterQuietHours(new Date("2026-10-21T15:00:00Z"), MANILA, 1260, 420).toISOString()).toBe("2026-10-21T23:00:00.000Z");
    // 2 AM Manila → 7 AM the same day
    expect(afterQuietHours(new Date("2026-10-21T18:00:00Z"), MANILA, 1260, 420).toISOString()).toBe("2026-10-21T23:00:00.000Z");
    const noon = new Date("2026-10-21T04:00:00Z");
    expect(afterQuietHours(noon, MANILA, 1260, 420)).toBe(noon);
  });

  it("lists upcoming slots on the chosen days only", () => {
    // Wednesday 2026-10-21, 8 AM Manila; Mon/Wed/Fri at 7:30 PM over 3 days: today and Friday
    const s = slotsBetween(new Date("2026-10-21T00:00:00Z"), 3, MANILA, 1170, [1, 3, 5]);
    expect(s.map((x) => x.day)).toEqual(["2026-10-21", "2026-10-23"]);
    // Already past today's slot: not listed
    expect(slotsBetween(new Date("2026-10-21T12:00:00Z"), 1, MANILA, 1170, [3])).toEqual([]);
  });

  it("finds the local Monday, the previous month and weekdays", () => {
    expect(weekOf(new Date("2026-10-21T04:00:00Z"), MANILA)).toBe("2026-10-19");
    // Sunday evening is still the week that started Monday
    expect(weekOf(new Date("2026-10-25T12:00:00Z"), MANILA)).toBe("2026-10-19");
    expect(previousMonth(new Date("2026-01-01T02:00:00Z"), MANILA)).toBe("2025-12");
    expect(previousMonth(new Date("2026-10-01T02:00:00Z"), MANILA)).toBe("2026-09");
    expect(weekday("2026-10-21")).toBe(3);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("counts whole days of inactivity", () => {
    expect(daysSince(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-08T00:00:00Z"))).toBe(7);
    expect(daysSince(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-07T23:59:00Z"))).toBe(6);
  });

  it("parses and prints 24-hour times", () => {
    expect(parseClock("19:30")).toBe(1170);
    expect(parseClock("7:30")).toBeNull();
    expect(parseClock("24:00")).toBeNull();
    expect(clock(1170)).toBe("19:30");
    expect(clock12(1170)).toBe("7:30 PM");
    expect(clock12(0)).toBe("12:00 AM");
  });
});
