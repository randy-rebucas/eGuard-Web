import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateFromKey, dayKey, getFamily, getFamilyGraph } from "@/lib/queries";
import { dayTime } from "@/lib/format";
import { CAPABILITY_META, PROTECTIONS, describeConfig, fmtMinutes, fmtMinutesPadded } from "@/lib/protections";
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
  const family = await getFamily(u.familyId);
  const tz = family.timezone;
  const graph = await getFamilyGraph(u.familyId);
  const d = graph.devices.find((x) => x.id === id);
  if (!d) notFound();
  const child = graph.children.find((c) => c.id === d.childId)!;
  const state = graph.deviceStates[d.id];
  const today = dateFromKey(dayKey(new Date(), tz));
  const [usage, requests, lastCheck] = await Promise.all([
    db.screenTimeDaily.findUnique({ where: { deviceId_date: { deviceId: d.id, date: today } } }),
    db.configRequest.findMany({ where: { deviceId: d.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.checkRunResult.findFirst({ where: { deviceId: d.id, reportedAt: { not: null } }, orderBy: { reportedAt: "desc" } }),
  ]);
  const prot = (key: string) => d.protections.find((p) => p.key === key);
  const bedtime = prot("BEDTIME");
  const loc = d.location;
  const approval = prot("APP_APPROVAL");
  const reqLabel: Record<string, string> = { PENDING: "Waiting for device", AWAITING_PARENT: "Waiting for guided setup", DELIVERED: "Delivered, not yet verified", VERIFIED: "Verified", FAILED: "Didn't match", CANCELLED: "Cancelled" };

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
              {state.key === "healthy" ? <StatusBadge status="protected" /> : state.key === "offline" ? <StatusBadge status="offline" /> : <StatusBadge status="issues" count={state.issues} />}
              <span className="pill tone-muted">{platformName(d.platform)}</span>
              {d.simulated ? <span className="pill tone-accent" title="Driven by the development device simulator">Simulated</span> : null}
            </div>
          </div>
          <CheckButton deviceId={d.id} disabled={state.key === "offline"}><Icon name="scan-search" />Run Configuration Check</CheckButton>
        </section>
      </div>

      {state.key === "offline" ? (
        <div className="card card-pad row" style={{ background: "var(--warn-soft)", borderColor: "transparent" }}>
          <span className="ico-tile warn"><Icon name="wifi-off" /></span>
          <div className="grow"><div className="t-title">This device hasn&apos;t synced since {dayTime(d.lastSeenAt, tz)}</div>
            <div className="t-meta" style={{ color: "var(--ink-2)" }}>Its protections keep working offline. eGuard verifies them again when it reconnects.</div></div>
        </div>
      ) : null}

      <dl className="kv">
        <div><dt>Last sync</dt><dd className="num">{dayTime(d.lastSeenAt, tz)}</dd></div>
        <div><dt>Screen time today</dt><dd className="num">{fmtMinutesPadded(usage?.minutes ?? 0)} / {fmtMinutes(child.dailyLimitMinutes)}</dd></div>
        <div><dt>Bedtime</dt><dd>{bedtime?.status === "NOT_CONFIGURED" ? "Not configured" : describeConfig(bedtime?.reported)}</dd></div>
        <div><dt>Location</dt><dd>{loc?.sharing ? <><Icon name="map-pin" />Sharing</> : <><Icon name="map-pin-off" />Off</>}</dd></div>
        <div><dt>App approval</dt><dd><Icon name="badge-check" />{describeConfig(approval?.reported) === "Approval required" ? "Enabled" : "Off"}</dd></div>
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
              id: r.id, icon: r.status === "VERIFIED" ? "circle-check" : r.status === "FAILED" ? "triangle-alert" : "loader-circle",
              title: `${PROTECTIONS.find((p) => p.key === r.key)?.name}: ${reqLabel[r.status]}`, by: `${r.createdBy} · ${r.mode === "GUIDED" ? "Guided setup" : "Applied remotely"}`,
              time: dayTime(r.verifiedAt ?? r.createdAt, tz), to: describeConfig(r.desired),
            }))} /> : <p className="t-meta">No configuration requests yet.</p>}
            {lastCheck ? <p className="t-meta" style={{ marginTop: 10 }}>Last configuration check {dayTime(lastCheck.reportedAt, tz)}: {lastCheck.issues ? `${lastCheck.issues} to review` : "all verified"}.</p> : null}
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
