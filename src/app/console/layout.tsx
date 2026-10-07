import type { Metadata } from "next";
import "./console.css";

/** The staff console (console.eguard.family, docs/console.md). Reached only through src/proxy.ts on that host. */
export const metadata: Metadata = {
  title: { default: "eGuard Console", template: "%s · eGuard Console" },
  robots: { index: false, follow: false },
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <div className="cn">{children}</div>;
}
