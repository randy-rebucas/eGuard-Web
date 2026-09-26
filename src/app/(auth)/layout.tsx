import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Brand } from "@/components/logo";
import { Icon } from "@/components/icon";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getUser()) redirect("/dashboard");
  return (
    <div className="auth">
      <div className="auth-panel">
        <Brand />
        {children}
      </div>
      <aside className="auth-art" aria-hidden="true">
        <h2>A Safer Digital World for Their Brighter Tomorrow</h2>
        <p>Set protections once for every Android and iOS device in your family. eGuard verifies they stay on.</p>
        <div className="auth-points">
          <span><Icon name="shield-check" />Configuration Health for every device</span>
          <span><Icon name="list-checks" />Guided setup where a platform needs it</span>
          <span><Icon name="lock" />eGuard does not sell your children&apos;s data</span>
        </div>
      </aside>
    </div>
  );
}
