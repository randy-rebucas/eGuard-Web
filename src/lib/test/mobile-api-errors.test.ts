import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth", () => ({ userForToken: async () => null }));
vi.mock("../request-body", () => ({ readText: async () => "" }));

const { apiError, open } = await import("../mobile-api");
const { ServiceError } = await import("../errors");

const req = new Request("http://localhost/api/mobile/v1/auth/login", { method: "POST" });
const ctx = { params: Promise.resolve({}) };

describe("mobile API errors", () => {
  it("a rate-limited request (429) says when to retry", async () => {
    const route = open(async () => { throw new ServiceError(429, "Too many attempts.", "rate_limited", { retryAfter: 41.2 }); });
    const res = await route(req, ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(await res.json()).toEqual({ error: "Too many attempts.", code: "rate_limited" });
  });

  it("other errors carry no Retry-After", async () => {
    const res = await open(async () => { throw new ServiceError(404, "Child not found.", "not_found"); })(req, ctx);
    expect(res.status).toBe(404);
    expect(res.headers.get("Retry-After")).toBeNull();
    expect(apiError(400, "x").headers.get("Retry-After")).toBeNull();
  });
});
