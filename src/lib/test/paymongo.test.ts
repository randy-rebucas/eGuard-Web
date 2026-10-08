import { describe, expect, it, vi } from "vitest";
import { ServiceError } from "../errors";
import { getPayment, getSubscription as getPaymongoSubscription, isFullyRefunded, type Payment } from "../paymongo";
import { getSubscription } from "../google-play";

describe("unreachable payment providers", () => {
  const down = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  const cfg = { secretKey: "sk_test_x", publicKey: "pk_test_x", livemode: false, webhookSecret: null };

  it("PayMongo: a network failure is a 502 the page can show, not a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getPayment(cfg, "pay_1", down)).rejects.toMatchObject({ status: 502, code: "payment_unavailable" });
    await expect(getPaymongoSubscription(cfg, "sub_1", down)).rejects.toBeInstanceOf(ServiceError);
  });

  it("Google Play: a network failure is a 502 too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const account = { client_email: "x@y.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
    await expect(getSubscription({ packageName: "app.eguard", account }, "tok", down)).rejects.toMatchObject({ status: 502, code: "store_unavailable" });
  });
});

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
