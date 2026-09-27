import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { dayTime, shortDate } from "@/lib/format";
import { Icon } from "@/components/icon";
import { Avatar, DeviceIcon } from "@/components/ui";
import { ToastButton } from "@/components/flow";
import {
  AccountForm, AddParentForm, DeleteAccountForm, PasswordForm, RemoveParentButton, SettingSwitch, SignOutOthersButton, UnlinkIdentityButton,
} from "@/components/forms";
import { SECTIONS } from "../sections";
import { supportEmail } from "@/lib/support";

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
    case "account":
      return (<>{head}<AccountForm name={user.name} email={user.email} timezone={tz} zones={Intl.supportedValuesOf("timeZone")} canSetTimezone={admin} hasPassword={user.passwordSet} /></>);

    case "family": {
      const [members, graph] = await Promise.all([db.user.findMany({ where: { familyId: u.familyId }, orderBy: { createdAt: "asc" } }), getFamilyGraph(u.familyId)]);
      return (
        <>
          {head}
          {members.map((m) => (
            <div className="setting-row" key={m.id}>
              <span className="avatar" style={{ ["--h" as string]: m.role === "FAMILY_ADMIN" ? 212 : 25 }}>{m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
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
          <SettingSwitch setting="keepLocationHistory" title="Keep location history" desc={family.keepLocationHistory ? "On: recent locations are kept for the retention period" : "Off: only the current location is stored"} checked={family.keepLocationHistory} disabled={!admin} />
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
      const used = await db.device.count({ where: { familyId: u.familyId } });
      const pct = Math.round((used / family.deviceLimit) * 100);
      return (
        <>
          {head}
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            <span className="ico-tile" style={{ width: 52, height: 52 }}><Icon name="crown" /></span>
            <div className="grow"><div className="t-title" style={{ fontSize: 18 }}>{family.plan}</div><div className="t-meta">{family.renewsAt ? `Renews ${shortDate(family.renewsAt, tz)}` : "No renewal date"} · up to {family.deviceLimit} devices</div></div>
            <ToastButton className="btn btn-secondary" message="Upgrade or manage your plan in the eGuard app for Android (Settings › Subscription). Web and iPhone billing are coming soon.">Change plan</ToastButton>
          </div>
          <div style={{ marginTop: 20 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="t-meta">Devices</span><span className="t-meta num">{used} of {family.deviceLimit}</span></div>
            <div className="meter"><span style={{ width: `${pct}%` }} /></div>
          </div>
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
          <div className="setting-row"><span className="ico-tile"><Icon name="smartphone" /></span><div className="grow"><div className="t-title">Android device management</div><div className="t-meta">eGuard Android app with device admin permissions · {android} device{android === 1 ? "" : "s"}</div></div>{android ? <span className="pill tone-ok"><Icon name="circle-check" />Connected</span> : <span className="pill tone-muted">No devices</span>}</div>
          <div className="setting-row"><span className="ico-tile"><Icon name="tablet-smartphone" /></span><div className="grow"><div className="t-title">Apple Screen Time (Family Controls)</div><div className="t-meta">eGuard iOS app authorized through Family Sharing · {ios} device{ios === 1 ? "" : "s"}</div></div>{ios ? <span className="pill tone-ok"><Icon name="circle-check" />Authorized</span> : <span className="pill tone-muted">No devices</span>}</div>
          <div className="setting-row"><span className="ico-tile"><Icon name="plug" /></span><div className="grow"><div className="t-title">Device API</div><div className="t-meta">Mobile apps sync through <code>/api/device/v1</code>. See the README for the contract.</div></div></div>
        </>
      );
    }

    case "data":
      return (
        <>
          {head}
          <div className="setting-row"><div className="grow"><div className="t-title">Export family data</div><div className="t-meta">Settings, children, devices, configuration history and activity summaries as JSON</div></div><a className="btn btn-secondary btn-sm" href="/api/account/export" download><Icon name="download" />Download</a></div>
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

function summarizeAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}
