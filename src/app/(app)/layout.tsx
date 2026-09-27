import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyGraph, unreadCount } from "@/lib/queries";
import { ensureOfflineAlerts } from "@/lib/engine";
import { touchSimulated } from "@/lib/simulator";
import { BottomNav, Sidebar, TopHeader } from "@/components/shell";
import { FlowProvider } from "@/components/flow";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { hasPendingVerification } from "@/lib/email-verification";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await touchSimulated(user.familyId);
  await ensureOfflineAlerts(user.familyId);
  const [family, graph, unread, jar] = await Promise.all([getFamily(user.familyId), getFamilyGraph(user.familyId), unreadCount(user.familyId, user.id), cookies()]);
  const attention = Object.values(graph.deviceStates).filter((s) => s.key !== "healthy").length;
  const plan = { plan: family.plan, used: graph.devices.length, limit: family.deviceLimit };
  const linkSent = !user.emailVerified && await hasPendingVerification(user.id, user.email);
  return (
    <FlowProvider>
      <div className="app">
        <Sidebar attention={attention} plan={plan} />
        <div className="main">
          <TopHeader user={{ name: user.name, email: user.email, role: user.role }} unread={unread} theme={jar.get("eg_theme")?.value ?? "system"} />
          <main className="content" id="main">
            {user.emailVerified ? null : <VerifyEmailBanner email={user.email} linkSent={linkSent} />}
            {children}
          </main>
        </div>
      </div>
      <BottomNav attention={attention} plan={plan} />
    </FlowProvider>
  );
}
