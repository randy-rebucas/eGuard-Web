import { describe, expect, it } from "vitest";
import { ageLabel, canonicalTimeZone } from "../format";

describe("canonicalTimeZone", () => {
  it("keeps a well-formed zone as sent, including modern names Intl would rename", () => {
    expect(canonicalTimeZone("Asia/Manila")).toBe("Asia/Manila");
    expect(canonicalTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(canonicalTimeZone("America/Argentina/Buenos_Aires")).toBe("America/Argentina/Buenos_Aires");
    expect(canonicalTimeZone("America/Port-au-Prince")).toBe("America/Port-au-Prince");
    expect(canonicalTimeZone("UTC")).toBe("UTC");
  });
  it("fixes the casing of a real zone", () => {
    expect(canonicalTimeZone("asia/manila")).toBe("Asia/Manila");
    expect(canonicalTimeZone("utc")).toBe("UTC");
  });
  it("refuses offsets and names that aren't zones", () => {
    expect(canonicalTimeZone("+05:00")).toBeNull();
    expect(canonicalTimeZone("Mars/Olympus")).toBeNull();
    expect(canonicalTimeZone("")).toBeNull();
  });
});

describe("ageLabel", () => {
  it("says the age with the right plural", () => {
    expect(ageLabel(1)).toBe("1 year old");
    expect(ageLabel(8)).toBe("8 years old");
  });
  it("never says 0 years old for a child born this year", () => {
    expect(ageLabel(0)).toBe("Under 1 year old");
  });
});
