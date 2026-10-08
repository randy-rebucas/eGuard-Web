/**
 * Volume discounts on batches of sponsor codes (docs/organizations.md). No server imports, so the buy form
 * shows the same price the checkout charges.
 */

/** Largest tier first. A batch gets the discount of the highest tier its quantity reaches. */
export const BATCH_DISCOUNTS = [
  { minQuantity: 100, percent: 20 },
  { minQuantity: 50, percent: 15 },
  { minQuantity: 10, percent: 10 },
] as const;

/** "10% off 10 or more codes, 15% off 50 or more, and 20% off 100 or more", for the site's copy. */
export const discountSummary = () => [...BATCH_DISCOUNTS].reverse()
  .map((t, i) => `${t.percent}% off ${t.minQuantity} or more${i === 0 ? " codes" : ""}`)
  .join(", ").replace(/, ([^,]*)$/, ", and $1");

/** Percent off for a batch of this many codes (0 below the first tier). */
export const batchDiscount = (quantity: number) => BATCH_DISCOUNTS.find((t) => quantity >= t.minQuantity)?.percent ?? 0;

/**
 * Price of one code in a batch, in centavos: the full price less the batch's discount, rounded to whole
 * centavos so the checkout total is exactly this × quantity.
 */
export const discountedCodePrice = (fullPrice: number, quantity: number) => Math.round((fullPrice * (100 - batchDiscount(quantity))) / 100);
