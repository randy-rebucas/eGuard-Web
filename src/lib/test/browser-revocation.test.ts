import { generateKeyPairSync, verify } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../audit", () => ({ audit: vi.fn() }));
vi.mock("../billing", () => ({ refreshPurchases: vi.fn() }));
vi.mock("../device-slots", () => ({ withDeviceSlot: vi.fn() }));

const inst = {
  updateMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
};
const alertCreate = vi.fn();
vi.mock("../db", () => ({ db: { browserInstallation: inst, alert: { create: alertCreate } } }));

const { signRevocation, canonicalJson } = await import("../browser-policy");
const { refreshBrowserTokens } = await import("../browser-service");

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const verifies = (p: { revocation: object; signature: string }) =>
  verify("sha256", Buffer.from(canonicalJson(p.revocation)), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(p.signature, "base64"));

describe("signRevocation", () => {
  it("is null without a signing key, so browsers stay connected rather than trust an unsigned answer", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.BROWSER_POLICY_SIGNING_KEY;
    expect(signRevocation("bi_1")).toBeNull();
  });

  it("signs what the extension checks: the type and this installation, over the canonical JSON", () => {
    process.env.BROWSER_POLICY_SIGNING_KEY = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
    const proof = signRevocation("bi_1")!;
    expect(proof.revocation).toMatchObject({ type: "eguard.browser.revoked", installationId: "bi_1" });
    expect(verifies(proof)).toBe(true);
    expect(verifies({ ...proof, revocation: { ...proof.revocation, installationId: "bi_2" } })).toBe(false);
  });
});

describe("refreshBrowserTokens: a late previous token", () => {
  const rotatedAt = new Date(Date.now() - 30 * 60_000); // well past the 2-minute window
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BROWSER_POLICY_SIGNING_KEY = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
    inst.updateMany.mockResolvedValueOnce({ count: 0 }); // not the current token
  });

  it("is a lost reply when nothing used the tokens that replaced it: fresh tokens, no disconnection", async () => {
    inst.findFirst.mockResolvedValueOnce({ id: "bi_1", refreshRotatedAt: rotatedAt, lastSeenAt: rotatedAt, child: { name: "Mia" } });
    inst.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(refreshBrowserTokens("bi_1", "r".repeat(40))).resolves.toMatchObject({ accessToken: expect.any(String) });
    expect(inst.update).not.toHaveBeenCalled();
    expect(alertCreate).not.toHaveBeenCalled();
    // The new tokens count as unused until something uses them
    const data = inst.updateMany.mock.calls[1]![0].data;
    expect(data.refreshRotatedAt).toEqual(data.lastSeenAt);
  });

  it("is a copied token when the replacement tokens were used: disconnected, with a signed revocation", async () => {
    inst.findFirst.mockResolvedValueOnce({
      id: "bi_1", familyId: "f1", childId: "c1", browser: "Chrome", deviceLabel: "MacBook",
      refreshRotatedAt: rotatedAt, lastSeenAt: new Date(rotatedAt.getTime() + 60_000), child: { name: "Mia" },
    });
    const err = await refreshBrowserTokens("bi_1", "r".repeat(40)).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 401, code: "token_reused" });
    const proof = (err as { extra: { revocation: { revocation: object; signature: string } } }).extra.revocation;
    expect(proof.revocation).toMatchObject({ installationId: "bi_1" });
    expect(verifies(proof)).toBe(true);
    expect(inst.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }));
  });

  it("a removed browser (no row) gets installation_revoked with a signed revocation; a live one with a wrong token doesn't", async () => {
    inst.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const removed = await refreshBrowserTokens("bi_9", "r".repeat(40)).catch((e: unknown) => e);
    expect(removed).toMatchObject({ code: "installation_revoked", extra: { revocation: { revocation: { installationId: "bi_9" } } } });

    inst.updateMany.mockResolvedValueOnce({ count: 0 });
    inst.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "bi_1" });
    const wrong = await refreshBrowserTokens("bi_1", "r".repeat(40)).catch((e: unknown) => e);
    expect(wrong).toMatchObject({ code: "unauthorized" });
    expect((wrong as { extra?: unknown }).extra).toBeUndefined();
  });
});
