import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyGraph, getOpenChanges } from "@/lib/queries";
import { listBrowsers } from "@/lib/browser-service";
import { browserStatus } from "@/components/cards";
import { entitlementsFor } from "@/lib/plans";
import { LOCATION_UPGRADE } from "@/lib/plan-access";
import { dayTime } from "@/lib/format";
import { CAPABILITY_META, CHECK_META, PROTECTIONS, describeConfig, type Capability } from "@/lib/protections";
import { isOffline, isPassing } from "@/lib/health";
import { Icon } from "@/components/icon";
import { CapabilityChip, CheckBadge, HealthRing, PageHead, UpgradeNote } from "@/components/ui";
import { CheckButton, FlowButton } from "@/components/flow";

export const metadata = { title: "Protection" };

export default async function ProtectionPage() {
  const u = await requireUser();
  const [family, { familyHealth: h, children, devices, deviceStates }, changes, browsers] = await Promise.all([
    getFamily(u.familyId),
    getFamilyGraph(u.familyId),
    getOpenChanges(u.familyId),
    listBrowsers(u.familyId),
  ]);
  const tz = family.timezone;
  const locationSharing = entitlementsFor(family.plan).locationSharing;
  const open = h.checks.filter((c) => !isPassing(c.status));
  const isOff = (d: (typeof devices)[number]) => deviceStates[d.id].key === "offline";
  const offline = devices.filter(isOff);
  // Same rule as computeHealth: a device with no row for a protection counts as NOT_CONFIGURED
  const statusOn = (d: (typeof devices)[number], key: string) => d.protections.find((x) => x.key === key)?.status ?? "NOT_CONFIGURED";
  // Health only covers paired devices: a child without one has nothing checked, so "every protection" mustn't include them
  const unpaired = children.filter((c) => !c.devices.length);
  const unpairedText = unpaired.length > 3 ? `${unpaired.slice(0, 3).map((c) => c.name).join(", ")} and ${unpaired.length - 3} more` : unpaired.map((c) => c.name).join(" and ");
  // Never "verified" while a device is offline (see computeHealth)
  const headline = !devices.length ? "No devices to check yet"
    : h.verified ? (unpaired.length ? "Verified on every paired device" : "Every protection is verified")
    : h.score === h.total ? "Every protection is set, as last reported"
    : open.length === 1 ? "One protection needs review" : `${open.length} protections need review`;
  // The latest device report, same source as each card's "Last checked". A check run isn't used: it may have
  // covered one device, or ended with no device answering.
  const lastVerified = devices.flatMap((d) => d.protections).reduce<Date | null>((m, p) => (p.lastVerifiedAt && (!m || p.lastVerifiedAt > m) ? p.lastVerifiedAt : m), null);
  const offlineNames = offline.map((d) => `${d.child.name}'s ${d.name}`);
  const offlineText = offlineNames.length > 3 ? `${offlineNames.slice(0, 3).join(", ")} and ${offlineNames.length - 3} more` : offlineNames.join(", ");

  return (
    <>
      <PageHead title="Protection" text="Configuration Health tells you whether each protection is set up and verified on your children's devices. It measures configuration, not your children's behavior.">
        {devices.length ? <CheckButton><Icon name="scan-search" />Run Configuration Check</CheckButton> : <Link className="btn btn-primary" href="/devices#pair"><Icon name="plus" />Pair a device</Link>}
      </PageHead>

      <section className="card card-pad" aria-labelledby="ch-title">
        <div className="health" style={{ flexWrap: "wrap" }}>
          <HealthRing score={h.score} total={h.total} empty={!devices.length} />
          <div className="grow" style={{ minWidth: 240 }}>
            <div className="eyebrow">Configuration Health</div>
            <h2 id="ch-title" style={{ fontSize: 26, marginTop: 4 }}>{headline}</h2>
            {devices.length ? (
              <p className="muted" style={{ marginTop: 6 }}>
                {devices.length} device{devices.length === 1 ? "" : "s"}, {lastVerified ? `last checked ${dayTime(lastVerified, tz)}` : "not checked yet"}.
                {offline.length ? ` ${offlineText} ${offline.length === 1 ? "is" : "are"} offline and keep${offline.length === 1 ? "s" : ""} the last known state.` : ""}
                {changes.length ? ` ${changes.length === 1 ? "One change is" : `${changes.length} changes are`} waiting for a device to confirm.` : ""}
                {unpaired.length ? <>{` ${unpairedText} ${unpaired.length === 1 ? "has" : "have"} no paired device, so nothing is checked for ${unpaired.length === 1 ? "them" : "those children"} yet. `}
                  <Link className="link-btn" href={unpaired.length === 1 ? `/devices?child=${unpaired[0].id}#pair` : "/devices#pair"}>Pair a device <Icon name="arrow-right" /></Link></> : null}
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 6 }}>
                Pair a child&apos;s device to start verifying protections. <Link className="link-btn" href="/devices#pair">Add a device <Icon name="arrow-right" /></Link>
              </p>
            )}
            <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 14 }} role="group" aria-label="Status legend">
              {(Object.keys(CHECK_META) as (keyof typeof CHECK_META)[]).map((k) => <CheckBadge key={k} status={k} />)}
            </div>
          </div>
        </div>
        <hr className="divider" style={{ margin: "22px 0 18px" }} />
        <div className="check-list">
          {[...open, ...h.checks.filter((c) => isPassing(c.status))].map((ch) => {
            const inner = (
              <>
                <span className={`ico-tile ${CHECK_META[ch.status].tone === "ok" ? "ok" : CHECK_META[ch.status].tone}`}><Icon name={ch.icon} /></span>
                <span className="grow">
                  <span className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span className="t-title">{ch.name}</span><CheckBadge status={ch.status} /></span>
                  <span className="t-meta" style={{ display: "block", marginTop: 4 }}>{ch.detail}</span>
                  {ch.fixChildId ? <span className="link-btn" style={{ marginTop: 4 }}>Fix this <Icon name="arrow-right" /></span> : null}
                </span>
              </>
            );
            return ch.fixChildId
              ? <FlowButton key={ch.key} protection={ch.key} childId={ch.fixChildId} className="check-item">{inner}</FlowButton>
              : <div key={ch.key} className="check-item">{inner}</div>;
          })}
        </div>
      </section>

      <section>
        <div className="section-title"><h2>Protection settings</h2></div>
        <div className="prot-grid">
          {PROTECTIONS.map((p) => {
            const ch = h.checks.find((c) => c.key === p.key)!;
            const failing = devices.filter((d) => !isPassing(statusOn(d, p.key)));
            const lastKnown = devices.some((d) => isOff(d) && statusOn(d, p.key) !== "UNSUPPORTED");
            const values = [...new Set(children.map((c) => describeConfig(c.policies.find((x) => x.key === p.key)?.config)))];
            const checked = devices.flatMap((d) => d.protections.filter((x) => x.key === p.key)).reduce<Date | null>((m, x) => (x.lastVerifiedAt && (!m || x.lastVerifiedAt > m) ? x.lastVerifiedAt : m), null);
            return (
              <article className="card prot" key={p.key} id={p.slug}>
                <div className="row prot-head">
                  <span className="ico-tile"><Icon name={p.icon} /></span>
                  <div className="grow"><h3 style={{ fontSize: 16 }}>{p.name}</h3></div>
                  {!devices.length
                    ? <span className="pill">No devices</span>
                    : isPassing(ch.status)
                    ? <span className="pill tone-ok"><Icon name="circle-check" />{ch.status === "UNSUPPORTED" ? "Not applicable" : lastKnown ? "Last known: verified" : "Verified"}</span>
                    : <span className="pill tone-warn"><Icon name="triangle-alert" />{failing.length} device{failing.length === 1 ? "" : "s"} to review</span>}
                </div>
                <div className="p-value">{values.length === 1 ? values[0] : values.length ? "Varies by child" : "No children yet"}</div>
                {values.length > 1 ? <div className="t-meta">{children.map((c) => `${c.name}: ${describeConfig(c.policies.find((x) => x.key === p.key)?.config)}`).join(" · ")}</div> : null}
                {/* The value above changes only once a device confirms: say what's on its way */}
                {changes.filter((w) => w.key === p.key).map((w) => {
                  const name = children.find((c) => c.id === w.childId)?.name;
                  const waitingOn = w.devices.some((d) => d.awaitingParent) ? "waiting for you to finish the setup steps"
                    : `waiting for ${w.devices.map((d) => d.name).join(" and ")}${w.devices.every((d) => isOffline(d)) ? " to come online" : " to confirm"}`;
                  return (
                    <div key={w.childId} className="form-ok" style={{ marginTop: 8 }}>
                      <Icon name="loader-circle" />
                      <span className="grow">{children.length > 1 ? `${name}: ` : ""}changing to <b>{describeConfig(w.desired)}</b>, {waitingOn}.</span>
                      <FlowButton protection={p.key} childId={w.childId} className="link-btn">Check progress</FlowButton>
                    </div>
                  );
                })}
                {/* Browsers filter websites by their own rules (the child's Browser tab) and report their own health */}
                {p.key === "WEB" && browsers.length ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="t-meta">Browsers follow their own rules and aren&apos;t counted here:</div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "grid", gap: 6 }}>
                      {browsers.map((b) => {
                        const [tone, label] = browserStatus(b);
                        return (
                          <li key={b.id} className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <Link className="link-btn" href={`/children/${b.childId}?tab=browser`}>{b.browser} on {b.deviceLabel}{children.length > 1 ? ` · ${b.child.name}` : ""}</Link>
                            <span className={`pill ${tone}`}>{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {/* The device can share, but the server drops locations on this plan: don't let "Sharing" imply parents see it */}
                {p.key === "LOCATION" && !locationSharing ? <UpgradeNote compact title="" text={LOCATION_UPGRADE} /> : null}
                <div className="caps">
                  <CapabilityChip cap={p.caps.ANDROID} platform="Android" />
                  <CapabilityChip cap={p.caps.IOS} platform="iOS" />
                </div>
                <div className="prot-foot">
                  <div className="t-meta">Last checked<br /><span className="num" style={{ color: "var(--ink-2)", fontWeight: 600 }}>{dayTime(checked, tz)}</span></div>
                  <FlowButton protection={p.key} childId={ch.fixChildId}>{failing.length ? "Review" : "Manage"}</FlowButton>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card card-pad">
        <div className="card-head"><div><h2>How platform support works</h2><div className="sub">Android and iOS give eGuard different levels of control. The setup always tells you which applies.</div></div></div>
        <div className="check-list" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
          {(Object.keys(CAPABILITY_META) as Capability[]).map((k) => {
            const m = CAPABILITY_META[k];
            const cls = { AVAILABLE: "available", GUIDED: "guided", VERIFY_ONLY: "verify", UNSUPPORTED: "unsupported" }[k];
            return <div key={k} className={`cap ${cls}`} style={{ padding: 14 }}><b><Icon name={m.icon} />{m.label}</b><span className="t-meta">{m.description}</span></div>;
          })}
        </div>
      </section>
    </>
  );
}
