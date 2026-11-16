import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../auth", () => ({ sha256: (s: string) => s }));

const { TOO_LARGE, readJson, tooMany } = await import("../device-auth");

const post = (body: string) => new Request("http://localhost/api/device/v1/report", { method: "POST", body });

describe("device API responses", () => {
  it("a 429 says when to retry", () => {
    const res = tooMany("Too many reports.", 42.3);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("43");
    expect(tooMany("x", 0).headers.get("Retry-After")).toBe("1");
  });

  it("an oversized body is TOO_LARGE (413), malformed JSON is null (400)", async () => {
    expect(await readJson(post("x".repeat(64 * 1024 + 1)))).toBe(TOO_LARGE);
    expect(await readJson(post("{"))).toBeNull();
    expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 });
  });
});
