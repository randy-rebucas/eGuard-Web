import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { FLAG_KEY_RE, flagBucket, flagOn } = await import("../feature-flags");

describe("feature flags", () => {
  const flag = (enabled: boolean, rollout: number) => ({ key: "ios_launch", enabled, rollout });

  it("is off when missing or disabled, whatever the rollout", () => {
    expect(flagOn(null, "f1")).toBe(false);
    expect(flagOn(flag(false, 100), "f1")).toBe(false);
  });

  it("is on for everyone at 100% and nobody at 0%", () => {
    expect(flagOn(flag(true, 100))).toBe(true);
    expect(flagOn(flag(true, 100), "f1")).toBe(true);
    expect(flagOn(flag(true, 0), "f1")).toBe(false);
  });

  it("a partial rollout needs a family, and keeps each family in the same bucket", () => {
    expect(flagOn(flag(true, 50))).toBe(false);
    const ids = Array.from({ length: 1000 }, (_, i) => `family-${i}`);
    const on = ids.filter((id) => flagOn(flag(true, 30), id));
    // Roughly the share asked for
    expect(on.length).toBeGreaterThan(220);
    expect(on.length).toBeLessThan(380);
    // Growing the rollout only adds families
    expect(on.every((id) => flagOn(flag(true, 60), id))).toBe(true);
    expect(flagBucket("ios_launch", "family-1")).toBe(flagBucket("ios_launch", "family-1"));
  });

  it("accepts only simple lowercase keys", () => {
    expect(FLAG_KEY_RE.test("ios_launch")).toBe(true);
    expect(FLAG_KEY_RE.test("IOS")).toBe(false);
    expect(FLAG_KEY_RE.test("a")).toBe(false);
    expect(FLAG_KEY_RE.test("has space")).toBe(false);
  });
});
