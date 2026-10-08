import { describe, expect, it } from "vitest";
import { batchDiscount, discountSummary, discountedCodePrice } from "../batch-discount";

describe("batch discounts", () => {
  it("gives the highest tier the quantity reaches", () => {
    expect([1, 9, 10, 49, 50, 99, 100, 200].map(batchDiscount)).toEqual([0, 0, 10, 10, 15, 15, 20, 20]);
  });

  it("charges full price below the first tier", () => {
    expect(discountedCodePrice(14900 * 3, 9)).toBe(44700);
  });

  it("takes the discount off each code, in whole centavos", () => {
    expect(discountedCodePrice(14900 * 12, 50)).toBe(151980);
    expect(discountedCodePrice(24900, 100)).toBe(19920);
    // 333 × 0.9 = 299.7 rounds to 300
    expect(discountedCodePrice(333, 10)).toBe(300);
  });

  it("describes the tiers for the pricing page, smallest first", () => {
    expect(discountSummary()).toBe("10% off 10 or more codes, 15% off 50 or more, and 20% off 100 or more");
  });
});
