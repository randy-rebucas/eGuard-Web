import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/logo";
import { Icon } from "@/components/icon";
import "./auth.css";

import panelBackground from "../../../public/landing/hero-background.jpg";
import family from "../../../public/landing/hero-family.jpg";
import avatar1 from "../../../public/landing/avatar-1.png";
import avatar2 from "../../../public/landing/avatar-2.png";
import avatar3 from "../../../public/landing/avatar-3.png";

const POINTS = [
  { icon: "shield-check", label: "Easy setup and configuration" },
  { icon: "badge-check", label: "Verified protection" },
  // Alert emails go out with the maintenance run (every few minutes), so not "instant"
  { icon: "bell-ring", label: "Email alerts when something changes" },
  { icon: "shield", label: "Peace of mind" },
];

/** Sign-in pages that are only for signed-out visitors call redirectIfSignedIn(); reset-password works either way. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <Image className="auth-bg" src={panelBackground} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" placeholder="blur" />
      <aside className="auth-art">
        <div className="auth-art-copy">
          <Link href="/" className="auth-home" aria-label="eGuard home"><Brand /></Link>
          <h2>A Safer Digital World for Their Brighter Tomorrow</h2>
          <p>eGuard helps parents configure, manage, and verify digital safety protections for their children&apos;s devices — all in one place.</p>
          <ul className="auth-points">
            {POINTS.map((p) => (
              <li key={p.label}><span className="auth-point-icon"><Icon name={p.icon} /></span>{p.label}</li>
            ))}
          </ul>
        </div>
        <div className="auth-art-photo">
          <Image src={family} alt="A parent couple and their daughter smiling at a laptop together" fill sizes="45vw" placeholder="blur" />
        </div>
        <div className="auth-trust">
          <div>
            <div className="auth-trust-title">Free for 1 child</div>
            <div className="auth-trust-sub">No card needed. Upgrade any time.</div>
          </div>
          <div className="auth-trust-avatars">
            {[avatar1, avatar2, avatar3].map((a, i) => <Image key={i} src={a} alt="" width={36} height={36} />)}
          </div>
        </div>
      </aside>

      <main className="auth-stage">
        <div className="auth-card">
          <Link href="/" className="auth-home auth-card-brand" aria-label="eGuard home"><Brand /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
