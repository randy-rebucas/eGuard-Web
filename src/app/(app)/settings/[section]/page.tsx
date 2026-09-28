import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { dayTime, peso, shortDate } from "@/lib/format";
import { Icon } from "@/components/icon";
import { Avatar, DeviceIcon } from "@/components/ui";
import {
  AccountForm, AddParentForm, DeleteAccountForm, PasswordForm, RemoveParentButton, SettingSwitch, SignOutOthersButton, UnlinkIdentityButton,
} from "@/components/forms";
import { BuyPlan, CancelAutoRenew } from "@/components/billing";
import { SECTIONS } from "../sections";
import { supportEmail } from "@/lib/support";
import { currentPurchase, refreshPurchases } from "@/lib/billing";
import { renewalWord } from "@/lib/entitlement";
import { webPrice, webProduct } from "@/lib/plans";
import { confirmReturn, passMethods, webBillingAvailable } from "@/lib/web-billing";

export async function generateMetadata(props: PageProps<"/settings/[section]">) {
  const { section } = await props.params;
  return { title: SECTIONS.find(([k]) => k === section)?.[1] ?? "Settings" };
}

export default async function SettingsSection(props: PageProps<"/settings/[section]">) {
  const { section } = await props.params;
  const meta = SECTIONS.find(([k]) => k === section);
  if (!meta) notFound();
  const u = await requireUser();
  const [user, family] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: u.id } }), getFamily(u.familyId)]);
  const tz = family.timezone;
  const admin = u.role === "FAMILY_ADMIN";
  const head = <div className="card-head"><h2>{meta[1]}</h2></div>;

  switch (section) {
    case "account": {
      const linkedSignIns = await db.oAuthIdentity.count({ where: { userId: u.id } });
      return (<>{head}<AccountForm name={user.name} email={user.email} timezone={tz} zones={timeZones(tz)} canSetTimezone={admin} hasPassword={user.passwordSet} linkedSignIns={linkedSignIns} /></>);
    }

    case "family": {
      const [members, graph] = await Promise.all([db.user.findMany({ where: { familyId: u.familyId }, orderBy: { createdAt: "asc" } }), getFamilyGraph(u.familyId)]);
      return (
        <>
          {head}
          {members.map((m) => (
            <div className="setting-row" key={m.id}>
              <Avatar name={m.name} hue={m.role === "FAMILY_ADMIN" ? 212 : 25} />
              <div className="grow"><div className="t-title">{m.name}{m.id === u.id ? " (you)" : ""}</div><div className="t-meta">{m.role === "FAMILY_ADMIN" ? "Family Admin" : "Parent"} · {m.email}</div></div>
              {admin && m.role === "PARENT" ? <RemoveParentButton userId={m.id} name={m.name.split(" ")[0]} /> : null}
            </div>
          ))}
          {graph.children.map((c) => (
            <div className="setting-row" key={c.id}>
              <Avatar name={c.name} hue={c.hue} />
              <div className="grow"><div className="t-title">{c.name}</div><div className="t-meta">Child · {c.age} years old · {c.devices.length} device{c.devices.length === 1 ? "" : "s"}</div></div>
              <Link className="link-btn" href={`/children/${c.id}`}>Open</Link>
            </div>
          ))}
          {admin ? (
            <>
              <hr className="divider" style={{ margin: "18px 0" }} />
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Add another parent</h3>
              <AddParentForm />
            </>
          ) : <p className="t-meta" style={{ marginTop: 14 }}>Only the family admin can add or remove parents.</p>}
        </>
      );
    }

    case "notifications":
      return (
        <>
          {head}
          <SettingSwitch setting="notifyPush" title="Push notifications" desc="Protection changes and devices that need attention" checked={user.notifyPush} />
          <SettingSwitch setting="notifyEmail" title="Email alerts" desc="Protection changes, devices that stop syncing, and anything that needs action" checked={user.notifyEmail} />
          <SettingSwitch setting="notifyApproval" title="App approval requests" desc="When a child asks to install an app" checked={user.notifyApproval} />
          <SettingSwitch setting="weeklySummary" title="Weekly summary" desc="Every Sunday at 6 PM" checked={user.weeklySummary} />
          <p className="t-meta" style={{ marginTop: 12 }}>Email alerts go to your verified email address. Push notifications and the weekly summary aren&apos;t sent yet; your choices are saved and apply once they are.</p>
        </>
      );

    case "privacy":
      return (
        <>
          {head}
          <SettingSwitch setting="keepLocationHistory" title="Keep location history" desc={family.keepLocationHistory ? "On: recent locations are kept for the retention period. Turning it off deletes the history already kept" : "Off: only the current location is stored"} checked={family.keepLocationHistory} disabled={!admin}
            confirmOff="This deletes every child's location history now. It can't be undone. Current locations keep working." />
          <SettingSwitch setting="shareAnalytics" title="Share anonymous product analytics" desc="Helps improve eGuard. Never includes children's data" checked={family.shareAnalytics} disabled={!admin} />
          <div className="setting-row"><div className="grow"><div className="t-title">What children can see</div><div className="t-meta">Children see which protections are on and can request more time or new apps</div></div></div>
          <div className="setting-row"><div className="grow"><div className="t-title">Data retention</div><div className="t-meta">Screen time, app usage, alerts, change history and location visits are deleted after {family.retentionDays} days</div></div><span className="pill tone-accent">{family.retentionDays} days</span></div>
          {!admin ? <p className="t-meta" style={{ marginTop: 12 }}>Only the family admin can change privacy settings.</p> : null}
        </>
      );

    case "security": {
      const [sessions, identities] = await Promise.all([
        db.session.findMany({ where: { userId: u.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
        db.oAuthIdentity.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }),
      ]);
      return (
        <>
          {head}
          <div className="setting-row"><div className="grow"><div className="t-title">Two-step verification</div><div className="t-meta">Not available yet. Sign-in currently uses your password only.</div></div><span className="pill tone-muted">Coming soon</span></div>
          <div className="setting-row" style={{ alignItems: "flex-start", flexDirection: "column" }}>
            <div className="t-title">Active sessions</div>
            {sessions.map((s) => (
              <div key={s.id} className="t-meta">{s.id === u.sessionId ? "This browser" : summarizeAgent(s.userAgent)} · last active {dayTime(s.lastSeenAt, tz)}</div>
            ))}
            {sessions.length > 1 ? <SignOutOthersButton /> : null}
          </div>
          <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div><div className="t-title">Password</div><div className="t-meta">{user.passwordSet ? `Last changed ${shortDate(user.passwordChangedAt, tz)}` : "Not set. You sign in with Apple or Google. To add a password, sign out and choose “Forgot password?”."}</div></div>
            {user.passwordSet ? <PasswordForm /> : null}
          </div>
          {identities.length ? (
            <div className="setting-row" style={{ alignItems: "flex-start", flexDirection: "column" }}>
              <div className="t-title">Sign in with Apple or Google</div>
              {identities.map((i) => (
                <div key={i.id} className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                  <span className="t-meta">{i.provider === "apple" ? "Apple" : "Google"}{i.email ? ` · ${i.email}` : ""} · linked {shortDate(i.createdAt, tz)}</span>
                  {user.passwordSet || identities.length > 1 ? <UnlinkIdentityButton identityId={i.id} provider={i.provider === "apple" ? "Apple" : "Google"} /> : null}
                </div>
              ))}
            </div>
          ) : null}
        </>
      );
    }

    case "subscription": {
      const { ref } = await props.searchParams;
      // Back from PayMongo: check the payment now instead of waiting for the webhook
      const returned = admin && typeof ref === "string" ? await confirmReturn(u.familyId, ref) : null;
      await refreshPurchases(u.familyId);
      const [fam, used, purchase] = await Promise.all([
        db.family.findUniqueOrThrow({ where: { id: u.familyId } }),
        db.device.count({ where: { familyId: u.familyId } }),
        currentPurchase(u.familyId),
      ]);
      const over = used > fam.deviceLimit;
      const pct = fam.deviceLimit > 0 ? Math.min(100, Math.round((used / fam.deviceLimit) * 100)) : 100;
      const paidUntil = purchase?.expiresAt ? shortDate(purchase.expiresAt, tz) : null;
      const how = !purchase ? null : purchase.store === "GOOGLE_PLAY" ? "Google Play" : webProduct(purchase.productId)?.autoRenew ? (purchase.autoRenewing ? "Auto-renew" : "Auto-renew off") : "Prepaid pass";
      const nextCharge = purchase?.autoRenewing ? webProduct(purchase.productId) : null;
      return (
        <>
          {head}
          {returned?.status === "paid" ? (
            <div className="form-ok" role="status" style={{ marginBottom: 16 }}><Icon name="circle-check" />Payment received. {returned.kind === "autorenew" ? "Auto-renew is on." : "Thank you!"} eGuard Family is active{returned.expiresAt ? ` until ${shortDate(returned.expiresAt, tz)}` : ""}.</div>
          ) : returned?.status === "pending" ? (
            <div className="verify-banner" role="status" style={{ marginBottom: 16 }}><Icon name="hourglass" /><p>We&apos;re waiting for PayMongo to confirm your payment. It usually takes a minute; reload this page to check. If it doesn&apos;t go through, you won&apos;t be charged.</p></div>
          ) : returned?.status === "failed" ? (
            <div className="form-error" role="alert" style={{ marginBottom: 16 }}><Icon name="triangle-alert" />The payment didn&apos;t go through, so nothing changed. You can try again below.</div>
          ) : null}
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            <span className="ico-tile" style={{ width: 52, height: 52 }}><Icon name="crown" /></span>
            <div className="grow">
              <div className="t-title" style={{ fontSize: 18 }}>{fam.plan}</div>
              <div className="t-meta">{fam.renewsAt ? `${renewalWord(purchase)} ${shortDate(fam.renewsAt, tz)}` : "No renewal date"} · up to {fam.deviceLimit} devices{how ? ` · ${how}` : ""}</div>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="t-meta">Devices</span><span className="t-meta num" style={over ? { color: "var(--warn-ink)" } : undefined}>{used} of {fam.deviceLimit}</span></div>
            <div className="meter" role="meter" aria-label="Devices used" aria-valuemin={0} aria-valuemax={fam.deviceLimit} aria-valuenow={used}><span style={{ width: `${pct}%`, ...(over ? { background: "var(--warn)" } : {}) }} /></div>
            {over ? <p className="t-meta" style={{ marginTop: 8 }}>{used - fam.deviceLimit} more than your plan covers. They stay protected; remove some or change your plan to add more.</p> : null}
          </div>
          <hr className="divider" style={{ margin: "20px 0" }} />
          {!admin ? (
            <p className="t-meta">Only the family admin can change the plan.</p>
          ) : purchase?.store === "GOOGLE_PLAY" ? (
            <p className="t-meta">Your plan is billed through Google Play. Change or cancel it in the Play Store app.</p>
          ) : !webBillingAvailable() ? (
            <p className="t-meta">Online payment isn&apos;t available yet. To change your plan, contact <a className="link-btn" href={`mailto:${supportEmail()}`}>{supportEmail()}</a>.</p>
          ) : purchase?.autoRenewing && nextCharge ? (
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div><div className="t-title">Auto-renew is on</div><div className="t-meta">{purchase.state === "past_due" ? "The last renewal payment failed. PayMongo will try again; check your card or Maya balance." : `Next charge ${peso(webPrice(nextCharge.interval))} on ${paidUntil}.`}</div></div>
              <CancelAutoRenew endsOn={paidUntil ?? "the end of this period"} />
            </div>
          ) : (
            <BuyPlan
              prices={{ month: webPrice("month"), year: webPrice("year") }}
              methods={passMethodLabel()}
              payer={{ name: user.name, email: user.email }}
              autoRenewBlocked={purchase && paidUntil ? `Available once your paid time ends on ${paidUntil}.` : null}
            />
          )}
        </>
      );
    }

    case "devices": {
      const graph = await getFamilyGraph(u.familyId);
      return (
        <>
          {head}
          {graph.devices.map((d) => (
            <div className="setting-row" key={d.id}>
              <span className="ico-tile"><DeviceIcon kind={d.kind} /></span>
              <div className="grow"><div className="t-title">{d.name}</div><div className="t-meta">{d.child.name} · {d.osVersion} · synced {dayTime(d.lastSeenAt, tz)}</div></div>
              <Link className="link-btn" href={`/devices/${d.id}`}>Open</Link>
            </div>
          ))}
          <Link className="btn btn-secondary" style={{ marginTop: 14 }} href="/devices#pair"><Icon name="plus" />Pair a device</Link>
        </>
      );
    }

    case "integrations": {
      const graph = await getFamilyGraph(u.familyId);
      const android = graph.devices.filter((d) => d.platform === "ANDROID").length, ios = graph.devices.filter((d) => d.platform === "IOS").length;
      return (
        <>
          {head}
          <div className="setting-row"><span className="ico-tile"><Icon name="smartphone" /></span><div className="grow"><div className="t-title">Android device management</div><div className="t-meta">eGuard Android app with device admin permissions</div></div><span className={`pill ${android ? "tone-accent" : "tone-muted"}`}>{android ? `${android} paired` : "No devices"}</span></div>
          <div className="setting-row"><span className="ico-tile"><Icon name="tablet-smartphone" /></span><div className="grow"><div className="t-title">Apple Screen Time (Family Controls)</div><div className="t-meta">eGuard iOS app authorized through Family Sharing</div></div><span className={`pill ${ios ? "tone-accent" : "tone-muted"}`}>{ios ? `${ios} paired` : "No devices"}</span></div>
          <p className="t-meta" style={{ marginTop: 12 }}>Whether each protection is actually active on a device is checked on the <Link className="link-btn" href="/protection">Protection</Link> page.</p>
        </>
      );
    }

    case "data":
      return (
        <>
          {head}
          <div className="setting-row"><div className="grow"><div className="t-title">Export family data</div><div className="t-meta">Settings, children, devices, configuration history and activity summaries as JSON</div></div><form method="post" action="/api/account/export"><button className="btn btn-secondary btn-sm"><Icon name="download" />Download</button></form></div>
          <div className="setting-row"><div className="grow"><div className="t-title">Delete a child&apos;s data</div><div className="t-meta">Open the child&apos;s page, then Profile. Needs your password.</div></div><Link className="btn btn-secondary btn-sm" href="/children">Choose child</Link></div>
          <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div><div className="t-title">Delete your account</div><div className="t-meta">{admin ? "Deletes your family and everything eGuard stores about it." : "Removes you from the family. The family admin keeps the family."}</div></div>
            <DeleteAccountForm isAdmin={admin} hasPassword={user.passwordSet} />
          </div>
        </>
      );

    case "support":
      return (
        <>
          {head}
          <div className="setting-row"><span className="ico-tile"><Icon name="book-open" /></span><div className="grow"><div className="t-title">Setup guides</div><div className="t-meta">Step-by-step help for Android and iOS is built into each guided setup</div></div></div>
          <div className="setting-row"><span className="ico-tile"><Icon name="message-circle" /></span><div className="grow"><div className="t-title">Contact support</div><div className="t-meta"><a className="link-btn" href={`mailto:${supportEmail()}`}>{supportEmail()}</a> · replies within 1 business day</div></div></div>
        </>
      );
  }
  notFound();
}

/**
 * Zones for the picker, always including the family's own. The runtime's list leaves out "UTC" and uses
 * older names ("Asia/Calcutta", not "Asia/Kolkata"), while phones send the modern ones. A zone missing
 * from the list would leave the select on its first option, and saving would move the family there.
 */
function timeZones(current: string) {
  const zones = Intl.supportedValuesOf("timeZone");
  return [...new Set([current, "UTC", ...zones])].sort((a, b) => (a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b)));
}

const METHOD_NAMES: Record<string, string> = {
  gcash: "GCash", paymaya: "Maya", card: "card", qrph: "QR Ph", grab_pay: "GrabPay", shopee_pay: "ShopeePay", billease: "BillEase", dob: "online banking", brankas: "online banking",
};

/** "GCash, Maya, card or QR Ph" */
function passMethodLabel() {
  const names = [...new Set(passMethods().map((m) => METHOD_NAMES[m] ?? m))];
  const text = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0] ?? "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function summarizeAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}
