import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getAlerts, getFamily, getFamilyGraph, type FamilyGraph } from "@/lib/queries";
import { greeting, longDate, shortDate, dayTime } from "@/lib/format";
import { todayActivity, toAlertItem, weeklySeries } from "@/lib/views";
import { Icon } from "@/components/icon";
import { Avatar, AvatarGroup, EmptyState, Loading, SegMeter, statusLabel } from "@/components/ui";
import { ChildCard, DeviceCard } from "@/components/cards";
import { AlertRow, ViewAll } from "@/components/alerts";
import { ActivityPanel, WeeklyChart } from "@/components/charts";
import { CheckButton, FlowButton } from "@/components/flow";
import { LogoMark } from "@/components/logo";
import { SectionBoundary } from "@/components/boundary";
import { currentPurchase, renewalWord } from "@/lib/entitlement";
import { entitlementsFor, nextPlan } from "@/lib/plans";

export const metadata = { title: "Dashboard" };

/* The slower panels stream in after the summary, each with its own skeleton and error boundary. */

async function Activity({ graph, tz }: { graph: FamilyGraph; tz: string }) {
  return <ActivityPanel kids={await todayActivity(graph, tz)} dateLabel={`Today, ${longDate(new Date(), tz)}`} />;
}

async function Weekly({ familyId, graph, tz }: { familyId: string; graph: FamilyGraph; tz: string }) {
  const weekly = await weeklySeries(familyId, tz, graph);
  return <WeeklyChart series={weekly.series} days={weekly.days} subtitle={`Daily totals, ${weekly.range}. Today is still in progress.`} />;
}

async function RecentAlerts({ familyId, userId, tz }: { familyId: string; userId: string; tz: string }) {
  const alerts = await getAlerts(familyId, userId, { take: 4 });
  return alerts.length ? alerts.map((a) => <AlertRow key={a.id} a={toAlertItem(a, tz)} />) : <EmptyState icon="bell" title="You're all caught up" text="New alerts will appear here." />;
}

function Streamed({ title, height, children }: { title: string; height: number; children: React.ReactNode }) {
  return (
    <SectionBoundary title={title}>
      <Suspense fallback={<Loading height={height} radius={20} label={`Loading ${title.toLowerCase()}`} />}>{children}</Suspense>
    </SectionBoundary>
  );
}

export default async function Dashboard() {
  const u = await requireUser();
  // Cached per request, so these reuse what the app layout already loaded
  const [family, graph, purchase] = await Promise.all([getFamily(u.familyId), getFamilyGraph(u.familyId), currentPurchase(u.familyId)]);
  const tz = family.timezone;
  const { familyHealth: health, children, devices, deviceStates } = graph;
  const issues = health.checks.filter((c) => c.status !== "PASS" && c.status !== "UNSUPPORTED").length;
  const attention = Object.values(deviceStates).filter((s) => s.key !== "healthy").length;
  const protectedKids = children.filter((c) => c.status === "protected").length;
  const firstName = u.name.split(" ")[0];
  const lastSync = devices.reduce<Date | null>((m, d) => (d.lastSeenAt && (!m || d.lastSeenAt > m) ? d.lastSeenAt : m), null);

  if (!children.length) {
    return (
      <>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="greet">{greeting(tz)}</span>
            <h1 id="hero-title">{firstName}</h1>
            <p className="lede">Let&apos;s set up your family.<br />Start by adding your first child.</p>
          </div>
        </section>
        <section className="card card-pad">
          <EmptyState icon="users" title="No children yet" text="Add a child, then pair their Android or iOS device with the eGuard app. Protections start as soon as the device syncs.">
            <Link className="btn btn-primary" href="/children/new"><Icon name="plus" />Add child</Link>
          </EmptyState>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="greet">{greeting(tz)}</span>
          <h1 id="hero-title">{firstName}</h1>
          <p className="lede">
            {issues === 0 && health.verified ? <>Every protection is verified.<br />Your family is set.</>
              : issues === 0 ? <>Every protection matched when devices last synced.<br />{health.offline} {health.offline === 1 ? "device is" : "devices are"} offline, so we can&apos;t verify {health.offline === 1 ? "it" : "them"} now.</>
              : <>Your family&apos;s digital safety<br />{health.score >= 8 ? "looks good today." : "needs a little attention."}</>}
          </p>
          <div className="hero-stats">
            <span className="hero-stat"><Icon name="shield-check" /><span className="num">{protectedKids}</span>&nbsp;{protectedKids === 1 ? "child" : "children"} protected</span>
            <span className="hero-stat"><Icon name="tablet-smartphone" /><span className="num">{devices.length}</span>&nbsp;{devices.length === 1 ? "device" : "devices"} connected{health.offline ? `, ${health.offline} offline` : ""}</span>
            {issues ? <Link className="hero-stat warn" href="/protection"><Icon name="triangle-alert" /><span className="num">{issues}</span>&nbsp;{issues === 1 ? "setting needs" : "settings need"} attention</Link> : null}
          </div>
        </div>
        <div className="hero-side">
          <div className="glass">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <span className="t-meta">Current status</span><span className="t-meta num">Synced {dayTime(lastSync, tz).replace("Today, ", "")}</span>
            </div>
            {children.map((c) => (
              <Link key={c.id} href={`/children/${c.id}`} className="glass-child">
                <Avatar name={c.name} hue={c.hue} />
                <span><span className="t-title" style={{ display: "block" }}>{c.name}</span><span className="t-meta">{c.primary?.name ?? "No device"}</span></span>
                <span className={`state ${c.status === "protected" ? "st-ok" : c.status === "attention" ? "st-warn" : "st-off"}`}>
                  <Icon name={c.status === "protected" ? "shield-check" : c.status === "attention" ? "triangle-alert" : "circle-dashed"} />{statusLabel(c.status)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="metrics" aria-label="Family summary">
        <Link className="card metric interactive" href="/protection">
          <div className="m-top"><span className="m-label">Family Protection</span><span className="ico-tile"><Icon name="shield-check" /></span></div>
          <div className="m-value num">{health.score}<small> / 10</small></div>
          <SegMeter score={health.score} />
          <div className="m-foot">
            <span className={`pill ${health.score >= 9 ? "tone-ok" : "tone-accent"}`}><Icon name={health.score >= 9 ? "circle-check" : "shield"} />{health.verified ? "All verified" : health.score === health.total ? "Last known: all set" : health.score >= 8 ? "Good protection" : "Needs review"}</span>
            <span className="muted"><Icon name="arrow-right" /></span>
          </div>
        </Link>
        <Link className="card metric interactive" href="/children">
          <div className="m-top"><span className="m-label">Children</span><span className="ico-tile"><Icon name="users" /></span></div>
          <div className="m-value num">{children.length}</div>
          <AvatarGroup people={children} />
          <div className="m-foot"><span className="link-btn">View children <Icon name="arrow-right" /></span></div>
        </Link>
        <Link className="card metric interactive" href="/devices">
          <div className="m-top"><span className="m-label">Devices</span><span className="ico-tile"><Icon name="tablet-smartphone" /></span></div>
          <div className="m-value num">{devices.length}</div>
          <div className="row" style={{ gap: 6, color: "var(--ink-3)" }}>{devices.map((d) => <Icon key={d.id} name={d.kind === "TABLET" ? "tablet" : "smartphone"} />)}</div>
          <div className="m-foot">
            {attention ? <span className="link-btn" style={{ color: "var(--warn-ink)" }}>{attention} need attention <Icon name="arrow-right" /></span> : <span className="link-btn">All healthy <Icon name="arrow-right" /></span>}
          </div>
        </Link>
        <Link className="card metric interactive" href="/settings/subscription">
          <div className="m-top"><span className="m-label">Active Plan</span><span className="ico-tile"><Icon name="crown" /></span></div>
          <div className="m-value" style={{ fontSize: 26 }}>{family.plan}</div>
          <div className="t-meta">Up to {entitlementsFor(family.plan).childLimit} {entitlementsFor(family.plan).childLimit === 1 ? "child" : "children"} · {family.deviceLimit} devices</div>
          <div className="m-foot"><span className="muted num">{family.renewsAt ? `${renewalWord(purchase)} ${shortDate(family.renewsAt, tz)}` : nextPlan(family.plan) ? `Upgrade to ${nextPlan(family.plan)!.name}` : "No renewal date"}</span></div>
        </Link>
      </section>

      <div className="dash-grid">
        <div className="dash-col">
          <section aria-labelledby="kids-title">
            <div className="section-title"><h2 id="kids-title">Your Children</h2><ViewAll href="/children" /></div>
            <div className="children-grid">{children.map((c) => <ChildCard key={c.id} c={c} />)}</div>
          </section>

          <Streamed title="Today's activity" height={340}><Activity graph={graph} tz={tz} /></Streamed>

          <section className="card card-pad" aria-labelledby="dev-title">
            <div className="card-head">
              <div><h2 id="dev-title">Device Protection Status</h2><div className="sub">Configuration state reported by each device</div></div>
              <ViewAll href="/devices" />
            </div>
            <div className="devices-grid">{devices.map((d) => <DeviceCard key={d.id} d={d} state={deviceStates[d.id]} tz={tz} />)}</div>
          </section>

          <Streamed title="Weekly screen time" height={380}><Weekly familyId={u.familyId} graph={graph} tz={tz} /></Streamed>
        </div>

        <aside className="dash-col dash-aside" aria-label="Alerts and actions">
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Recent Alerts</h2><ViewAll href="/notifications" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -12px" }}>
              <SectionBoundary title="Recent alerts">
                <Suspense fallback={<div className="dash-col" role="status" aria-label="Loading alerts" style={{ gap: 8, padding: "0 12px" }}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}</div>}>
                  <RecentAlerts familyId={u.familyId} userId={u.id} tz={tz} />
                </Suspense>
              </SectionBoundary>
            </div>
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Quick Actions</h2></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -12px" }}>
              <CheckButton className="list-row"><span className="ico-tile"><Icon name="scan-search" /></span><span className="grow t-title">Run Configuration Check</span><span className="chev"><Icon name="chevron-right" /></span></CheckButton>
              <FlowButton protection="SCREEN_TIME" className="list-row"><span className="ico-tile"><Icon name="hourglass" /></span><span className="grow t-title">Set Screen Time Limits</span><span className="chev"><Icon name="chevron-right" /></span></FlowButton>
              <FlowButton protection="APP_RESTRICTIONS" className="list-row"><span className="ico-tile"><Icon name="layout-grid" /></span><span className="grow t-title">Manage Apps</span><span className="chev"><Icon name="chevron-right" /></span></FlowButton>
              <FlowButton protection="BEDTIME" className="list-row"><span className="ico-tile"><Icon name="moon" /></span><span className="grow t-title">Set Bedtime Schedule</span><span className="chev"><Icon name="chevron-right" /></span></FlowButton>
              <Link href="/location" className="list-row"><span className="ico-tile"><Icon name="map-pin" /></span><span className="grow t-title">View Location</span><span className="chev"><Icon name="chevron-right" /></span></Link>
            </div>
          </section>
          <section className="promo" aria-label="eGuard">
            <div className="mini-brand"><LogoMark size={22} />eGuard</div>
            <h3>A Safer Digital World<br />for Their Brighter Tomorrow</h3>
            <p>Protections you set once, verified on every device, every day.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
