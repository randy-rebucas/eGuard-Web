"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "./icon";
import { Brand, LogoMark } from "./logo";
import { logout } from "@/app/actions/auth";
import { setTheme } from "@/app/actions/family";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "house" },
  { href: "/children", label: "Children", icon: "users" },
  { href: "/devices", label: "Devices", icon: "tablet-smartphone" },
  { href: "/protection", label: "Protection", icon: "shield-check" },
  { href: "/reports", label: "Reports", icon: "chart-column" },
  { href: "/location", label: "Location", icon: "map-pin" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/dashboard" ? path === "/dashboard" || path === "/notifications" : path.startsWith(href));
}

/** The sidebar plan card: children on the plan, and whether there's a bigger plan to offer */
export type PlanInfo = { plan: string; used: number; limit: number; upgrade: boolean };

function PlanCard({ plan }: { plan: PlanInfo }) {
  const pct = Math.min(100, Math.round((plan.used / plan.limit) * 100));
  return (
    <div className="plan">
      <div className="plan-top"><Icon name="crown" />{plan.plan}</div>
      <p className="num">{plan.used} of {plan.limit} {plan.limit === 1 ? "child" : "children"}</p>
      <div className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Children on your plan"><span style={{ width: `${pct}%` }} /></div>
      <Link className="link-btn" href="/settings/subscription">{plan.upgrade ? <>Upgrade <Icon name="arrow-right" /></> : <>Manage plan <Icon name="arrow-right" /></>}</Link>
    </div>
  );
}

function NavList({ attention, onNavigate }: { attention: number; onNavigate?: () => void }) {
  const isActive = useActive();
  return (
    <nav className="nav" aria-label="Primary">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className="nav-item" aria-current={isActive(n.href) ? "page" : undefined} title={n.label} onClick={onNavigate}>
          <Icon name={n.icon} />
          <span className="label">{n.label}</span>
          {n.href === "/devices" && attention ? <span className="count num" aria-label={`${attention} need attention`}>{attention}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function Sidebar({ attention, plan }: { attention: number; plan: PlanInfo }) {
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <Brand />
      <NavList attention={attention} />
      <PlanCard plan={plan} />
    </aside>
  );
}

export function BottomNav({ attention, plan }: { attention: number; plan: PlanInfo }) {
  const isActive = useActive();
  const [open, setOpen] = useState(false);
  const moreActive = ["/reports", "/location", "/settings"].some((h) => isActive(h));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        {NAV.slice(0, 4).map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
            <Icon name={n.icon} /><span>{n.label}</span>
          </Link>
        ))}
        <button aria-current={moreActive ? "page" : undefined} onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Icon name="menu" /><span>More</span>
        </button>
      </nav>
      {open ? (
        <>
          <div className="drawer-scrim" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <Brand />
            <NavList attention={attention} onNavigate={() => setOpen(false)} />
            <PlanCard plan={plan} />
          </div>
        </>
      ) : null}
    </>
  );
}

type Hit = { group: string; icon: string; title: string; sub: string; href: string };

function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [sel, setSel] = useState(0);
  const [openMobile, setOpenMobile] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!r.ok) throw new Error(String(r.status));
        setHits((await r.json()).results); setSel(0); setSearchFailed(false);
      } catch {
        if (!ctrl.signal.aborted) { setHits([]); setSearchFailed(true); }
      }
    }, 150);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) { e.preventDefault(); setOpenMobile(true); input.current?.focus(); }
    };
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setHits(null); setOpenMobile(false); } };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, []);

  const shown = q.trim() ? hits : null;
  const go = (h: Hit) => { setQ(""); setHits(null); setOpenMobile(false); router.push(h.href); };
  let group = "";
  return (
    <>
      <div className={`search ${openMobile ? "open" : ""}`} role="search" ref={box}>
        <Icon name="search" />
        <label htmlFor="q" className="sr-only">Search</label>
        <input
          id="q" ref={input} type="search" autoComplete="off" value={q}
          placeholder="Search children, devices, or settings..."
          role="combobox" aria-autocomplete="list" aria-controls="search-results" aria-expanded={!!shown}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (!shown?.length) { if (e.key === "Escape") { setQ(""); setOpenMobile(false); } return; }
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % shown.length); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + shown.length) % shown.length); }
            if (e.key === "Enter") { e.preventDefault(); go(shown[sel]); }
            if (e.key === "Escape") { setQ(""); setHits(null); }
          }}
        />
        <kbd aria-hidden="true">/</kbd>
        {shown ? (
          <div className="search-results" id="search-results" role="listbox">
            {shown.length ? shown.map((h, i) => {
              const head = h.group !== group ? (group = h.group) : null;
              return (
                <div key={h.href + h.title}>
                  {head ? <div className="sr-group">{head}</div> : null}
                  <button className={`sr-item ${i === sel ? "active" : ""}`} role="option" aria-selected={i === sel} onClick={() => go(h)}>
                    <Icon name={h.icon} /><span><b>{h.title}</b><small>{h.sub}</small></span>
                  </button>
                </div>
              );
            }) : (
              searchFailed
                ? <div className="empty" role="alert" style={{ padding: 24 }}><Icon name="wifi-off" /><p>Search isn&apos;t available right now. Check your connection and try again.</p></div>
                : <div className="empty" style={{ padding: 24 }}><Icon name="search-x" /><p>No matches for “{q}”. Try a child&apos;s name, a device, or a setting.</p></div>
            )}
          </div>
        ) : null}
      </div>
      <button className="icon-btn search-toggle" aria-label="Search" onClick={() => { setOpenMobile(true); setTimeout(() => input.current?.focus(), 0); }}>
        <Icon name="search" />
      </button>
    </>
  );
}

function Bell({ initial }: { initial: number }) {
  const [fetched, setFetched] = useState<{ n: number; initial: number } | null>(null);
  // server-rendered count wins whenever it changes (e.g. after router.refresh)
  const n = fetched && fetched.initial === initial ? fetched.n : initial;
  const path = usePathname();
  const refresh = useCallback(async () => {
    try { const r = await fetch("/api/notifications/summary"); if (r.ok) { const unread = (await r.json()).unread; setFetched({ n: unread, initial }); } } catch { /* offline */ }
  }, [initial]);
  useEffect(() => { const t = setTimeout(refresh, 0); return () => clearTimeout(t); }, [path, refresh]);
  // Background tabs don't poll; coming back catches up at once
  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const t = setInterval(() => { if (visible()) refresh(); }, 30_000);
    const onShow = () => { if (visible()) refresh(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [refresh]);
  return (
    <Link className="icon-btn" href="/notifications" aria-label={n ? `Notifications, ${n} need review` : "Notifications"}>
      <Icon name="bell" />
      {n ? <span className="badge-dot num">{n}</span> : null}
    </Link>
  );
}

function ProfileMenu({ name, email, role, theme }: { name: string; email: string; role: string; theme: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(theme);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  const pick = (t: "system" | "light" | "dark") => {
    setCurrent(t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    // The theme is already applied on this page; if saving fails it only resets on the next visit
    start(async () => { try { await setTheme(t); } catch { /* offline */ } });
  };
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div ref={ref}>
      <button className="profile" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" style={{ ["--h" as string]: 212 }}>{initials}</span>
        <span className="who"><b>{name}</b><span>{role === "FAMILY_ADMIN" ? "Family Admin" : "Parent"}</span></span>
        <Icon name="chevron-down" />
      </button>
      {open ? (
        <div className="menu" role="menu">
          <div style={{ padding: "8px 10px 10px" }}><div className="t-title">{name}</div><div className="t-meta">{email}</div></div>
          <hr />
          <Link className="menu-item" role="menuitem" href="/settings/account" onClick={() => setOpen(false)}><Icon name="user" />Account</Link>
          <Link className="menu-item" role="menuitem" href="/settings/family" onClick={() => setOpen(false)}><Icon name="users" />Family members</Link>
          <Link className="menu-item" role="menuitem" href="/settings/security" onClick={() => setOpen(false)}><Icon name="key-round" />Security</Link>
          <hr />
          <div className="eyebrow" style={{ padding: "4px 10px" }}>Appearance</div>
          <div className="seg" role="group" aria-label="Theme">
            {(["system", "light", "dark"] as const).map((t) => (
              <button key={t} aria-pressed={current === t} onClick={() => pick(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
          <hr />
          <form action={logout}><button className="menu-item" role="menuitem"><Icon name="log-out" />Sign out</button></form>
        </div>
      ) : null}
    </div>
  );
}

export function TopHeader({ user, unread, theme }: { user: { name: string; email: string; role: string }; unread: number; theme: string }) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const on = () => bar.current?.classList.toggle("scrolled", window.scrollY > 4);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="topbar" ref={bar}>
      <Link href="/dashboard" className="mobile-brand"><LogoMark size={30} /><span>e<b>Guard</b></span></Link>
      <SearchBar />
      <div className="top-actions">
        <Bell initial={unread} />
        <ProfileMenu name={user.name} email={user.email} role={user.role} theme={theme} />
      </div>
    </header>
  );
}
