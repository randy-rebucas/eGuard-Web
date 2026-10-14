import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));

import { browserStatus } from "../browser-status";
import { HEALTH_CHECK_IDS, HealthReport } from "../browser-health";

const seen = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600e3);

describe("browserStatus (web card and GET /browsers)", () => {
  it("says what the extension last reported", () => {
    expect(browserStatus({ lastSeenAt: seen(1), revokedAt: null, protectionState: "ACTION_REQUIRED" })).toEqual([
      "tone-crit", "Action required", expect.stringContaining("Sites may not be blocked"),
    ]);
  });
  it("lets disconnected and a day's silence override the last report", () => {
    expect(browserStatus({ lastSeenAt: seen(1), revokedAt: new Date(), protectionState: "PROTECTED" })[1]).toBe("Disconnected for security");
    expect(browserStatus({ lastSeenAt: seen(30), revokedAt: null, protectionState: "PROTECTED" })[1]).toBe("Not seen for a day");
  });
  it("waits for the first report, and reads an unknown state as plain Connected", () => {
    expect(browserStatus({ lastSeenAt: seen(0), revokedAt: null, protectionState: null })).toEqual(["tone-accent", "Connected", "Waiting for its first health check."]);
    expect(browserStatus({ lastSeenAt: seen(0), revokedAt: null, protectionState: "SOMETHING_NEW" })[1]).toBe("Connected");
  });
});

describe("HealthReport (POST /browser/v1/health)", () => {
  const base = { state: "PROTECTED", policyVersion: 3, checks: [{ id: "site_access", status: "ACTION_REQUIRED" }] };
  it("knows site_access, so it's scored and alerted on", () => {
    expect(HEALTH_CHECK_IDS).toContain("site_access");
  });
  it("takes the versions as optional fields, so older extensions still report", () => {
    expect(HealthReport.parse(base).extensionVersion).toBeUndefined();
    expect(HealthReport.parse({ ...base, extensionVersion: " 0.2.0 ", browserVersion: null })).toMatchObject({ extensionVersion: "0.2.0", browserVersion: null });
    expect(HealthReport.safeParse({ ...base, extensionVersion: "" }).success).toBe(false);
    expect(HealthReport.safeParse({ ...base, extensionVersion: "x".repeat(21) }).success).toBe(false);
  });
});
