import { describe, expect, it } from "vitest";
import { bedtimeActive, isSchoolNight } from "../protections";
import { minChildAppVersion } from "../child-app";

const SUN = 0, THU = 4, FRI = 5, SAT = 6;
const at = (weekday: number, hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return { weekday, minutes: h * 60 + m }; };
const bed = (days: "EVERY_DAY" | "SCHOOL_NIGHTS", start = "21:30", end = "06:00") => ({ key: "BEDTIME" as const, enabled: true, start, end, days });

describe("school nights", () => {
  it("are Sunday to Thursday", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(isSchoolNight)).toEqual([true, true, true, true, true, false, false]);
  });
});

describe("bedtimeActive", () => {
  it("covers a window that crosses midnight, as part of the night it started", () => {
    const b = bed("EVERY_DAY");
    expect(bedtimeActive(b, at(FRI, "21:30"))).toBe(true);
    expect(bedtimeActive(b, at(SAT, "05:59"))).toBe(true);
    expect(bedtimeActive(b, at(SAT, "06:00"))).toBe(false);
    expect(bedtimeActive(b, at(SAT, "21:29"))).toBe(false);
  });

  it("on school nights, Thursday's bedtime runs into Friday morning, and Friday and Saturday nights are free", () => {
    const b = bed("SCHOOL_NIGHTS");
    expect(bedtimeActive(b, at(THU, "22:00"))).toBe(true);
    expect(bedtimeActive(b, at(FRI, "01:00"))).toBe(true);
    expect(bedtimeActive(b, at(FRI, "22:00"))).toBe(false);
    expect(bedtimeActive(b, at(SAT, "01:00"))).toBe(false);
    expect(bedtimeActive(b, at(SAT, "22:00"))).toBe(false);
    expect(bedtimeActive(b, at(SUN, "01:00"))).toBe(false);
    expect(bedtimeActive(b, at(SUN, "22:00"))).toBe(true);
  });

  it("handles a window within one day, and off", () => {
    expect(bedtimeActive(bed("SCHOOL_NIGHTS", "00:30", "06:00"), at(FRI, "01:00"))).toBe(true);
    expect(bedtimeActive(bed("SCHOOL_NIGHTS", "00:30", "06:00"), at(SAT, "01:00"))).toBe(false);
    expect(bedtimeActive({ ...bed("EVERY_DAY"), enabled: false }, at(THU, "23:00"))).toBe(false);
  });
});

describe("minChildAppVersion", () => {
  it("is null when unset, so the app never shows an update screen by accident", () => {
    expect(minChildAppVersion("ANDROID", undefined)).toBeNull();
    expect(minChildAppVersion("ANDROID", " ")).toBeNull();
  });
  it("takes one version for both platforms, or one per platform", () => {
    expect(minChildAppVersion("IOS", "1.2.0")).toBe("1.2.0");
    expect(minChildAppVersion("ANDROID", "android:1.3.0, ios:1.1.0")).toBe("1.3.0");
    expect(minChildAppVersion("IOS", "android:1.3.0, ios:1.1.0")).toBe("1.1.0");
    expect(minChildAppVersion("IOS", "android:1.3.0")).toBeNull();
  });
});
