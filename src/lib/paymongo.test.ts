import { describe, expect, it } from "vitest";
import { isFullyRefunded, type Payment } from "./paymongo";

const refund = (id: string, amount: number, status = "succeeded") => ({ id, type: "refund", attributes: { amount, status } });
const payment = (amount: number, refunds: ReturnType<typeof refund>[] = []): Payment => ({ amount, status: "paid", refunds });

describe("isFullyRefunded", () => {
  it("only when succeeded refunds add up to the payment", () => {
    expect(isFullyRefunded(payment(24900, [refund("r1", 24900)]))).toBe(true);
    expect(isFullyRefunded(payment(24900, [refund("r1", 5000)]))).toBe(false);
    expect(isFullyRefunded(payment(24900, [refund("r1", 5000), refund("r2", 19900)]))).toBe(true);
    // A refund that's still pending or failed doesn't count
    expect(isFullyRefunded(payment(24900, [refund("r1", 24900, "pending")]))).toBe(false);
  });
  it("counts the webhook's refund once, listed on the payment yet or not", () => {
    expect(isFullyRefunded(payment(24900), { id: "r1", amount: 24900 })).toBe(true);
    expect(isFullyRefunded(payment(24900, [refund("r1", 24900)]), { id: "r1", amount: 24900 })).toBe(true);
    expect(isFullyRefunded(payment(24900, [refund("r1", 12450)]), { id: "r1", amount: 12450 })).toBe(false);
  });
});
