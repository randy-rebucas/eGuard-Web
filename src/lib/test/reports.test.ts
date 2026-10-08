import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));

const { BASIC_RANGE_DAYS, MAX_RANGE_DAYS, resolveRange } = await import("../reports");

const MANILA = "Asia/Manila";

describe("resolveRange", () => {
  // Wednesday 2026-10-07, 7 PM in Manila
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-07T11:00:00Z")); });
  afterEach(() => vi.useRealTimers());

  it("keeps a custom week on the basic limit, so the weekly summary's link opens on every plan", () => {
    expect(resolveRange("custom", MANILA, "2026-09-27", "2026-10-03", BASIC_RANGE_DAYS)).toEqual({ from: "2026-09-27", to: "2026-10-03" });
  });

  it("keeps the last week of a longer custom range on the basic limit", () => {
    expect(resolveRange("custom", MANILA, "2026-09-01", "2026-09-30", BASIC_RANGE_DAYS)).toEqual({ from: "2026-09-24", to: "2026-09-30" });
    expect(resolveRange("custom", MANILA, "2026-09-01", "2026-09-30", MAX_RANGE_DAYS)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("ends a custom range today at the latest, and falls back to the last 7 days for dates it can't use", () => {
    expect(resolveRange("custom", MANILA, "2026-10-05", "2026-12-01")).toEqual({ from: "2026-10-05", to: "2026-10-07" });
    expect(resolveRange("custom", MANILA, "2026-02-30", "2026-10-01")).toEqual({ from: "2026-10-01", to: "2026-10-07" });
    expect(resolveRange("custom", MANILA, "2026-10-06", "2026-10-01")).toEqual({ from: "2026-10-01", to: "2026-10-07" });
  });
});
