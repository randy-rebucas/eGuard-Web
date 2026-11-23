import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { PROTECTIONS } from "@/lib/protections";
import { planById } from "@/lib/plans";
import type { DemoProtection } from "@/lib/setup-demo";
import { PageHead } from "../page-head";
import { SetupDemo } from "./setup-demo";
import "./demo.css";

export const metadata: Metadata = pageMetadata({
  title: "Try eGuard setup: an interactive demo",
  path: "/demo",
  description: "Set up eGuard for a child's Android phone, Windows PC and browser in an interactive demo. Nothing is saved, and you don't need an account.",
});

/**
 * The whole new-family setup, played in the visitor's browser: sign up, add a child, then pair their phone, computer and
 * browser side by side with the parent's screen. Nothing reaches the server. The protection table and plan limits come
 * from the same sources the real app uses, so what the demo says a device can do stays true.
 */
export default function DemoPage() {
  const protections: DemoProtection[] = PROTECTIONS.map((p) => ({ key: p.key, name: p.checkName, android: p.caps.ANDROID, computer: p.caps.WINDOWS }));
  const free = planById("FREE");
  const plus = planById("PLUS");
  return (
    <>
      <PageHead
        eyebrow="Interactive demo"
        title={<>Set up a child&apos;s <span className="lp-accent">phone, computer and browser</span>, start to finish.</>}
        lede="Play the parent. You'll create an account, add a child, then connect each of their devices, with your screen on one side and theirs on the other. It takes about 3 minutes. Nothing is saved."
      />
      <div className="lp-wrap dm-wrap">
        <SetupDemo
          protections={protections}
          plans={{
            free: { name: free.name, devices: free.entitlements.deviceLimit, location: free.entitlements.locationSharing },
            plus: { name: plus.name, devices: plus.entitlements.deviceLimit },
          }}
        />
      </div>
    </>
  );
}
