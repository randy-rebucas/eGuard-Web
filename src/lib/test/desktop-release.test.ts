import { describe, expect, it, vi } from "vitest";
import { ServiceError } from "../errors";

vi.spyOn(console, "error").mockImplementation(() => {});

const { desktopRelease } = await import("../desktop-release");

const file = (name: string, url = `https://dl.eguard.family/0.2.0/${name}`) => ({ name, size: 10, sha256: "a".repeat(64), url });
const release = (url?: (name: string) => string) =>
  JSON.stringify({ version: "0.2.0", files: ["eguard-service.exe", "eguard-agent.exe", "eguard-guard.exe"].map((n) => file(n, url?.(n))) });

describe("desktopRelease", () => {
  it("is null when unset, and parses a well-formed release", () => {
    expect(desktopRelease("")).toBeNull();
    expect(desktopRelease(undefined)).toBeNull();
    expect(desktopRelease(release())?.files).toHaveLength(3);
  });

  it("refuses a plain-http download link (503, so the deployment mistake shows)", () => {
    expect(() => desktopRelease(release((n) => `http://dl.eguard.family/0.2.0/${n}`))).toThrow(ServiceError);
  });

  it("refuses malformed JSON", () => {
    expect(() => desktopRelease("{")).toThrow(ServiceError);
  });
});
