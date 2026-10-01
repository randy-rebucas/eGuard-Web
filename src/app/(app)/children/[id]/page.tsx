import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appMinutesOn, dateFromKey, dayKey, getAlerts, getFamily, getFamilyGraph, historyPage, limitOn } from "@/lib/queries";
import { ageLabel, ago, dayTime, shortDate } from "@/lib/format";
import { isOffline } from "@/lib/health";
import { toAlertItem, weeklySeries } from "@/lib/views";
import { CAPABILITY_META, PROTECTION_BY_KEY, describeConfig, fmtMinutes, fmtMinutesPadded, type ProtectionConfig } from "@/lib/protections";
import { Icon } from "@/components/icon";
import { Avatar, CheckBadge, DeviceIcon, EmptyState, HealthRing, StatusBadge, Timeline, UpgradeNote, platformName } from "@/components/ui";
import { DeviceCard } from "@/components/cards";
import { AlertRow, ViewAll } from "@/components/alerts";
import { WeeklyChart } from "@/components/charts";
import { FlowButton } from "@/components/flow";
import { AppControls, ChildForm, DeleteChildForm } from "@/components/forms";
import { requestedApps } from "@/lib/family-service";
import { CATEGORY_META, WEB_CATEGORIES, activeTemporaryAllows, describeBrowserPolicy, getOrCreateBrowserPolicy } from "@/lib/browser-policy";
import { categoryCoverage } from "@/lib/category-lists";
import { DURATION_LABEL, requestsForChild, type Duration } from "@/lib/browser-access";
import { AccessRequestRow, BrowserPolicyForm } from "@/components/browser-policy";
import { entitlementsFor } from "@/lib/plans";
import { childLocation } from "@/lib/location";
import { APPS_UPGRADE, LOCATION_UPGRADE, visibleApps } from "@/lib/plan-access";

const TABS = [["overview", "Overview"], ["screen", "Screen Time"], ["apps", "Apps"], ["protection", "Protection"], ["browser", "Browser"], ["location", "Location"], ["devices", "Devices"], ["history", "History"]] as const;
type Tab = (typeof TABS)[number][0];
const HISTORY_LIMIT = 50;
/** Apps named on the Overview's "Screen time today" card; the rest are summed as Others. */
const OVERVIEW_APPS = 5;
/** Older links (alerts, emails) used ?tab=activity for what is now Screen Time. */
const TAB_ALIASES: Record<string, Tab> = { activity: "screen" };

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
  const asked = typeof sp.tab === "string" ? sp.tab : "";
  const tab: Tab = TABS.find(([k]) => k === asked)?.[0] ?? TAB_ALIASES[asked] ?? "overview";
  const [family, graph] = await Promise.all([getFamily(u.familyId), getFamilyGraph(u.familyId)]);
  const tz = family.timezone;
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
            <div className="t-meta" style={{ fontSize: 14.5 }}>{ageLabel(c.age)}</div>
            <div className="row" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
              <StatusBadge status={c.status} />
              {d ? <span className="pill tone-muted"><DeviceIcon kind={d.kind} />{d.name} · {d.osVersion}</span> : null}
            </div>
          </div>
          <div className="health">
            <HealthRing score={c.health.score} total={c.health.total} small label={`${c.name}'s protection health`} />
            <div>
              <div className="eyebrow">Protection Health</div>
              <div className="t-title" style={{ fontSize: 16, marginTop: 4 }}>{!c.devices.length ? "No devices to check yet"
                : c.health.verified ? "All checks verified"
                : c.health.score === c.health.total ? `${c.health.offline} ${c.health.offline === 1 ? "device" : "devices"} offline, last known state`
                : `${c.health.total - c.health.score} to review`}</div>
              <Link className="link-btn" href={`/children/${c.id}?tab=protection`}>See checks <Icon name="arrow-right" /></Link>
            </div>
          </div>
        </section>
      </div>
      {sp.added === "1" && !c.devices.length ? (
        <div className="form-ok" role="status">
          <Icon name="circle-check" />
          <span className="grow">{c.name} is added with age-appropriate protections. Next, pair {c.name}&apos;s phone or tablet so eGuard can apply and verify them.</span>
          <Link className="btn btn-primary btn-sm" href={`/devices?child=${c.id}#pair`}>Pair a device</Link>
        </div>
      ) : null}
      <nav className="tabs underline" aria-label={`${c.name} sections`}>
        {TABS.map(([k, l]) => <Link key={k} className="tab" href={`/children/${c.id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{l}</Link>)}
      </nav>
      <div>
        {tab === "overview" ? <Overview /> : null}
        {tab === "screen" ? <Activity /> : null}
        {tab === "apps" ? <Apps /> : null}
        {tab === "protection" ? <Protection /> : null}
        {tab === "browser" ? <Browser /> : null}
        {tab === "location" ? <Location /> : null}
        {tab === "devices" ? <Devices /> : null}
        {tab === "history" ? <History /> : null}
      </div>
    </>
  );

  function DevicesGrid() {
    return c!.devices.length ? <div className="devices-grid">{c!.devices.map((x) => <DeviceCard key={x.id} d={x} state={graph.deviceStates[x.id]} tz={tz} />)}</div>
      : (
        <EmptyState icon="smartphone" title="No devices yet" text={`Pair ${c!.name}'s phone or tablet with the eGuard app to start protecting it.`}>
          <Link className="btn btn-primary" href={`/devices?child=${c!.id}#pair`}><Icon name="plus" />Pair a device</Link>
        </EmptyState>
      );
  }

  function Devices() {
    return <section className="card card-pad"><DevicesGrid /></section>;
  }

  async function Overview() {
    const todayKey = dayKey(new Date(), tz), today = dateFromKey(todayKey);
    const [usage, apps, mine] = await Promise.all([
      db.screenTimeDaily.aggregate({ where: { childId: c!.id, date: today }, _sum: { minutes: true } }),
      appMinutesOn([c!.id], today),
      getAlerts(u.familyId, u.id, { childId: c!.id, take: 4 }),
    ]);
    const used = usage._sum.minutes ?? 0;
    const limit = limitOn(c!, todayKey);
    // The most used apps by name, the rest as one total: a short card, and no more names than the plan shows on Apps
    const shown = Math.min(OVERVIEW_APPS, entitlementsFor(family.plan).appMonitoringLimit ?? OVERVIEW_APPS);
    const named = apps.filter((a) => a.app !== "Others").slice(0, shown);
    const others = apps.reduce((s, a) => s + a.minutes, 0) - named.reduce((s, a) => s + a.minutes, 0);
    const appRows: [string, number][] = [...named.map((a) => [a.app, a.minutes] as [string, number]), ...(others > 0 ? [["Others", others] as [string, number]] : [])];
    const pct = Math.round((used / Math.max(1, limit)) * 100);
    const open = c!.health.checks.filter((x) => x.status !== "PASS" && x.status !== "UNSUPPORTED");
    const n = c!.devices.length, where = n === 1 ? "their device" : `all ${n} devices`;
    return (
      <div className="detail-grid">
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2>Needs your attention</h2></div>
            {!n ? <EmptyState icon="smartphone" title="Pair a device first" text={`Protections are checked on ${c!.name}'s devices. Pair one to see what needs attention.`} />
              : open.length ? <div className="check-list" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>{open.map((ch) => (
              <FlowButton key={ch.key} protection={ch.key} childId={c!.id} className="check-item">
                <span className="ico-tile warn"><Icon name={ch.icon} /></span>
                <span className="grow"><span className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span className="t-title">{ch.name}</span><CheckBadge status={ch.status} /></span>
                  <span className="t-meta" style={{ display: "block", marginTop: 4 }}>{ch.detail}</span><span className="link-btn" style={{ marginTop: 4 }}>Fix this <Icon name="arrow-right" /></span></span>
              </FlowButton>
            ))}</div>
              : c!.health.verified ? <EmptyState icon="shield-check" title="Everything is configured" text={`All of ${c!.name}'s protections are verified on ${where}.`} />
              : <EmptyState icon="wifi-off" title="Nothing to fix right now" text={`Every protection matched when ${c!.name}'s devices last synced. ${c!.health.offline} ${c!.health.offline === 1 ? "is" : "are"} offline, so eGuard can't verify ${c!.health.offline === 1 ? "it" : "them"} now.`} />}
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2>Devices</h2><Link className="link-btn" href={`/devices?child=${c!.id}#pair`}>Pair a device <Icon name="arrow-right" /></Link></div>
            <DevicesGrid />
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2>Profile</h2></div>
            <ChildForm child={{ id: c!.id, name: c!.name, birthYear: c!.birthYear }} />
            <hr className="divider" style={{ margin: "20px 0" }} />
            {u.role === "FAMILY_ADMIN" ? <DeleteChildForm childId={c!.id} name={c!.name} /> : <p className="t-meta">Only the family admin can remove {c!.name} from eGuard.</p>}
          </section>
        </div>
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Screen time today</h2></div>
            <div className="usage-big num" style={{ marginTop: 0 }}>{fmtMinutesPadded(used)} <small>/ {fmtMinutes(limit)}</small></div>
            <div className={`bar ${pct >= 85 ? "warn" : ""}`} role="progressbar" aria-label={`${c!.name}'s screen time today`} aria-valuenow={Math.min(100, pct)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
            <div className="app-rows">{appRows.length ? appRows.map(([app, m]) => <div key={app}><span>{app}</span><span>{fmtMinutes(m)}</span></div>) : <div><span>No usage reported yet today</span><span /></div>}</div>
            {appRows.length ? <Link className="link-btn" href={`/children/${c!.id}?tab=apps`} style={{ marginTop: 8 }}>Manage apps <Icon name="arrow-right" /></Link> : null}
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Recent alerts</h2><ViewAll href="/notifications" /></div>
            <div style={{ margin: "0 -12px" }}>{mine.length ? mine.map((a) => <AlertRow key={a.id} a={toAlertItem(a, tz)} />) : <EmptyState icon="bell" title="No recent alerts" />}</div>
          </section>
        </div>
      </div>
    );
  }

  async function Browser() {
    const [p, browsers, requests] = await Promise.all([
      getOrCreateBrowserPolicy(c!.id),
      db.browserInstallation.findMany({ where: { childId: c!.id }, orderBy: { createdAt: "asc" } }),
      requestsForChild(u, c!.id),
    ]);
    const temporary = activeTemporaryAllows(p);
    const view = (r: (typeof requests.pending)[number]) => ({
      id: r.id, domain: r.domain, reason: r.reason, status: r.status, duration: r.duration, createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null, decidedBy: r.decidedBy, expiresAt: r.expiresAt?.toISOString() ?? null,
    });
    const schedule = p.schedule as { enabled: boolean; startTime: string; endTime: string } | null;
    return (
      <div className="detail-grid">
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><div><h2>Browser protection</h2><div className="sub">What the eGuard extension does in {c!.name}&apos;s Chrome, Edge and Firefox. It applies to every browser you add for {c!.name}.</div></div></div>
            <BrowserPolicyForm childId={c!.id} childName={c!.name}
              categories={WEB_CATEGORIES.map((key) => ({ key, ...CATEGORY_META[key], ...categoryCoverage(key) }))}
              initial={{
                version: p.version, safeBrowsing: p.safeBrowsing, safeSearch: p.safeSearch, blockedCategories: p.blockedCategories,
                blockedDomains: p.blockedDomains, allowedDomains: p.allowedDomains,
                unknownSitesPolicy: p.unknownSitesPolicy as "ALLOW" | "WARN" | "BLOCK", schedule,
              }} />
          </section>
        </div>
        <div className="dash-col">
          <section className="card card-pad" id="access-requests">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Access requests</h2></div>
            {requests.pending.length ? (
              <ul className="bp-requests">{requests.pending.map((r) => <AccessRequestRow key={r.id} r={view(r)} childName={c!.name} when={ago(r.createdAt, tz)} />)}</ul>
            ) : <p className="t-meta">When {c!.name} asks to open a blocked site, the request appears here.</p>}
            {temporary.length ? (
              <>
                <h3 className="t-title" style={{ fontSize: 14, marginTop: 16 }}>Allowed for now</h3>
                <div className="app-rows">{temporary.map((t) => <div key={t.domain}><span>{t.domain}</span><span className="t-meta">until {dayTime(new Date(t.until), tz)}</span></div>)}</div>
              </>
            ) : null}
            {requests.recent.length ? (
              <>
                <h3 className="t-title" style={{ fontSize: 14, marginTop: 16 }}>Recently answered</h3>
                <div className="app-rows">{requests.recent.map((r) => (
                  <div key={r.id}><span>{r.domain}</span><span className="t-meta">{r.status === "APPROVED" ? `Allowed${r.duration ? ` · ${DURATION_LABEL[r.duration as Duration]}` : ""}` : "Declined"} by {r.decidedBy}{r.decidedAt ? ` · ${ago(r.decidedAt, tz)}` : ""}</span></div>
                ))}</div>
              </>
            ) : null}
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Browsers</h2><Link className="link-btn" href="/devices#add-browser">Add a browser <Icon name="arrow-right" /></Link></div>
            {browsers.length ? (
              <div className="app-rows">{browsers.map((b) => (
                <div key={b.id}><span>{b.browser} on {b.deviceLabel}</span><span className="t-meta">{b.revokedAt ? "Disconnected for security" : !b.lastSeenAt ? "Not connected yet" : isOffline(b) ? `Not seen since ${dayTime(b.lastSeenAt, tz)}` : `Seen ${ago(b.lastSeenAt, tz)}`}</span></div>
              ))}</div>
            ) : <EmptyState icon="globe" title="No browsers yet" text={`Add the eGuard extension to ${c!.name}'s browser to use these settings.`} />}
            <p className="t-meta" style={{ marginTop: 14 }}>
              Browsers apply changes within 5 minutes. Each browser checks that its blocking rules match these settings; its popup says so, or explains what needs attention.
            </p>
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Current settings</h2></div>
            <dl className="kv" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
              <div><dt>Version</dt><dd className="num">{p.version}</dd></div>
              <div><dt>Last changed</dt><dd>{p.updatedBy} · {dayTime(p.updatedAt, tz)}</dd></div>
              <div><dt>Summary</dt><dd>{describeBrowserPolicy(p)}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    );
  }

  async function Activity() {
    const w = await weeklySeries(u.familyId, tz, graph, [c!.id]);
    const policy = c!.policies.find((p) => p.key === "SCREEN_TIME")?.config as ProtectionConfig | undefined;
    // Without a saved policy, the limits eGuard applies are the child's own (set when they were added)
    const st = policy?.key === "SCREEN_TIME" ? policy : { dailyMinutes: c!.dailyLimitMinutes, weekendMinutes: c!.weekendLimitMinutes };
    return (
      <div className="detail-grid">
        <div className="dash-col"><WeeklyChart single series={w.series} days={w.days} title="Screen Time, Last 7 Days" subtitle={`Daily totals, ${w.range}. Today is still in progress.`} /></div>
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Limits</h2></div>
            <dl className="kv" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
              <div><dt>School days</dt><dd className="num">{fmtMinutes(st.dailyMinutes)} / day</dd></div>
              <div><dt>Weekends</dt><dd className="num">{fmtMinutes(st.weekendMinutes)} / day</dd></div>
              <div><dt>Bedtime</dt><dd>{describeConfig(c!.policies.find((p) => p.key === "BEDTIME")?.config)}</dd></div>
            </dl>
            <FlowButton protection="SCREEN_TIME" childId={c!.id} className="btn btn-secondary" ><Icon name="sliders-horizontal" />Change limits</FlowButton>
          </section>
        </div>
      </div>
    );
  }

  async function Apps() {
    const [all, usage, requested] = await Promise.all([
      db.childApp.findMany({ where: { childId: c!.id }, orderBy: [{ approval: "desc" }, { name: "asc" }] }),
      appMinutesOn([c!.id], dateFromKey(dayKey(new Date(), tz))),
      requestedApps(c!.id),
    ]);
    const approval = c!.policies.find((p) => p.key === "APP_APPROVAL")?.config as { enabled?: boolean } | undefined;
    const label = { ALLOWED: "Allowed", ALWAYS_ALLOWED: "Always allowed", FILTERED: "Filtered", BLOCKED: "Blocked", PENDING: "Waiting for your approval" };
    const pending = all.filter((a) => a.approval === "PENDING" || requested.has(a.name));
    const { apps, hidden } = visibleApps(all, entitlementsFor(family.plan).appMonitoringLimit, { requested, minutes: (n) => usage.find((x) => x.app === n)?.minutes ?? 0 });
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
        {hidden ? <div style={{ marginTop: 12 }}><UpgradeNote compact icon="app-window" title="More apps" text={`${hidden} more app${hidden > 1 ? "s" : ""} not shown. ${family.plan} shows apps waiting for approval and the most used. ${APPS_UPGRADE}`} /></div> : null}
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
        {/* Nothing can be verified yet: say what to do, rather than ten warnings that read as problems */}
        {!c!.devices.length ? (
          <div className="form-ok" style={{ marginBottom: 12 }}>
            <Icon name="smartphone" /><span className="grow">These are {c!.name}&apos;s settings. eGuard applies and verifies them once a device is paired.</span>
            <Link className="btn btn-primary btn-sm" href={`/devices?child=${c!.id}#pair`}>Pair a device</Link>
          </div>
        ) : null}
        <div className="check-list">
          {c!.health.checks.map((ch) => {
            const def = PROTECTION_BY_KEY[ch.key];
            const policy = describeConfig(c!.policies.find((p) => p.key === ch.key)?.config);
            return (
              <FlowButton key={ch.key} protection={ch.key} childId={c!.id} className="check-item">
                <span className={`ico-tile ${ch.status === "PASS" ? "" : ch.status === "UNSUPPORTED" || !c!.devices.length ? "muted" : "warn"}`}><Icon name={def.icon} /></span>
                <span className="grow">
                  <span className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span className="t-title">{ch.name}</span><CheckBadge status={ch.status} /></span>
                  <span className="t-meta" style={{ display: "block", marginTop: 4 }}>{policy} · {ch.detail}</span>
                  <span className="row" style={{ gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {[...new Set(c!.devices.map((x) => x.platform))].map((pl) => <span key={pl} className="t-meta">{platformName(pl)}: {CAPABILITY_META[def.caps[pl]].label}</span>)}
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
    if (!entitlementsFor(family.plan).locationSharing) {
      return <section className="card card-pad"><UpgradeNote icon="map-pin-off" title="Location sharing isn't on your plan" text={LOCATION_UPGRADE} /></section>;
    }
    const l = childLocation(c!.devices);
    if (l.state === "no_devices") return <section className="card card-pad"><DevicesGrid /></section>;
    return (
      <section className="card card-pad">
        {l.state === "located" ? (
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Avatar name={c!.name} hue={c!.hue} size="lg" />
            <div className="grow"><div className="t-title" style={{ fontSize: 17 }}>{l.location!.placeLabel ?? "Current location"}{l.approximate ? " (approximate)" : ""}</div><div className="t-meta">From {l.device!.name} · updated {ago(l.locatedAt, tz)}</div></div>
            <Link className="btn btn-secondary" href="/location"><Icon name="map" />Open map</Link>
          </div>
        ) : l.state === "waiting" ? (
          <EmptyState icon="map-pin" title="Waiting for location" text={`Sharing is on for ${c!.name}. The first location appears after the device syncs.`} />
        ) : (
          <EmptyState icon="map-pin-off" title="Location unavailable" text={l.offDevice ? `Location sharing is turned off on ${c!.name}'s ${l.offDevice.name}.` : `None of ${c!.name}'s devices share location.`}>
            <FlowButton protection="LOCATION" childId={c!.id} className="btn btn-primary"><Icon name="list-checks" />Turn on location sharing</FlowButton>
          </EmptyState>
        )}
        {family.keepLocationHistory ? (
          <p className="t-meta" style={{ marginTop: 16 }}><Icon name="history" size={14} style={{ verticalAlign: -2 }} /> Location history is on: places {c!.name} visits are kept for {family.retentionDays} days. <Link className="link-btn" href={`/location/${c!.id}`}>See {c!.name}&apos;s places</Link></p>
        ) : (
          <p className="t-meta" style={{ marginTop: 16 }}><Icon name="eye-off" size={14} style={{ verticalAlign: -2 }} /> Location history is off, so eGuard keeps only the latest location. <Link className="link-btn" href="/settings/privacy">Privacy settings</Link></p>
        )}
      </section>
    );
  }

  /** Newest first, HISTORY_LIMIT at a time; `?before=<ISO time>` pages back (same pattern as location history). */
  async function History() {
    const before = typeof sp.before === "string" && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined;
    const { rows: items, nextBefore: older } = await historyPage(c!.id, HISTORY_LIMIT, before);
    const base = `/children/${c!.id}?tab=history`;
    return (
      <section className="card card-pad">
        <div className="card-head"><div><h2>Configuration history</h2><div className="sub">Verified changes to {c!.name}&apos;s protections, and who made them. Kept for {family.retentionDays} days.</div></div></div>
        {items.length ? <Timeline items={items.map((h) => ({ id: h.id, icon: PROTECTION_BY_KEY[h.key]?.icon ?? "history", title: h.title, by: h.actor, time: before ? shortDate(h.createdAt, tz) : dayTime(h.createdAt, tz), from: h.fromValue, to: h.toValue }))} />
          : <EmptyState icon="history" title={before ? "No older changes" : "No changes yet"} text={before ? "That's everything eGuard has kept." : "Verified changes to protections are recorded here."} />}
        {before || older ? (
          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
            {before ? <Link className="link-btn" href={base}>Back to newest</Link> : <span />}
            {older ? <Link className="btn btn-secondary btn-sm" href={`${base}&before=${encodeURIComponent(older.toISOString())}`}>Show older changes</Link> : null}
          </div>
        ) : null}
      </section>
    );
  }
}

