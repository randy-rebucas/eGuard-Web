import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateFromKey, dayKey, getFamily, getFamilyGraph, limitOn } from "@/lib/queries";
import { dayTime } from "@/lib/format";
import { CAPABILITY_META, PROTECTIONS, PROTECTION_BY_KEY, describeConfig, fmtMinutes, fmtMinutesPadded, isConfigured } from "@/lib/protections";
import { Icon } from "@/components/icon";
import { CheckBadge, DeviceIcon, StatusBadge, Timeline, platformName } from "@/components/ui";
import { CheckButton, FlowButton } from "@/components/flow";
import { RemoveDeviceButton, RenameDeviceForm } from "@/components/forms";

export async function generateMetadata(props: PageProps<"/devices/[id]">) {
  const { id } = await props.params;
  const u = await getUser();
  const d = u ? await db.device.findFirst({ where: { id, familyId: u.familyId }, select: { name: true } }) : null;
  return { title: d?.name ?? "Device" };
}

export default async function DevicePage(props: PageProps<"/devices/[id]">) {
  const u = await requireUser();
  const { id } = await props.params;
  const [family, graph] = await Promise.all([getFamily(u.familyId), getFamilyGraph(u.familyId)]);
  const tz = family.timezone;
  const d = graph.devices.find((x) => x.id === id);
  if (!d) notFound();
  const child = graph.children.find((c) => c.id === d.childId)!;
  const state = graph.deviceStates[d.id];
  const todayKey = dayKey(new Date(), tz);
  const today = dateFromKey(todayKey);
  const [usage, childUsage, requests, lastCheck] = await Promise.all([
    db.screenTimeDaily.findUnique({ where: { deviceId_date: { deviceId: d.id, date: today } } }),
    // The limit covers all of the child's devices, so compare it with their total, not this device's share
    db.screenTimeDaily.aggregate({ where: { childId: d.childId, date: today }, _sum: { minutes: true } }),
    db.configRequest.findMany({ where: { deviceId: d.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.checkRunResult.findFirst({ where: { deviceId: d.id, reportedAt: { not: null } }, orderBy: { reportedAt: "desc" } }),
  ]);
  const prot = (key: string) => d.protections.find((p) => p.key === key);
  /** What the device last reported for a protection, or why there's nothing to show */
  const reported = (key: string) => {
    const row = prot(key);
    if (!row) return "Not reported";
    if (row.status === "UNSUPPORTED") return "Not supported";
    if (row.status === "NOT_CONFIGURED") return "Not configured";
    return describeConfig(row.reported);
  };
  const approval = prot("APP_APPROVAL");
  const approvalOn = !!approval && approval.status !== "UNSUPPORTED" && isConfigured(approval.reported);
  const loc = d.location;
  const offline = state.key === "offline";
  const reqLabel: Record<string, string> = { PENDING: "Waiting for device", AWAITING_PARENT: "Waiting for guided setup", DELIVERED: "Delivered, not yet verified", VERIFIED: "Verified", FAILED: "Didn't match", CANCELLED: "Cancelled" };
  const reqIcon: Record<string, string> = { VERIFIED: "circle-check", FAILED: "triangle-alert", CANCELLED: "circle-slash" };

  return (
    <>
      <div>
        <div className="crumbs"><Link className="link-btn" href="/devices" style={{ fontWeight: 500, minHeight: 0 }}>Devices</Link><Icon name="chevron-right" size={14} /><span>{d.name}</span></div>
        <section className="card detail-head">
          <div className="device-visual" style={{ width: 104, height: 104 }}><DeviceIcon kind={d.kind} /></div>
          <div className="grow">
            <h1>{d.name}</h1>
            <div className="t-meta" style={{ fontSize: 14.5 }}><Link className="inline-link" href={`/children/${child.id}`}>{child.name}</Link>&apos;s device · {d.osVersion} · {d.model}</div>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              {state.key === "healthy" ? <StatusBadge status="healthy" /> : state.key === "offline" ? <StatusBadge status="offline" /> : null}
              {state.issues ? <StatusBadge status="issues" count={state.issues} /> : null}
              <span className="pill tone-muted">{platformName(d.platform)}</span>
              {d.simulated ? <span className="pill tone-accent" title="Driven by the development device simulator">Simulated</span> : null}
            </div>
          </div>
          <CheckButton deviceId={d.id} disabled={state.key === "offline"}><Icon name="scan-search" />Run Configuration Check</CheckButton>
        </section>
      </div>

      {offline ? (
        <div className="card card-pad row" style={{ background: "var(--warn-soft)", borderColor: "transparent" }}>
          <span className="ico-tile warn"><Icon name="wifi-off" /></span>
          <div className="grow"><div className="t-title">{d.lastSeenAt ? `This device hasn't synced since ${dayTime(d.lastSeenAt, tz)}` : "This device hasn't synced yet"}</div>
            <div className="t-meta" id="kv-stale" style={{ color: "var(--ink-2)" }}>Its protections keep working offline. eGuard verifies them again when it reconnects. Until then, the details below are what it last reported.</div></div>
        </div>
      ) : null}

      <dl className="kv" aria-describedby={offline ? "kv-stale" : undefined}>
        <div><dt>Last sync</dt><dd className="num">{dayTime(d.lastSeenAt, tz)}</dd></div>
        <div>
          <dt>Screen time today</dt>
          <dd className="num">{fmtMinutesPadded(childUsage._sum.minutes ?? 0)} / {fmtMinutes(limitOn(child, todayKey))}</dd>
          {child.devices.length > 1 ? <dd className="t-meta">{fmtMinutesPadded(usage?.minutes ?? 0)} on this device</dd> : null}
        </div>
        <div><dt>Bedtime</dt><dd>{reported("BEDTIME")}</dd></div>
        <div><dt>Location</dt><dd>{loc?.sharing ? <><Icon name="map-pin" />Sharing</> : <><Icon name="map-pin-off" />Off</>}</dd></div>
        <div><dt>App approval</dt><dd>{approvalOn ? <><Icon name="badge-check" />Required</> : reported("APP_APPROVAL")}</dd></div>
        <div><dt>Battery</dt><dd className="num">{d.battery != null ? `${d.battery}%` : "Unknown"}</dd></div>
      </dl>
      <div className="detail-grid">
        <section className="card card-pad">
          <div className="card-head"><div><h2>Protections on this device</h2><div className="sub">What {platformName(d.platform)} allows eGuard to do, and what&apos;s verified</div></div></div>
          {PROTECTIONS.map((p) => {
            const row = prot(p.key);
            const cap = p.caps[d.platform];
            const status = row?.status ?? "NOT_CONFIGURED";
            const tone = status === "PASS" ? "" : status === "UNSUPPORTED" || status === "NOT_CONFIGURED" ? "muted" : "warn";
            return (
              <div className="setting-row" key={p.key} style={{ flexWrap: "wrap" }}>
                <span className={`ico-tile ${tone}`}><Icon name={p.icon} /></span>
                <div className="grow" style={{ minWidth: 180 }}>
                  <div className="t-title">{p.name}</div>
                  <div className="t-meta"><Icon name={CAPABILITY_META[cap].icon} size={13} style={{ verticalAlign: -2 }} /> {CAPABILITY_META[cap].label} · {status === "NOT_CONFIGURED" ? "Not configured" : describeConfig(row?.reported)}{row?.lastVerifiedAt ? ` · checked ${dayTime(row.lastVerifiedAt, tz)}` : ""}</div>
                </div>
                <CheckBadge status={status} />
                {cap !== "UNSUPPORTED" ? <FlowButton protection={p.key} childId={child.id} className="btn btn-ghost btn-sm">Manage</FlowButton> : null}
              </div>
            );
          })}
        </section>
        <div className="dash-col">
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Recent requests</h2></div>
            {requests.length ? <Timeline items={requests.map((r) => ({
              id: r.id, icon: reqIcon[r.status] ?? "loader-circle",
              title: `${PROTECTION_BY_KEY[r.key].name}: ${reqLabel[r.status]}`, by: `${r.createdBy} · ${r.mode === "GUIDED" ? "Guided setup" : "Applied remotely"}`,
              time: dayTime(r.verifiedAt ?? r.createdAt, tz), to: describeConfig(r.desired),
            }))} /> : <p className="t-meta">No configuration requests yet.</p>}
            {lastCheck ? <p className="t-meta" style={{ marginTop: 10 }}>Last configuration check {dayTime(lastCheck.reportedAt, tz)}: {lastCheck.issues ? `${lastCheck.issues} to review` : "no issues found"}.</p> : null}
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2 style={{ fontSize: 18 }}>Device settings</h2></div>
            <RenameDeviceForm deviceId={d.id} name={d.name} />
            <dl className="kv" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", margin: "16px 0" }}>
              <div><dt>eGuard app</dt><dd>{d.appVersion ?? "Unknown"}</dd></div>
              <div><dt>Added</dt><dd>{dayTime(d.createdAt, tz)}</dd></div>
            </dl>
            <RemoveDeviceButton deviceId={d.id} name={d.name} />
          </section>
        </div>
      </div>
    </>
  );
}
