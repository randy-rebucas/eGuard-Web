import { describe, expect, it } from "vitest";
import { ageLabel } from "../format";

describe("ageLabel", () => {
  it("says the age with the right plural", () => {
    expect(ageLabel(1)).toBe("1 year old");
    expect(ageLabel(8)).toBe("8 years old");
  });
  it("never says 0 years old for a child born this year", () => {
    expect(ageLabel(0)).toBe("Under 1 year old");
  });
});
