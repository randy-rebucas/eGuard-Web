import type { Capability } from "@/lib/protections";

/** Parent-facing wording for each capability level (the dashboard's CAPABILITY_META is terser). */
export const CAPABILITY_COPY: Record<Capability, { label: string; body: string; tone: "ok" | "info" | "wait" | "muted" }> = {
  AVAILABLE: { label: "Applied by eGuard", tone: "ok",
    body: "eGuard switches it on for you, then checks the device really has it." },
  GUIDED: { label: "Guided setup", tone: "info",
    body: "The platform doesn't let apps change this directly, so eGuard walks you through the steps on the device, then checks the result." },
  VERIFY_ONLY: { label: "You set it, eGuard checks", tone: "wait",
    body: "You turn it on in the device's own settings. eGuard shows you where, then confirms it's on." },
  UNSUPPORTED: { label: "Not available", tone: "muted",
    body: "The platform doesn't allow it. It never counts against your Configuration Health." },
};

export function CapabilityChip({ platform, cap }: { platform: string; cap: Capability }) {
  return <span className={`pr-cap ${CAPABILITY_COPY[cap].tone}`}><b>{platform}</b>{CAPABILITY_COPY[cap].label}</span>;
}
