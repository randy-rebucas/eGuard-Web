import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../browser-policy", () => ({ signPolicy: () => ({ signature: "sig", keyId: "k1" }) }));

const { REMOVAL_CODE_WINDOW_MS, newRemovalSecret, removalCode, removalWaits, signUninstall } = await import("../device-removal");

describe("offline removal codes", () => {
  const secret = newRemovalSecret();
  const t = 1_800_000_000_000;

  it("are 8 letters from the pairing alphabet, the same within a window", () => {
    const a = removalCode(secret, "d1", t);
    expect(a.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const start = Math.floor(t / REMOVAL_CODE_WINDOW_MS) * REMOVAL_CODE_WINDOW_MS;
    expect(removalCode(secret, "d1", start).code).toBe(a.code);
    expect(removalCode(secret, "d1", start + REMOVAL_CODE_WINDOW_MS - 1).code).toBe(a.code);
    // The agent also takes the window before, so a code shown just before a window ends still works for one more
    expect(a.expiresAt.getTime()).toBe(start + 2 * REMOVAL_CODE_WINDOW_MS);
  });

  it("change with the window, the device and the secret", () => {
    const a = removalCode(secret, "d1", t).code;
    expect(removalCode(secret, "d1", t + REMOVAL_CODE_WINDOW_MS).code).not.toBe(a);
    expect(removalCode(secret, "d2", t).code).not.toBe(a);
    expect(removalCode(newRemovalSecret(), "d1", t).code).not.toBe(a);
  });

  it("match the published test vector (docs/desktop-agent-spec.md), which the desktop agent's tests use too", () => {
    const fixed = Buffer.alloc(32, 7).toString("base64url");
    expect(removalCode(fixed, "dev_123", 0).code).toMatchInlineSnapshot(`"XEM54CNL"`);
  });
});

describe("removal", () => {
  it("waits only for computers", () => {
    expect(removalWaits({ kind: "COMPUTER" })).toBe(true);
    expect(removalWaits({ kind: "PHONE" })).toBe(false);
    expect(removalWaits({ kind: "TABLET" })).toBe(false);
  });

  it("the uninstall command names the device, so it can't pass as a policy or as another computer's", () => {
    const s = signUninstall("d1", new Date("2026-10-23T00:00:00Z"))!;
    expect(s.command).toMatchObject({ type: "eguard.device.uninstall", deviceId: "d1", requestedAt: "2026-10-23T00:00:00.000Z" });
    expect(s.keyId).toBe("k1");
  });
});
