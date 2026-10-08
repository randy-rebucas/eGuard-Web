import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/errors";
import { profileConfigs } from "@/lib/profiles";

/** The web's child actions: the form rules, what reaches the service, and what the parent is told. */

vi.mock("server-only", () => ({}));
const nav = vi.hoisted(() => ({ redirect: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: nav.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: nav.revalidatePath }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
const db = vi.hoisted(() => ({ child: { findFirst: vi.fn(), updateMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
const user = { id: "u1", familyId: "fam1", name: "Ana", role: "FAMILY_ADMIN" };
vi.mock("@/lib/auth", () => ({
  requireUser: async () => user, requireAdmin: async () => user, clearSessionCookie: vi.fn(),
  PASSWORD_TOO_LONG: "", passwordTooLong: () => false,
}));
const svc = vi.hoisted(() => ({
  createChild: vi.fn(), updateChild: vi.fn(), assertNameFree: vi.fn(), deleteChild: vi.fn(), setAppApproval: vi.fn(), setAppLimit: vi.fn(), setAppCategory: vi.fn(), setCategoryLimit: vi.fn(), audit: vi.fn(),
  createPairingCode: vi.fn(), pairingCodeStatus: vi.fn(), renameDevice: vi.fn(), removeDevice: vi.fn(), setPrimaryDevice: vi.fn(), moveDevice: vi.fn(),
}));
// The real ChildSchema and rules; the database work is stubbed
vi.mock("@/lib/family-service", async (orig) => ({ ...(await orig<typeof import("@/lib/family-service")>()), ...svc }));
const browserSvc = vi.hoisted(() => ({ removeBrowser: vi.fn() }));
vi.mock("@/lib/browser-service", () => browserSvc);
for (const m of ["billing", "web-billing", "organizations", "audit", "email-verification", "rate-limit", "device-slots", "invitations", "browser-policy", "browser-access"]) {
  vi.doMock(`@/lib/${m}`, () => ({}));
}
vi.mock("@/lib/plan-access", () => ({ LOCATION_UPGRADE: "", familyEntitlements: vi.fn(), planWith: vi.fn() }));

const actions = await import("./family");

const year = new Date().getFullYear();
const form = (fields: Record<string, string | number>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, String(v));
  return f;
};
const settings = (age: number) => profileConfigs("PROTECTED", age).map((config) => ({ key: config.key, config }));
const mia = (age: number, extra = {}) => ({ id: "c1", familyId: "fam1", name: "Mia", birthYear: year - age, policies: settings(age), ...extra });

beforeEach(() => {
  // reset, not clear: a rejection set up for one test mustn't carry into the next
  vi.resetAllMocks();
  db.child.updateMany.mockResolvedValue({ count: 1 });
});

describe("createChild", () => {
  it("checks the form before anything is created", async () => {
    expect(await actions.createChild(undefined, form({ name: "  ", birthYear: year - 9 }))).toEqual({ error: "Enter a name." });
    expect(await actions.createChild(undefined, form({ name: "Mia", birthYear: year - 19 }))).toEqual({ error: "eGuard is for children under 18." });
    expect(svc.createChild).not.toHaveBeenCalled();
  });
  it("creates with the chosen profile and goes to the child's page", async () => {
    svc.createChild.mockResolvedValue({ id: "c9" });
    await actions.createChild(undefined, form({ name: "Mia", birthYear: year - 9, profile: "BALANCED" }));
    expect(svc.createChild).toHaveBeenCalledWith(user, { name: "Mia", birthYear: year - 9, profile: "BALANCED" });
    expect(nav.redirect).toHaveBeenCalledWith("/children/c9?added=1");
  });
  it("ignores a profile that doesn't exist (the service picks Protected)", async () => {
    svc.createChild.mockResolvedValue({ id: "c9" });
    await actions.createChild(undefined, form({ name: "Mia", birthYear: year - 9, profile: "ADMIN" }));
    expect(svc.createChild.mock.calls[0][1].profile).toBeUndefined();
  });
  it("shows the service's reason, such as a full plan", async () => {
    svc.createChild.mockRejectedValue(new ServiceError(409, "Free covers 1 child.", "plan_limit"));
    expect(await actions.createChild(undefined, form({ name: "Leo", birthYear: year - 9 }))).toEqual({ error: "Free covers 1 child." });
    expect(nav.redirect).not.toHaveBeenCalled();
  });
});

describe("updateChild", () => {
  /** The Profile form: what it showed (base) and what the parent left in it */
  const profile = (name: string, birthYear: number, base = mia(9)) => form({ name, birthYear, baseName: base.name, baseBirthYear: base.birthYear });
  const saved = (before: ReturnType<typeof mia>, after: { name: string; birthYear: number }) => svc.updateChild.mockResolvedValue({ before, after });

  it("refuses an id that can't be one", async () => {
    expect(await actions.updateChild("x".repeat(65), undefined, profile("Mia", year - 9))).toEqual({ error: "Child not found." });
    expect(svc.updateChild).not.toHaveBeenCalled();
  });
  it("sends only what the parent changed, so another parent's rename since isn't undone", async () => {
    saved(mia(9), { name: "Mimi", birthYear: year - 10 });
    await actions.updateChild("c1", undefined, profile("Mia", year - 10));
    expect(svc.updateChild).toHaveBeenCalledWith(user, "c1", { birthYear: year - 10 });
  });
  it("saves nothing when nothing changed", async () => {
    expect(await actions.updateChild("c1", undefined, profile("Mia ", year - 9))).toEqual({ ok: "Saved." });
    expect(svc.updateChild).not.toHaveBeenCalled();
  });
  it("shows the service's refusals", async () => {
    svc.updateChild.mockRejectedValue(new ServiceError(409, "You already have a child named Leo.", "conflict"));
    expect(await actions.updateChild("c1", undefined, profile("Leo", year - 9))).toEqual({ error: "You already have a child named Leo." });
    svc.updateChild.mockRejectedValue(new ServiceError(404, "Child not found.", "not_found"));
    expect(await actions.updateChild("c1", undefined, profile("Leo", year - 9))).toEqual({ error: "Child not found." });
  });
  it("shows a bad birth year as the form's message", async () => {
    const real = await vi.importActual<typeof import("@/lib/family-service")>("@/lib/family-service");
    svc.updateChild.mockImplementation(async () => { real.ChildSchema.parse({ name: "Mia", birthYear: year - 19 }); });
    expect(await actions.updateChild("c1", undefined, profile("Mia", year - 19))).toEqual({ error: "eGuard is for children under 18." });
  });
  it("says just Saved for a rename, or a new age with the same recommendations", async () => {
    saved(mia(19), { name: "Mia R.", birthYear: year - 19 });
    expect(await actions.updateChild("c1", undefined, profile("Mia R.", year - 19, mia(19)))).toEqual({ ok: "Saved." });
    saved(mia(9), { name: "Mia", birthYear: year - 10 });
    expect(await actions.updateChild("c1", undefined, profile("Mia", year - 10))).toEqual({ ok: "Saved." });
  });
  it("names what to review when the new age changes eGuard's recommendations", async () => {
    saved(mia(12), { name: "Mia", birthYear: year - 13 });
    const r = await actions.updateChild("c1", undefined, profile("Mia", year - 13, mia(12)));
    expect(r?.ok).toBe("Saved. For a 13-year-old, eGuard recommends different Screen Time, Bedtime, App Restrictions and Content Restrictions settings than Mia has now. Review them on the Protection tab.");
  });
});

describe("deleteChildData", () => {
  it("refuses an id that can't be one", async () => {
    expect(await actions.deleteChildData("x".repeat(65), undefined, form({}))).toEqual({ error: "Child not found." });
    expect(svc.deleteChild).not.toHaveBeenCalled();
  });
  it("passes the confirmation on and goes back to the list", async () => {
    svc.deleteChild.mockResolvedValue({});
    await actions.deleteChildData("c1", undefined, form({ password: "pw" }));
    expect(svc.deleteChild).toHaveBeenCalledWith(user, "c1", { password: "pw", phrase: "" });
    expect(nav.redirect).toHaveBeenCalledWith("/children");
  });
  it("shows a wrong password instead of deleting", async () => {
    svc.deleteChild.mockRejectedValue(new ServiceError(403, "That password isn't right.", "forbidden"));
    expect(await actions.deleteChildData("c1", undefined, form({ password: "nope" }))).toEqual({ error: "That password isn't right." });
    expect(nav.redirect).not.toHaveBeenCalled();
  });
});

describe("app actions", () => {
  it("only accepts real access settings", async () => {
    expect(await actions.setAppApproval("a1", "SUPERUSER" as never)).toEqual({ error: "Choose a valid setting." });
    svc.setAppApproval.mockResolvedValue({ childId: "c1" });
    expect(await actions.setAppApproval("a1", "BLOCKED")).toEqual({});
    expect(svc.setAppApproval).toHaveBeenCalledWith(user, "a1", "BLOCKED", "web");
  });
  it("caps a daily limit at 24 hours", async () => {
    expect(await actions.setAppLimit("a1", 2000)).toEqual({ error: "A daily limit can be up to 24 hours." });
    svc.setAppLimit.mockResolvedValue({ childId: "c1" });
    expect(await actions.setAppLimit("a1", null)).toEqual({});
  });
  it("takes a real category, or null for eGuard's guess", async () => {
    expect(await actions.setAppCategory("a1", "CASINO" as never)).toEqual({ error: "Choose a category." });
    svc.setAppCategory.mockResolvedValue({ childId: "c1" });
    expect(await actions.setAppCategory("a1", null)).toEqual({});
    expect(svc.setAppCategory).toHaveBeenCalledWith(user, "a1", null, "web");
  });
  it("checks a category limit like an app limit, and refreshes the child's page", async () => {
    expect(await actions.setCategoryLimit("c1", "GAMES", 2000)).toEqual({ error: "A daily limit can be up to 24 hours." });
    svc.setCategoryLimit.mockResolvedValue({ category: "GAMES", dailyLimitMinutes: 60 });
    expect(await actions.setCategoryLimit("c1", "GAMES", 60)).toEqual({});
    expect(svc.setCategoryLimit).toHaveBeenCalledWith(user, "c1", "GAMES", 60, "web");
    expect(nav.revalidatePath).toHaveBeenCalledWith("/children/c1");
  });
});

/** The web's device actions: input checks, what reaches the service, and the "already gone" paths. */
describe("device actions", () => {
  const gone = (what: string) => new ServiceError(404, `${what} not found.`, "not_found");

  it("pairing code: asks for a child and a computer name, and returns time left rather than a clock time", async () => {
    expect(await actions.createPairingCode("")).toEqual({ error: "Choose which child the device belongs to." });
    expect(await actions.createPairingCode("c1", { kind: "BROWSER", deviceLabel: " " })).toEqual({ error: "Enter the computer's name, like Mia's MacBook." });
    expect(svc.createPairingCode).not.toHaveBeenCalled();
    svc.createPairingCode.mockResolvedValue({ code: "ABCD2345", expiresAt: new Date(), expiresInSeconds: 900, childName: "Mia", kind: "DEVICE" });
    expect(await actions.createPairingCode("c1")).toEqual({ code: "ABCD2345", expiresInSeconds: 900, childName: "Mia" });
    expect(svc.createPairingCode).toHaveBeenCalledWith(user, "c1", { kind: "DEVICE" });
  });
  it("pairing code: shows the service's reason, such as a full plan", async () => {
    svc.createPairingCode.mockRejectedValue(new ServiceError(409, "Free covers 2 devices.", "plan_limit"));
    expect(await actions.createPairingCode("c1")).toEqual({ error: "Free covers 2 devices." });
  });
  it("pairing status: a code that can't be one reads as replaced, without a lookup", async () => {
    expect(await actions.pairingStatus("x".repeat(65))).toEqual({ status: "replaced" });
    expect(svc.pairingCodeStatus).not.toHaveBeenCalled();
    svc.pairingCodeStatus.mockResolvedValue({ status: "paired", device: { id: "d1", name: "Phone" } });
    expect(await actions.pairingStatus("ABCD2345")).toMatchObject({ status: "paired" });
    expect(nav.revalidatePath).toHaveBeenCalled();
  });
  it("rename: checks the name, and says when the device is gone", async () => {
    expect(await actions.renameDevice("d1", undefined, form({ name: "  " }))).toEqual({ error: "Enter a device name." });
    expect(await actions.renameDevice("d1", undefined, form({ name: "x".repeat(61) }))).toEqual({ error: "Use up to 60 characters." });
    expect(svc.renameDevice).not.toHaveBeenCalled();
    expect(await actions.renameDevice("d1", undefined, form({ name: " Mia's phone " }))).toEqual({ ok: "Saved." });
    expect(svc.renameDevice).toHaveBeenCalledWith(user, "d1", "Mia's phone");
    svc.renameDevice.mockRejectedValue(gone("Device"));
    expect(await actions.renameDevice("d1", undefined, form({ name: "Tab" }))).toEqual({ error: "Device not found." });
  });
  it("remove: passes the confirmation and the history choice, then goes to Devices", async () => {
    await actions.removeDevice("d1", undefined, form({ password: "pw", deleteHistory: "on" }));
    expect(svc.removeDevice).toHaveBeenCalledWith(user, "d1", { password: "pw", phrase: "" }, { deleteHistory: true });
    expect(nav.redirect).toHaveBeenCalledWith("/devices");
  });
  it("remove: already removed (another parent or tab) says so instead of failing", async () => {
    svc.removeDevice.mockRejectedValue(gone("Device"));
    expect(await actions.removeDevice("d1", undefined, form({ password: "pw" }))).toEqual({ error: "This device was already removed.", fields: { gone: "1" } });
    expect(await actions.removeDevice("x".repeat(65), undefined, form({}))).toMatchObject({ fields: { gone: "1" } });
    expect(nav.redirect).not.toHaveBeenCalled();
  });
  it("remove: a wrong password is shown, not thrown", async () => {
    svc.removeDevice.mockRejectedValue(new ServiceError(403, "That password isn't right.", "wrong_password"));
    expect(await actions.removeDevice("d1", undefined, form({ password: "nope" }))).toEqual({ error: "That password isn't right." });
  });
  it("remove browser: already removed says so", async () => {
    browserSvc.removeBrowser.mockRejectedValue(gone("Browser"));
    expect(await actions.removeBrowser("b1", undefined, form({ password: "pw" }))).toEqual({ error: "This browser was already removed.", fields: { gone: "1" } });
    browserSvc.removeBrowser.mockResolvedValue({});
    expect(await actions.removeBrowser("b1", undefined, form({ password: "pw" }))).toEqual({ ok: "Browser removed." });
  });
  it("make primary: returns the service's error as a result", async () => {
    svc.setPrimaryDevice.mockResolvedValue({});
    expect(await actions.setPrimaryDevice("d2")).toEqual({});
    expect(svc.setPrimaryDevice).toHaveBeenCalledWith(user, "d2");
    svc.setPrimaryDevice.mockRejectedValue(gone("Device"));
    expect(await actions.setPrimaryDevice("d2")).toMatchObject({ error: "Device not found." });
  });
  it("move: needs a child, passes the confirmation, and says what happens next", async () => {
    expect(await actions.moveDevice("d1", undefined, form({ password: "pw" }))).toEqual({ error: "Choose who the device belongs to now." });
    expect(svc.moveDevice).not.toHaveBeenCalled();
    svc.moveDevice.mockResolvedValue({ name: "Galaxy A54", child: { name: "Leo" } });
    expect(await actions.moveDevice("d1", undefined, form({ childId: "c2", password: "pw" }))).toEqual({ ok: "Moved to Leo. Galaxy A54 gets Leo's protections on its next sync." });
    expect(svc.moveDevice).toHaveBeenCalledWith(user, "d1", "c2", { password: "pw", phrase: "" });
  });
  it("move: tells a removed device from a removed child", async () => {
    svc.moveDevice.mockRejectedValue(gone("Device"));
    expect(await actions.moveDevice("d1", undefined, form({ childId: "c2", password: "pw" }))).toEqual({ error: "This device was removed.", fields: { gone: "1" } });
    svc.moveDevice.mockRejectedValue(gone("Child"));
    expect(await actions.moveDevice("d1", undefined, form({ childId: "c2", password: "pw" }))).toEqual({ error: "That child was removed. Reload the page and choose again." });
    svc.moveDevice.mockRejectedValue(new ServiceError(400, "Galaxy A54 already belongs to Mia.", "invalid"));
    expect(await actions.moveDevice("d1", undefined, form({ childId: "c1", password: "pw" }))).toEqual({ error: "Galaxy A54 already belongs to Mia." });
  });
});
