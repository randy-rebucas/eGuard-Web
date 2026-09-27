/** Plans, what each includes, and the store product that sells it. The family's current limit lives on Family. */
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

export const planByName = (name: string) => PLANS.find((p) => p.name === name) ?? PLANS[0];
export const planByGoogleProduct = (productId: string) => PLANS.find((p) => p.googlePlayProductId === productId) ?? null;

export function planFeatures(plan: string, deviceLimit: number): PlanFeature[] {
  return planByName(plan).features.map((f) => ({ ...f, label: LABELS[f.key](deviceLimit) }));
}
