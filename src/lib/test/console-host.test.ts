import { describe, expect, it } from "vitest";
import { isConsoleHost } from "../console-host";

const prod = { NODE_ENV: "production" };
const dev = { NODE_ENV: "development" };

describe("isConsoleHost", () => {
  it("is the production console, with or without a port, in any case", () => {
    expect(isConsoleHost("console.eguard.family", prod)).toBe(true);
    expect(isConsoleHost("CONSOLE.eguard.family:443", prod)).toBe(true);
  });

  it("isn't the parent site or a look-alike host", () => {
    for (const h of ["www.eguard.family", "eguard.family", "console.eguard.family.evil.com", "evilconsole.eguard.family", "x.console.eguard.family"]) {
      expect(isConsoleHost(h, prod)).toBe(false);
    }
    expect(isConsoleHost(null, prod)).toBe(false);
    expect(isConsoleHost("", prod)).toBe(false);
  });

  it("accepts console.localhost in development only", () => {
    expect(isConsoleHost("console.localhost:3000", dev)).toBe(true);
    expect(isConsoleHost("console.localhost:3000", prod)).toBe(false);
    expect(isConsoleHost("localhost:3000", dev)).toBe(false);
  });

  it("accepts CONSOLE_HOST when it's set", () => {
    expect(isConsoleHost("console-preview.eguard.family", { ...prod, CONSOLE_HOST: "console-preview.eguard.family" })).toBe(true);
    expect(isConsoleHost("console-preview.eguard.family", prod)).toBe(false);
  });
});
