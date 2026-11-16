import { describe, expect, it } from "vitest";
import { isSelfApproved, screenTimeAuthorizationOf, screenTimeAuthorizationUpdate } from "../screen-time-authorization";

describe("screenTimeAuthorization", () => {
  const ios = (accounts: unknown) => ({ platform: "IOS" as const, accounts: accounts as never });

  it("is self-approved only for an iPhone that last reported individual", () => {
    expect(isSelfApproved(ios({ screenTimeAuthorization: "individual" }))).toBe(true);
    expect(isSelfApproved(ios({ screenTimeAuthorization: "child" }))).toBe(false);
    expect(isSelfApproved(ios(null))).toBe(false);
    // Computers keep their Windows accounts (an array) in the same column
    expect(isSelfApproved({ platform: "WINDOWS", accounts: [{ name: "Mia", enforced: true }] })).toBe(false);
    expect(isSelfApproved({ platform: "ANDROID", accounts: { screenTimeAuthorization: "individual" } })).toBe(false);
    expect(screenTimeAuthorizationOf(ios({ screenTimeAuthorization: "other" }))).toBeNull();
  });

  it("writes only on an iPhone, and only when it changes", () => {
    expect(screenTimeAuthorizationUpdate(ios(null), "individual")).toEqual({ screenTimeAuthorization: "individual" });
    expect(screenTimeAuthorizationUpdate(ios({ screenTimeAuthorization: "individual" }), "individual")).toBeUndefined();
    expect(screenTimeAuthorizationUpdate(ios({ screenTimeAuthorization: "individual" }), "child")).toEqual({ screenTimeAuthorization: "child" });
    expect(screenTimeAuthorizationUpdate(ios(null), undefined)).toBeUndefined();
    expect(screenTimeAuthorizationUpdate({ platform: "WINDOWS", accounts: null }, "individual")).toBeUndefined();
  });
});
