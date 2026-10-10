import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/errors";

/** The web's place actions: the id check, what reaches the service, and what the parent is told. */

vi.mock("server-only", () => ({}));
const nav = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: nav.revalidatePath }));
const user = { id: "u1", familyId: "fam1", name: "Ana", role: "FAMILY_ADMIN" };
const auth = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
const svc = vi.hoisted(() => ({ createPlace: vi.fn(), updatePlace: vi.fn(), deletePlace: vi.fn() }));
vi.mock("@/lib/places", () => svc);

const actions = await import("./places");

const home = { name: "Home", lat: 14.5995, lng: 120.9842, radiusM: 150, notifyArrive: true, notifyLeave: false };

beforeEach(() => {
  vi.resetAllMocks();
  auth.requireUser.mockResolvedValue(user);
});

describe("createPlace", () => {
  it("creates for the signed-in parent, refreshes every page, and returns the saved name", async () => {
    svc.createPlace.mockResolvedValue({ id: "p1", name: "Home" });
    expect(await actions.createPlace(home)).toEqual({ name: "Home" });
    expect(svc.createPlace).toHaveBeenCalledWith(user, home);
    expect(nav.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("shows the service's reason, such as a plan without location", async () => {
    svc.createPlace.mockRejectedValue(new ServiceError(403, "Places are part of Family Plus.", "plan_required"));
    expect(await actions.createPlace(home)).toEqual({ error: "Places are part of Family Plus.", code: "plan_required" });
    expect(nav.revalidatePath).not.toHaveBeenCalled();
  });
  it("needs a signed-in parent before anything else", async () => {
    auth.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(actions.createPlace(home)).rejects.toThrow("NEXT_REDIRECT");
    expect(svc.createPlace).not.toHaveBeenCalled();
  });
  it("lets an unexpected failure through instead of hiding it", async () => {
    svc.createPlace.mockRejectedValue(new Error("database down"));
    await expect(actions.createPlace(home)).rejects.toThrow("database down");
  });
});

describe("updatePlace", () => {
  it("refuses an id that can't be one, without a lookup", async () => {
    expect(await actions.updatePlace("", { name: "Home" })).toEqual({ error: "Place not found." });
    expect(await actions.updatePlace("x".repeat(65), { name: "Home" })).toEqual({ error: "Place not found." });
    expect(svc.updatePlace).not.toHaveBeenCalled();
  });
  it("passes only the changes on and returns the saved name", async () => {
    svc.updatePlace.mockResolvedValue({ id: "p1", name: "Grandma's" });
    expect(await actions.updatePlace("p1", { radiusM: 300, notifyLeave: true })).toEqual({ name: "Grandma's" });
    expect(svc.updatePlace).toHaveBeenCalledWith(user, "p1", { radiusM: 300, notifyLeave: true });
    expect(nav.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("says when the place is already gone (another parent or tab)", async () => {
    svc.updatePlace.mockRejectedValue(new ServiceError(404, "Place not found.", "not_found"));
    expect(await actions.updatePlace("p1", { name: "Home" })).toEqual({ error: "Place not found.", code: "not_found" });
    expect(nav.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deletePlace", () => {
  it("refuses an id that can't be one, without a lookup", async () => {
    expect(await actions.deletePlace("x".repeat(65))).toEqual({ error: "Place not found." });
    expect(svc.deletePlace).not.toHaveBeenCalled();
  });
  it("deletes for the signed-in parent and refreshes every page", async () => {
    svc.deletePlace.mockResolvedValue(undefined);
    expect(await actions.deletePlace("p1")).toEqual({});
    expect(svc.deletePlace).toHaveBeenCalledWith(user, "p1");
    expect(nav.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
  it("shows the service's refusal instead of throwing", async () => {
    svc.deletePlace.mockRejectedValue(new ServiceError(404, "Place not found.", "not_found"));
    expect(await actions.deletePlace("p1")).toEqual({ error: "Place not found.", code: "not_found" });
  });
});
