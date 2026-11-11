import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isBelowVersion } = await import("../child-app");

describe("isBelowVersion", () => {
  it("compares dotted versions numerically", () => {
    expect(isBelowVersion("1.2.9", "1.2.10")).toBe(true);
    expect(isBelowVersion("1.10.0", "1.9.9")).toBe(false);
    expect(isBelowVersion("1.2", "1.2.0")).toBe(false);
    expect(isBelowVersion("v1.1.0", "1.2.0")).toBe(true);
  });

  it("never flags what it can't read", () => {
    expect(isBelowVersion(null, "1.0.0")).toBe(false);
    expect(isBelowVersion("1.0.0", null)).toBe(false);
    expect(isBelowVersion("beta", "1.0.0")).toBe(false);
  });
});

/**
 * The console's privacy rule (docs/console.md §1), checked where every console read lives: no child activity,
 * location, photos, rule contents or alert text.
 */
describe("console queries keep to the privacy rule", () => {
  const src = readFileSync(join(__dirname, "..", "console-queries.ts"), "utf8");

  it("never reads activity, location or photo tables", () => {
    for (const model of ["deviceLocation", "locationVisit", "screenTimeDaily", "appUsageDaily", "browserEventDaily", "childPhoto", "childApp", "browserAccessRequest", "place"]) {
      expect(src, model).not.toMatch(new RegExp(`db\\.${model}\\b`));
    }
    for (const table of ["DeviceLocation", "LocationVisit", "ScreenTimeDaily", "AppUsageDaily", "BrowserEventDaily", "ChildPhoto", "BrowserAccessRequest"]) {
      expect(src, table).not.toContain(`"${table}"`);
    }
  });

  it("never selects alert text, rule contents, reported values or tokens", () => {
    for (const field of ["title", "body", "config", "reported", "desired", "previous", "blockedDomains", "allowedDomains", "temporaryAllows", "pushToken", "tokenHash", "totpSecret", "passwordHash"]) {
      // `pushToken: true` is read once only to answer yes/no (deviceDiagnostics), and dropped before returning
      const hits = src.match(new RegExp(`\\b${field}: true`, "g")) ?? [];
      expect(hits.length, field).toBe(field === "pushToken" ? 1 : 0);
    }
  });
});
