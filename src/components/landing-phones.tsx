import Image from "next/image";
import {
  BatteryFull, Bell, Blocks, ChevronLeft, Gamepad2, Globe, House, Laptop, Play, Settings, Signal, Users, Wifi,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import avatar1 from "../../public/landing/avatar-1.png";
import avatar2 from "../../public/landing/avatar-2.png";
import avatar3 from "../../public/landing/avatar-3.png";

// Live-rendered app mockups for the landing page. Everything inside .ph is sized in em off a
// container-query font size (see landing.css), so each phone scales as one unit and stays
// crisp at any width or pixel density — unlike the raster screenshots these replaced.

function Phone({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lp-phone" role="img" aria-label={label}>
      <div className="ph">
        <div className="ph-screen">
          <div className="ph-status">
            <span className="num">9:41</span>
            <i className="ph-island" />
            <span className="ph-status-icons"><Signal /><Wifi /><BatteryFull /></span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

const CHILDREN = [
  { src: avatar1, name: "Mia", ok: true },
  { src: avatar2, name: "Lucas", ok: true },
  { src: avatar3, name: "Sophie", ok: false },
];

const TABS: [LucideIcon, string][] = [[House, "Home"], [Users, "Children"], [Laptop, "Devices"], [Bell, "Alerts"], [Settings, "Settings"]];

export function PhoneDashboard() {
  return (
    <Phone label="eGuard app home screen showing a family protection score of 8 out of 10">
      <div className="ph-body ph-home">
        <div className="ph-top">
          <span className="ph-logo"><LogoMark size={22} /><b>eGuard</b></span>
          <span className="ph-me">R</span>
        </div>
        <p className="ph-hello">Good evening,</p>
        <p className="ph-name">Randy</p>
        <p className="ph-lede">Your family&apos;s digital safety looks good today.</p>

        <div className="ph-card ph-score">
          <div className="ph-score-row">
            <svg viewBox="0 0 46 52" aria-hidden="true">
              <defs>
                <linearGradient id="ph-shield" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#5BC2FF" /><stop offset="1" stopColor="#1463E0" />
                </linearGradient>
              </defs>
              <path d="M23 2C17 5.3 10.4 7.2 3.5 8v14.5C3.5 35 11.7 44.4 23 49c11.3-4.6 19.5-14 19.5-26.5V8C35.6 7.2 29 5.3 23 2Z" fill="url(#ph-shield)" />
              <path d="m14.5 25.5 6 6 11-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <small>Family Protection</small>
              <b className="num">8 / 10</b>
              <em>Good Protection</em>
            </div>
          </div>
          <div className="ph-meter"><span /></div>
        </div>

        <p className="ph-h">Your Children</p>
        <ul className="ph-kids">
          {CHILDREN.map((c) => (
            <li key={c.name}>
              <Image src={c.src} alt="" width={96} height={96} sizes="64px" />
              <b>{c.name}</b>
              <span className={c.ok ? "ok" : "warn"}>{c.ok ? "Protected" : "Attention"}</span>
            </li>
          ))}
        </ul>

        <nav className="ph-tabs" aria-hidden="true">
          {TABS.map(([Ico, label], i) => <span key={label} className={i === 0 ? "on" : undefined}><Ico />{label}</span>)}
        </nav>
      </div>
    </Phone>
  );
}

// Minutes used per two-hour slot, 12AM → 10PM.
const USAGE = [22, 10, 16, 34, 18, 10, 26, 12, 12, 18, 8, 0];
const APPS: [LucideIcon, string, string, number, string][] = [
  [Play, "#FF3B30", "YouTube", 54, "54m"],
  [Gamepad2, "#1F2937", "Roblox", 42, "42m"],
  [Globe, "#1A8CFF", "Chrome", 28, "28m"],
  [Blocks, "#34A853", "Minecraft", 18, "18m"],
];
const RING = 2 * Math.PI * 52;

export function PhoneScreenTime() {
  return (
    <Phone label="eGuard screen time view showing 2 hours 14 minutes used today">
      <div className="ph-body ph-time">
        <div className="ph-bar-title"><ChevronLeft /><b>Screen Time</b><i /></div>
        <div className="ph-seg"><span className="on">Today</span><span>7 Days</span><span>30 Days</span></div>

        <div className="ph-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs>
              <linearGradient id="ph-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#1A8CFF" /><stop offset="1" stopColor="#5BC8FF" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#E6F0FB" strokeWidth="9" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="url(#ph-ring)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={`${RING * (134 / 180)} ${RING}`} transform="rotate(-90 60 60)" />
          </svg>
          <div><b className="num">2h 14m</b><span>of 3 hours</span></div>
        </div>

        <div className="ph-chart">
          <div className="ph-bars">
            {USAGE.map((m, i) => <span key={i} className={m >= 26 ? "hi" : undefined} style={{ height: `${Math.max(m, 2) / 36 * 100}%` }} />)}
          </div>
          <div className="ph-axis"><span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span></div>
        </div>

        <p className="ph-h">App Usage</p>
        <ul className="ph-apps">
          {APPS.map(([Ico, color, name, mins, label]) => (
            <li key={name}>
              <i style={{ background: color }}><Ico /></i>
              <b>{name}</b>
              <span className="ph-track"><span style={{ width: `${mins / 60 * 100}%` }} /></span>
              <em className="num">{label}</em>
            </li>
          ))}
        </ul>
      </div>
    </Phone>
  );
}
