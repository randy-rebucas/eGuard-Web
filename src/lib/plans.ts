/** Plans, what each includes, and the products that sell them. The family's current limit lives on Family. */
export type PlanFeature = { key: string; label: string; included: boolean };

export type Plan = {
  id: string;
  name: string;
  deviceLimit: number;
  /** Google Play subscription product id; null for the plan every family starts on */
  googlePlayProductId: string | null;
  features: Omit<PlanFeature, "label">[];
};

export const BASE_PLAN = "eGuard Plus";

export const PLANS: Plan[] = [
  {
    id: "PLUS", name: BASE_PLAN, deviceLimit: 8, googlePlayProductId: null,
    features: [
      { key: "children", included: true },
      { key: "devices", included: true },
      { key: "health_checks", included: true },
      { key: "alerts", included: true },
      { key: "reports", included: true },
      { key: "priority_support", included: false },
    ],
  },
  {
    id: "FAMILY", name: "eGuard Family", deviceLimit: 15, googlePlayProductId: "eguard_family",
    features: [
      { key: "children", included: true },
      { key: "devices", included: true },
      { key: "health_checks", included: true },
      { key: "alerts", included: true },
      { key: "reports", included: true },
      { key: "priority_support", included: true },
    ],
  },
];

const LABELS: Record<string, (deviceLimit: number) => string> = {
  children: () => "Unlimited children",
  devices: (n) => `Up to ${n} devices`,
  health_checks: () => "Configuration health checks",
  alerts: () => "Protection alerts",
  reports: () => "Advanced reports",
  priority_support: () => "Priority support",
};

export type Interval = "month" | "year";

/**
 * What the web sells through PayMongo. Auto-renew charges a card or Maya every period (PayMongo
 * Subscriptions); a pass is paid once with any method (GCash, QR Ph, …) and doesn't renew.
 * Prices come from env (PRICE_FAMILY_MONTHLY / PRICE_FAMILY_YEARLY), see webPrice().
 */
export type WebProduct = { id: string; plan: string; interval: Interval; autoRenew: boolean };

export const WEB_PRODUCTS: WebProduct[] = [
  { id: "family_monthly", plan: "eGuard Family", interval: "month", autoRenew: true },
  { id: "family_yearly", plan: "eGuard Family", interval: "year", autoRenew: true },
  { id: "family_pass_month", plan: "eGuard Family", interval: "month", autoRenew: false },
  { id: "family_pass_year", plan: "eGuard Family", interval: "year", autoRenew: false },
];

export const webProduct = (id: string) => WEB_PRODUCTS.find((p) => p.id === id) ?? null;
export const webProductFor = (interval: Interval, autoRenew: boolean) => WEB_PRODUCTS.find((p) => p.interval === interval && p.autoRenew === autoRenew)!;

/** Price in centavos. Configurable so it can change without a release; the defaults are placeholders. */
export function webPrice(interval: Interval, env: Record<string, string | undefined> = process.env) {
  const raw = interval === "month" ? env.PRICE_FAMILY_MONTHLY : env.PRICE_FAMILY_YEARLY;
  const pesos = Number(raw?.trim() || (interval === "month" ? 199 : 1990));
  if (!Number.isFinite(pesos) || pesos < 1) throw new Error(`Invalid price for ${interval}: ${raw}`);
  return Math.round(pesos * 100);
}

export const planByName = (name: string) => PLANS.find((p) => p.name === name) ?? PLANS[0];
export const planByGoogleProduct = (productId: string) => PLANS.find((p) => p.googlePlayProductId === productId) ?? null;
/** The plan a store product grants (Google Play or web). */
export function planByProduct(productId: string) {
  const web = webProduct(productId);
  return web ? planByName(web.plan) : planByGoogleProduct(productId);
}

export function planFeatures(plan: string, deviceLimit: number): PlanFeature[] {
  return planByName(plan).features.map((f) => ({ ...f, label: LABELS[f.key](deviceLimit) }));
}
