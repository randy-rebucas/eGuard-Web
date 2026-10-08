import { beforeEach, describe, expect, it, vi } from "vitest";

/** The console's ticket action: host check, and one logged change when two staff close a ticket at once. */

vi.mock("server-only", () => ({}));
const host = vi.hoisted(() => ({ value: "console.localhost:3000" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: host.value }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const db = vi.hoisted(() => ({ supportTicket: { findUnique: vi.fn(), updateMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
const staff = vi.hoisted(() => ({ requireStaff: vi.fn(async () => ({ id: "s1" })), logStaff: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ ...staff, authenticateStaff: vi.fn(), endStaffSession: vi.fn(), startStaffSession: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ clientIpFrom: () => null }));

const { setTicketStatus } = await import("./console");
const form = (status: string) => { const f = new FormData(); f.set("id", "t1"); f.set("status", status); return f; };

describe("setTicketStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    host.value = "console.localhost:3000";
    db.supportTicket.findUnique.mockResolvedValue({ status: "OPEN" });
  });

  it("changes the ticket only from the state it read, and logs the change", async () => {
    db.supportTicket.updateMany.mockResolvedValue({ count: 1 });
    await setTicketStatus(form("CLOSED"));
    expect(db.supportTicket.updateMany).toHaveBeenCalledWith({ where: { id: "t1", status: "OPEN" }, data: { status: "CLOSED" } });
    expect(staff.logStaff).toHaveBeenCalledWith("s1", "ticket.status", "ticket:t1", "OPEN → CLOSED");
  });

  it("logs nothing when another request changed it first", async () => {
    db.supportTicket.updateMany.mockResolvedValue({ count: 0 });
    await setTicketStatus(form("CLOSED"));
    expect(staff.logStaff).not.toHaveBeenCalled();
  });

  it("refuses a status staff can't set, and any request off the console host", async () => {
    await expect(setTicketStatus(form("DELETED"))).rejects.toMatchObject({ status: 400 });
    host.value = "www.eguard.family";
    await expect(setTicketStatus(form("CLOSED"))).rejects.toMatchObject({ status: 404 });
    expect(staff.requireStaff).toHaveBeenCalledTimes(1);
    expect(db.supportTicket.updateMany).not.toHaveBeenCalled();
  });
});
