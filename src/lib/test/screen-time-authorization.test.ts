import { describe, expect, it } from "vitest";
import { isSelfApproved, screenTimeAuthorizationOf, screenTimeAuthorizationUpdate } from "../screen-time-authorization";

describe("screenTimeAuthorization", () => {
  const ios = (screenTimeAuthorization: "CHILD" | "INDIVIDUAL" | null) => ({ platform: "IOS" as const, screenTimeAuthorization });

  it("is self-approved only for an iPhone that last reported individual", () => {
    expect(isSelfApproved(ios("INDIVIDUAL"))).toBe(true);
    expect(isSelfApproved(ios("CHILD"))).toBe(false);
    expect(isSelfApproved(ios(null))).toBe(false);
    expect(isSelfApproved({ platform: "IOS" })).toBe(false);
    // Only iPhones report it: a stray value elsewhere is ignored
    expect(isSelfApproved({ platform: "ANDROID", screenTimeAuthorization: "INDIVIDUAL" })).toBe(false);
    expect(screenTimeAuthorizationOf(ios("CHILD"))).toBe("child");
  });

  it("writes only on an iPhone, and only when it changes", () => {
    expect(screenTimeAuthorizationUpdate(ios(null), "individual")).toBe("INDIVIDUAL");
    expect(screenTimeAuthorizationUpdate(ios("INDIVIDUAL"), "individual")).toBeUndefined();
    expect(screenTimeAuthorizationUpdate(ios("INDIVIDUAL"), "child")).toBe("CHILD");
    expect(screenTimeAuthorizationUpdate(ios(null), undefined)).toBeUndefined();
    expect(screenTimeAuthorizationUpdate({ platform: "WINDOWS", screenTimeAuthorization: null }, "individual")).toBeUndefined();
  });
});
