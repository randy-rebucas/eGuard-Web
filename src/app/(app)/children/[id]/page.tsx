import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appMinutesOn, dateFromKey, dayKey, getAlerts, getFamily, getFamilyGraph } from "@/lib/queries";
import { ago, dayTime } from "@/lib/format";
import { toAlertItem, weeklySeries } from "@/lib/views";
import { PROTECTION_BY_KEY, describeConfig, fmtMinutes, fmtMinutesPadded, type ProtectionConfig } from "@/lib/protections";
import { Icon } from "@/components/icon";
import { Avatar, CheckBadge, DeviceIcon, EmptyState, HealthRing, StatusBadge, Timeline, platformName } from "@/components/ui";
import { DeviceCard } from "@/components/cards";
import { AlertRow } from "@/components/alerts";
import { WeeklyChart } from "@/components/charts";
import { FlowButton } from "@/components/flow";
import { AppControls, ChildForm, DeleteChildForm } from "@/components/forms";
import { requestedApps } from "@/lib/family-service";

const TABS = [["overview", "Overview"], ["activity", "Activity"], ["apps", "Apps"], ["screen", "Screen Time"], ["protection", "Protection"], ["location", "Location"], ["devices", "Devices"], ["history", "History"]] as const;
type Tab = (typeof TABS)[number][0];

export async function generateMetadata(props: PageProps<"/children/[id]">) {
  const { id } = await props.params;
  const u = await getUser();
  const c = u ? await db.child.findFirst({ where: { id, familyId: u.familyId }, select: { name: true } }) : null;
  return { title: c?.name ?? "Child" };
}

export default async function ChildPage(props: PageProps<"/children/[id]">) {
  const u = await requireUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? "overview");
  const family = await getFamily(u.familyId);
  const tz = family.timezone;
  const graph = await getFamilyGraph(u.familyId);
  const c = graph.children.find((x) => x.id === id);
  if (!c) notFound();
  const d = c.primary;

  return (
    <>
      <div>
        <div className="crumbs"><Link className="link-btn" href="/children" style={{ fontWeight: 500, minHeight: 0 }}>Children</Link><Icon name="chevron-right" size={14} /><span>{c.name}</span></div>
        <section className="card detail-head">
          <Avatar name={c.name} hue={c.hue} size="xl" />
          <div className="grow">
            <h1>{c.name}</h1>
            <div className="t-meta" style={{ fontSize: 14.5 }}>{c.age} years old</div>
            <div className="row" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
              <StatusBadge status={c.status} />
              {d ? <span className="pill tone-muted"><DeviceIcon kind={d.kind} />{d.name} · {d.osVersion}</span> : null}
            </div>
          </div>
          <div className="health">
            <HealthRing score={c.health.score} small label={`${c.name}'s protection health`} />
            <div>
              <div className="eyebrow">Protection Health</div>
              <div className="t-title" style={{ fontSize: 16, marginTop: 4 }}>{c.health.verified ? "All checks verified"
                : c.health.score === c.health.total ? `${c.health.offline} ${c.health.offline === 1 ? "device" : "devices"} offline, last known state`
                : `${c.health.total - c.health.score} to review`}</div>
              <Link className="link-btn" href={`/children/${c.id}?tab=protection`}>See checks <Icon name="arrow-right" /></Link>
            </div>
          </div>
        </section>
      </div>
      <nav className="tabs underline" aria-label={`${c.name} sections`}>
        {TABS.map(([k, l]) => <Link key={k} className="tab" href={`/children/${c.id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}
      </nav>
      <div>
        {tab === "overview" ? <Overview /> : null}
        {tab === "activity" || tab === "screen" ? <Activity /> : null}
        {tab === "apps" ? <Apps /> : null}
        {tab === "protection" ? <Protection /> : null}
        {tab === "location" ? <Location /> : null}
        {tab === "devices" ? <div className="devices-grid">{c.devices.map((x) => <DeviceCard key={x.id} d={x} state={graph.deviceStates[x.id]} tz={tz} />)}</div> : null}
        {tab === "history" ? <History /> : null}
      </div>
    </>
  );

  async function Overview() {
    const today = dateFromKey(dayKey(new Date(), tz));
    const [usage, apps, alerts] = await Promise.all([
      db.screenTimeDaily.aggregate({ where: { childId: c!.id, date: today }, _sum: { minutes: true } }),
      appMinutesOn([c!.id], today),
      getAlerts(u.familyId, u.id, { take: 20 }),
    ]);
    const used = usage._sum.minutes ?? 0;
    const pct = Math.round((used / c!.dailyLimitMinutes) * 100);
    const mine = alerts.filter((a) => a.childId === c!.id).slice(0, 4);
    const open = c!.health.checks.filter((x) => x.status !== "PASS" && x.status !== "UNSUPPORTED");
    return (
      <div className="detail-grid">
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2>Needs your attention</h2></div>
            {open.length ? <div className="check-list" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>{open.map((ch) => (
              <FlowButton key={ch.key} protection={ch.key} childId={c!.id} className="check-item">
                <span className="ico-tile warn"><Icon name={ch.icon} /></span>
                <span className="grow"><span className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span className="t-title">{ch.name}</span><CheckBadge status={ch.status} /></span>
                  <span className="t-meta" style={{ display: "block", marginTop: 4 }}>{ch.detail}</span><span className="link-btn" style={{ marginTop: 4 }}>Fix this <Icon name="arrow-right" /></span></span>
              </FlowButton>
            ))}</div> : <EmptyState icon="shield-check" title="Everything is configured" text={`All of ${c!.name}'s protections are verified on ${c!.devices.length === 1 ? "their device" : `all ${c!.devices.length} devices`}.`} />}
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2>Devices</h2><Link className="link-btn" href="/devices#pair">Pair a device <Icon name="arrow-right" /></Link></div>
            {c!.devices.length ? <div className="devices-grid">{c!.devices.map((x) => <DeviceCard key={x.id} d={x} state={graph.deviceStates[x.id]} tz={tz} />)}</div>
              : <EmptyState icon="smartphone" title="No devices yet" text={`Pair ${c!.name}'s phone or tablet with the eGuard app to start protecting it.`} />}
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2>Profile</h2></div>
            <ChildForm child={{ id: c!.id, name: c!.name, birthYear: c!.birthYear }} />
            {u.role === "FAMILY_ADMIN" ? <><hr className="divider" style={{ margin: "20px 0" }} /><DeleteChildForm childId={c!.id} name={c!.name} /></> : null}
          </section>
        </div>
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Screen time today</h2></div>
            <div className="usage-big num" style={{ marginTop: 0 }}>{fmtMinutesPadded(used)} <small>/ {fmtMinutes(c!.dailyLimitMinutes)}</small></div>
            <div className={`bar ${pct >= 85 ? "warn" : ""}`}><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
            <div className="app-rows">{apps.length ? apps.map((a) => <div key={a.app}><span>{a.app}</span><span>{fmtMinutes(a.minutes)}</span></div>) : <div><span>No usage reported yet today</span><span /></div>}</div>
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Recent alerts</h2></div>
            <div style={{ margin: "0 -12px" }}>{mine.length ? mine.map((a) => <AlertRow key={a.id} a={toAlertItem(a, tz)} />) : <EmptyState icon="bell" title="No recent alerts" />}</div>
          </section>
        </div>
      </div>
    );
  }

  async function Activity() {
    const w = await weeklySeries(u.familyId, tz, graph, [c!.id]);
    const policy = c!.policies.find((p) => p.key === "SCREEN_TIME")?.config as ProtectionConfig | undefined;
    const st = policy?.key === "SCREEN_TIME" ? policy : null;
    return (
      <div className="detail-grid">
        <div className="dash-col"><WeeklyChart single series={w.series} days={w.days} title="Screen Time, Last 7 Days" subtitle={`Daily totals, ${w.range}. Today is still in progress.`} /></div>
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Limits</h2></div>
            <dl className="kv" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
              <div><dt>School days</dt><dd className="num">{st ? `${fmtMinutes(st.dailyMinutes)} / day` : "Not set"}</dd></div>
              <div><dt>Weekends</dt><dd className="num">{st ? `${fmtMinutes(st.weekendMinutes)} / day` : "Not set"}</dd></div>
              <div><dt>Bedtime</dt><dd>{describeConfig(c!.policies.find((p) => p.key === "BEDTIME")?.config)}</dd></div>
            </dl>
            <FlowButton protection="SCREEN_TIME" childId={c!.id} className="btn btn-secondary" ><Icon name="sliders-horizontal" />Change limits</FlowButton>
          </section>
        </div>
      </div>
    );
  }

  async function Apps() {
    const apps = await db.childApp.findMany({ where: { childId: c!.id }, orderBy: [{ approval: "desc" }, { name: "asc" }] });
    const today = dateFromKey(dayKey(new Date(), tz));
    const usage = await appMinutesOn([c!.id], today);
    const approval = c!.policies.find((p) => p.key === "APP_APPROVAL")?.config as { enabled?: boolean } | undefined;
    const label = { ALLOWED: "Allowed", ALWAYS_ALLOWED: "Always allowed", FILTERED: "Filtered", BLOCKED: "Blocked", PENDING: "Waiting for your approval" };
    const requested = await requestedApps(c!.id);
    const pending = apps.filter((a) => a.approval === "PENDING" || requested.has(a.name));
    return (
      <section className="card card-pad">
        <div className="card-head">
          <div><h2>Apps</h2><div className="sub">{approval?.enabled ? `New apps need your approval before ${c!.name} can install them.` : "App approval is off."} Changes apply on the device&apos;s next sync.</div></div>
          {approval?.enabled ? <span className="pill tone-ok"><Icon name="badge-check" />App approval on</span> : <FlowButton protection="APP_APPROVAL" childId={c!.id}>Turn on approval</FlowButton>}
        </div>
        {pending.length ? <div className="form-ok" style={{ marginBottom: 12 }}><Icon name="inbox" />{pending.length} app{pending.length > 1 ? "s" : ""} waiting for your approval</div> : null}
        {apps.map((a) => {
          const m = usage.find((x) => x.app === a.name)?.minutes;
          return (
            <div className="setting-row" key={a.id} style={{ flexWrap: "wrap" }}>
              <span className="ico-tile"><Icon name="app-window" /></span>
              <div className="grow" style={{ minWidth: 160 }}><div className="t-title">{a.name}</div><div className="t-meta">{label[a.approval]}{a.approval === "BLOCKED" && requested.has(a.name) ? " · Asked again" : ""}{m != null ? ` · ${fmtMinutes(m)} today` : ""}{a.dailyLimitMinutes ? ` · limit ${fmtMinutes(a.dailyLimitMinutes)}` : ""}</div></div>
              <AppControls app={{ id: a.id, name: a.name, approval: a.approval, dailyLimitMinutes: a.dailyLimitMinutes, requested: requested.has(a.name) }} />
            </div>
          );
        })}
        {!apps.length ? <EmptyState icon="app-window" title="No apps reported yet" text="Apps appear here once a device syncs." /> : null}
      </section>
    );
  }

  function Protection() {
    return (
      <section className="card card-pad">
        <div className="card-head">
          <div><h2>Protection health</h2><div className="sub">Whether each protection is set up and verified on {c!.name}&apos;s devices. This measures configuration, not behavior.</div></div>
        </div>
        <div className="check-list">
          {c!.health.checks.map((ch) => {
            const def = PROTECTION_BY_KEY[ch.key];
            const policy = describeConfig(c!.policies.find((p) => p.key === ch.key)?.config);
            return (
              <FlowButton key={ch.key} protection={ch.key} childId={c!.id} className="check-item">
                <span className={`ico-tile ${ch.status === "PASS" ? "" : ch.status === "UNSUPPORTED" ? "muted" : "warn"}`}><Icon name={def.icon} /></span>
                <span className="grow">
                  <span className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span className="t-title">{ch.name}</span><CheckBadge status={ch.status} /></span>
                  <span className="t-meta" style={{ display: "block", marginTop: 4 }}>{policy} · {ch.detail}</span>
                  <span className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {c!.devices.map((x) => <span key={x.id} className="t-meta">{platformName(x.platform)}: {def.caps[x.platform] === "AVAILABLE" ? "Available" : def.caps[x.platform] === "GUIDED" ? "Guided setup" : def.caps[x.platform] === "VERIFY_ONLY" ? "Verification only" : "Unsupported"}</span>)}
                  </span>
                </span>
              </FlowButton>
            );
          })}
        </div>
      </section>
    );
  }

  function Location() {
    const withLoc = c!.devices.find((x) => x.location?.sharing && x.location.lat != null);
    const sharingOff = c!.devices.find((x) => x.location && !x.location.sharing);
    return (
      <section className="card card-pad">
        {withLoc ? (
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Avatar name={c!.name} hue={c!.hue} size="lg" />
            <div className="grow"><div className="t-title" style={{ fontSize: 17 }}>{withLoc.location!.placeLabel ?? "Current location"}</div><div className="t-meta">From {withLoc.name} · updated {ago(withLoc.location!.locatedAt ?? withLoc.location!.updatedAt, tz)}</div></div>
            <Link className="btn btn-secondary" href="/location"><Icon name="map" />Open map</Link>
          </div>
        ) : (
          <EmptyState icon="map-pin-off" title="Location unavailable" text={sharingOff ? `Location sharing is turned off on ${c!.name}'s ${sharingOff.name}.` : `None of ${c!.name}'s devices share location.`}>
            <FlowButton protection="LOCATION" childId={c!.id} className="btn btn-primary"><Icon name="list-checks" />Turn on location sharing</FlowButton>
          </EmptyState>
        )}
        <p className="t-meta" style={{ marginTop: 16 }}><Icon name="eye-off" size={14} style={{ verticalAlign: -2 }} /> eGuard shows current location only. {family.keepLocationHistory ? "Location history is on for your family." : "Location history is off for your family."}</p>
      </section>
    );
  }

  async function History() {
    const items = await db.configChange.findMany({ where: { childId: c!.id }, orderBy: { createdAt: "desc" }, take: 50 });
    return (
      <section className="card card-pad">
        <div className="card-head"><div><h2>Configuration history</h2><div className="sub">Verified changes to {c!.name}&apos;s protections, and who made them.</div></div></div>
        {items.length ? <Timeline items={items.map((h) => ({ id: h.id, icon: PROTECTION_BY_KEY[h.key]?.icon ?? "history", title: h.title, by: h.actor, time: dayTime(h.createdAt, tz), from: h.fromValue, to: h.toValue }))} />
          : <EmptyState icon="history" title="No changes yet" text="Verified changes to protections are recorded here." />}
      </section>
    );
  }
}

