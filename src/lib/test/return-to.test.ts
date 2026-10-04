import { describe, expect, it } from "vitest";
import { loginPath, safeNext } from "../return-to";

describe("safeNext", () => {
  it("keeps paths on this site, with their query", () => {
    expect(safeNext("/children/abc?tab=apps")).toBe("/children/abc?tab=apps");
    expect(safeNext("/settings/subscription")).toBe("/settings/subscription");
  });
  it("rejects anything a browser would treat as another site", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "evil.example", "/\t/evil.example", "\n/x"]) {
      expect(safeNext(bad), bad).toBeNull();
    }
  });
  it("leaves percent-encoding alone: it stays part of the path", () => {
    expect(safeNext("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });
  it("rejects sign-in pages, which would loop", () => {
    expect(safeNext("/login?next=/x")).toBeNull();
    expect(safeNext("/reset-password?token=t")).toBeNull();
  });
  it("rejects non-strings and very long values", () => {
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(["/a"])).toBeNull();
    expect(safeNext(`/${"a".repeat(600)}`)).toBeNull();
  });
});

describe("loginPath", () => {
  it("only carries a destination worth returning to", () => {
    expect(loginPath("/children/abc?tab=apps")).toBe("/login?next=%2Fchildren%2Fabc%3Ftab%3Dapps");
    expect(loginPath("/dashboard")).toBe("/login");
    expect(loginPath(null)).toBe("/login");
  });
});
