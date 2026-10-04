import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/errors";

/** The web's setup-flow and check actions: what they accept from the client, what reaches the services, and what the flow is told. */

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  child: { findMany: vi.fn() },
  childPolicy: { findUnique: vi.fn() },
  device: { findMany: vi.fn(), findFirst: vi.fn() },
  configRequest: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
const user = { id: "u1", familyId: "fam1", name: "Ana", role: "FAMILY_ADMIN" };
vi.mock("@/lib/auth", () => ({ requireUser: async () => user }));
const engine = vi.hoisted(() => ({ startCheckRun: vi.fn(), syncChildLimits: vi.fn() }));
vi.mock("@/lib/engine", () => engine);
vi.mock("@/lib/child-photo", () => ({ childPhotoSrc: () => null }));
const svc = vi.hoisted(() => ({ requestConfigs: vi.fn(), confirmGuided: vi.fn(), cancelBatch: vi.fn(), childFor: vi.fn() }));
// The real ConfigSchema; the database work is stubbed
vi.mock("@/lib/config-service", async (orig) => ({ ...(await orig<typeof import("@/lib/config-service")>()), ...svc }));

const actions = await import("./config");

const year = new Date().getFullYear();
const mia = { id: "c1", familyId: "fam1", name: "Mia", hue: 200, birthYear: year - 12 };
const bedtime = { key: "BEDTIME", enabled: true, start: "21:00", end: "06:30", days: "EVERY_DAY" };
const now = new Date("2026-10-04T09:00:00Z");

beforeEach(() => {
  vi.resetAllMocks();
  svc.childFor.mockResolvedValue(mia);
  db.childPolicy.findUnique.mockResolvedValue(null);
  db.device.findMany.mockResolvedValue([]);
  db.configRequest.findFirst.mockResolvedValue(null);
});

describe("getFlowContext", () => {
  it("refuses a protection or child id the client made up, before reading anything", async () => {
    expect(await actions.getFlowContext("c1", "NOPE" as never)).toMatchObject({ code: "not_found", error: "Protection not found." });
    expect(await actions.getFlowContext("c1", "constructor" as never)).toMatchObject({ code: "not_found" });
    expect(await actions.getFlowContext({ not: "an id" } as never, "BEDTIME")).toMatchObject({ error: "Child not found." });
    expect(svc.childFor).not.toHaveBeenCalled();
  });

  it("describes each device's report, saying 'Not reported' before its first one", async () => {
    db.childPolicy.findUnique.mockResolvedValue({ config: bedtime });
    db.device.findMany.mockResolvedValue([
      { id: "d1", name: "Galaxy A54", platform: "ANDROID", protections: [{ key: "BEDTIME", status: "PASS", reported: bedtime, lastVerifiedAt: now }] },
      { id: "d2", name: "iPad", platform: "IOS", protections: [] },
    ]);
    db.configRequest.findFirst.mockResolvedValue({ batchId: "b7" });
    const r = await actions.getFlowContext("c1", "BEDTIME");
    expect(r).toMatchObject({
      child: { id: "c1", name: "Mia", age: 12 }, policyLabel: "9:00 PM – 6:30 AM", openBatch: "b7",
      devices: [
        { id: "d1", capability: "AVAILABLE", currentLabel: "9:00 PM – 6:30 AM", status: "PASS", lastVerified: now.toISOString() },
        { id: "d2", platformLabel: "iOS", currentLabel: "Not reported", status: "NOT_CONFIGURED", lastVerified: null },
      ],
    });
  });

  it("starts from the age default when the child has no setting yet, and gives guided steps on iOS", async () => {
    db.device.findMany.mockResolvedValue([{ id: "d2", name: "iPad", platform: "IOS", protections: [] }]);
    const r = await actions.getFlowContext("c1", "WEB");
    expect(r).toMatchObject({ policy: { key: "WEB", mode: "FILTER" }, policyLabel: "Not configured" });
    if ("error" in r) throw new Error(r.error);
    expect(r.devices[0]).toMatchObject({ capability: "GUIDED" });
    expect(r.devices[0].guide?.length).toBeGreaterThan(0);
  });

  it("says when the child isn't in the family", async () => {
    svc.childFor.mockRejectedValue(new ServiceError(404, "Child not found.", "not_found"));
    expect(await actions.getFlowContext("other", "BEDTIME")).toMatchObject({ code: "not_found" });
  });
});

describe("submitConfig", () => {
  it("checks the config with the server's rules before anything is sent", async () => {
    expect(await actions.submitConfig("c1", { ...bedtime, end: "21:00" })).toEqual({ error: "Bedtime needs different start and end times." });
    expect(await actions.submitConfig("c1", { key: "SCREEN_TIME", dailyMinutes: 5, weekendMinutes: 60 })).toHaveProperty("error");
    expect(await actions.submitConfig("c1", { key: "ADMIN" })).toHaveProperty("error");
    expect(svc.requestConfigs).not.toHaveBeenCalled();
  });

  it("sends one protection for the child, strictly, as the parent on the web", async () => {
    svc.requestConfigs.mockResolvedValue({ batchId: "b1", requested: ["BEDTIME"], saved: [] });
    expect(await actions.submitConfig("c1", bedtime)).toEqual({ batchId: "b1" });
    expect(svc.requestConfigs).toHaveBeenCalledWith(user, "c1", [bedtime], "web", { strict: true });
  });

  it("returns no batch when the child has no device yet, so the flow says it's saved", async () => {
    svc.requestConfigs.mockResolvedValue({ batchId: null, requested: [], saved: ["BEDTIME"] });
    expect(await actions.submitConfig("c1", bedtime)).toEqual({ batchId: null });
  });

  it("fills in the optional web filter count", async () => {
    svc.requestConfigs.mockResolvedValue({ batchId: "b1", requested: ["WEB"], saved: [] });
    await actions.submitConfig("c1", { key: "WEB", mode: "ALLOWLIST" });
    expect(svc.requestConfigs.mock.calls[0][2]).toEqual([{ key: "WEB", mode: "ALLOWLIST", blockedSites: 0 }]);
  });

  it("passes on the service's reason, such as no device supporting it", async () => {
    svc.requestConfigs.mockRejectedValue(new ServiceError(409, "Notifications isn't supported on Mia's devices.", "unsupported"));
    expect(await actions.submitConfig("c1", { key: "NOTIFICATIONS", quietDuringBedtime: true })).toEqual({ error: "Notifications isn't supported on Mia's devices.", code: "unsupported" });
  });
});

describe("confirmGuided and cancelBatch", () => {
  it("act on the parent's own family only", async () => {
    expect(await actions.confirmGuided("b1")).toEqual({});
    expect(svc.confirmGuided).toHaveBeenCalledWith("fam1", "b1");
    expect(await actions.cancelBatch("b1")).toEqual({});
    expect(svc.cancelBatch).toHaveBeenCalledWith("fam1", "b1");
  });
  it("refuse a batch id that isn't a string", async () => {
    expect(await actions.confirmGuided({ in: ["b1"] } as never)).toHaveProperty("error");
    expect(await actions.cancelBatch("" as never)).toHaveProperty("error");
    expect(svc.confirmGuided).not.toHaveBeenCalled();
    expect(svc.cancelBatch).not.toHaveBeenCalled();
  });
});

describe("startCheck", () => {
  it("checks every device, for this parent, and audits it", async () => {
    engine.startCheckRun.mockResolvedValue({ id: "run1" });
    expect(await actions.startCheck()).toEqual({ runId: "run1" });
    expect(engine.startCheckRun).toHaveBeenCalledWith("fam1", "u1", undefined);
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: { familyId: "fam1", actor: "Ana", action: "check.started", detail: "all devices" } });
  });

  it("checks one device only when it's in the family", async () => {
    engine.startCheckRun.mockResolvedValue({ id: "run2" });
    db.device.findFirst.mockResolvedValue({ id: "d1" });
    expect(await actions.startCheck("d1")).toEqual({ runId: "run2" });
    expect(db.device.findFirst).toHaveBeenCalledWith({ where: { id: "d1", familyId: "fam1" } });
    expect(engine.startCheckRun).toHaveBeenCalledWith("fam1", "u1", ["d1"]);

    db.device.findFirst.mockResolvedValue(null);
    expect(await actions.startCheck("theirs")).toMatchObject({ code: "not_found", error: "Device not found." });
    expect(await actions.startCheck({ id: "d1" } as never)).toMatchObject({ code: "not_found" });
    expect(engine.startCheckRun).toHaveBeenCalledTimes(1);
  });

  it("passes on a refusal, such as too many checks", async () => {
    engine.startCheckRun.mockRejectedValue(new ServiceError(429, "You've run several checks. Wait a few minutes; devices keep reporting on their own.", "rate_limited"));
    expect(await actions.startCheck()).toMatchObject({ code: "rate_limited" });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
