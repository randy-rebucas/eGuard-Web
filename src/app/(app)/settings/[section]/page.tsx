import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { usedDeviceSlots } from "@/lib/device-slots";
import { browserLabel, listBrowsers } from "@/lib/browser-service";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { ageLabel, dayTime, peso, shortDate } from "@/lib/format";
import { Icon } from "@/components/icon";
import { Avatar, DeviceIcon } from "@/components/ui";
import {
  AccountForm, AddParentForm, DeleteAccountForm, PasswordForm, PendingInviteActions, RemoveParentButton, SettingSwitch, SignOutOthersButton, UnlinkIdentityButton,
} from "@/components/forms";
import { pendingInvites } from "@/lib/invitations";
import { BuyPlan, CancelAutoRenew } from "@/components/billing";
import { CreateOrgForm, JoinOrgForm, LeaveOrgButton, RedeemCodeForm } from "@/components/organizations";
import { ORG_KINDS, VOUCHER_STORE, familyOrganizations, managedOrganizations, sponsorOf } from "@/lib/organizations";
import { SECTIONS } from "../sections";
import { supportEmail } from "@/lib/support";
import { currentPurchase, refreshPurchases } from "@/lib/billing";
import { renewalWord } from "@/lib/entitlement";
import { PLANS, entitlementsFor, planByName, planByProduct, webPrice, webProduct } from "@/lib/plans";
import { LOCATION_UPGRADE, planWith } from "@/lib/plan-access";
import { confirmReturn, passMethods, webBillingAvailable } from "@/lib/web-billing";
import { status as twoFactorStatus } from "@/lib/two-factor";
import { pushAvailable } from "@/lib/push";
import { TwoStepSettings } from "@/components/two-step";

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
  const plan = entitlementsFor(family.plan);
  const head = <div className="card-head"><h2>{meta[1]}</h2></div>;

  switch (section) {
    case "account": {
      const linkedSignIns = await db.oAuthIdentity.count({ where: { userId: u.id } });
      return (<>{head}<AccountForm name={user.name} email={user.email} timezone={tz} zones={timeZones(tz)} canSetTimezone={admin} hasPassword={user.passwordSet} linkedSignIns={linkedSignIns} /></>);
    }

    case "family": {
      const [members, graph, invites] = await Promise.all([
        db.user.findMany({ where: { familyId: u.familyId }, orderBy: { createdAt: "asc" } }), getFamilyGraph(u.familyId), pendingInvites(u.familyId),
      ]);
      const inviteNote = (id: string) => {
        const until = invites.get(id);
        return until && until > new Date() ? `Invited, hasn't accepted yet · link expires ${shortDate(until, tz)}` : "Invited · the link expired, resend it";
      };
      return (
        <>
          {head}
          {members.map((m) => (
            <div className="setting-row" key={m.id}>
              <Avatar name={m.name} hue={m.role === "FAMILY_ADMIN" ? 212 : 25} />
              <div className="grow">
                <div className="t-title">{m.name}{m.id === u.id ? " (you)" : ""}</div>
                <div className="t-meta">{invites.has(m.id) ? inviteNote(m.id) : m.role === "FAMILY_ADMIN" ? "Family Admin" : "Parent"} · {m.email}</div>
              </div>
              {admin && m.role === "PARENT"
                ? invites.has(m.id) ? <PendingInviteActions userId={m.id} name={m.name.split(" ")[0]} /> : <RemoveParentButton userId={m.id} name={m.name.split(" ")[0]} />
                : null}
            </div>
          ))}
          {graph.children.map((c) => (
            <div className="setting-row" key={c.id}>
              <Avatar name={c.name} hue={c.hue} />
              <div className="grow"><div className="t-title">{c.name}</div><div className="t-meta">Child · {ageLabel(c.age)} · {c.devices.length} device{c.devices.length === 1 ? "" : "s"}</div></div>
              <Link className="link-btn" href={`/children/${c.id}`}>Open</Link>
            </div>
          ))}
          {admin ? (
            <>
              <hr className="divider" style={{ margin: "18px 0" }} />
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Invite another parent</h3>
              <AddParentForm />
            </>
          ) : <p className="t-meta" style={{ marginTop: 14 }}>Only the family admin can add or remove parents.</p>}
        </>
      );
    }

    case "organizations": {
      const [joined, managed] = await Promise.all([familyOrganizations(u.familyId), managedOrganizations(u.id)]);
      return (
        <>
          {head}
          <p className="t-meta" style={{ marginTop: -6 }}>Schools, community groups and businesses can support families who use eGuard. An organization only ever sees how many families joined, never anything about yours.</p>
          <h3 className="org-sub">Your family&apos;s organizations</h3>
          {joined.map((o) => (
            <div className="setting-row" key={o.id}>
              <span className="ico-tile"><Icon name="building" /></span>
              <div className="grow"><div className="t-title">{o.name}</div><div className="t-meta">{ORG_KINDS[o.kind as keyof typeof ORG_KINDS] ?? o.kind} · joined {shortDate(o.joinedAt, tz)}</div></div>
              {admin ? <LeaveOrgButton orgId={o.id} name={o.name} /> : null}
            </div>
          ))}
          {joined.length ? null : <p className="t-meta">Your family hasn&apos;t joined an organization.</p>}
          {admin ? (
            <div className="dash-col" style={{ gap: 8, marginTop: 16 }}>
              <div><div className="t-title">Join with a code</div><div className="t-meta">Enter the code your school, community group or employer gave you.</div></div>
              <JoinOrgForm />
            </div>
          ) : <p className="t-meta" style={{ marginTop: 12 }}>Only the family admin can join or leave an organization. You&apos;ll get an alert when they do.</p>}

          <hr className="divider" style={{ margin: "24px 0 8px" }} />
          <h3 className="org-sub">Organizations you manage</h3>
          {managed.map((o) => (
            <div className="setting-row" key={o.id}>
              <span className="ico-tile"><Icon name={o.kind === "SCHOOL" ? "school" : o.kind === "BUSINESS" ? "briefcase" : "users"} /></span>
              <div className="grow"><div className="t-title">{o.name}</div><div className="t-meta">{ORG_KINDS[o.kind]} · {o.role === "OWNER" ? "Owner" : "Admin"} · {o.families} {o.families === 1 ? "family" : "families"} joined</div></div>
              <Link className="link-btn" href={`/organizations/${o.id}`}>Open</Link>
            </div>
          ))}
          {managed.length ? (
            <p className="t-meta" style={{ marginTop: 8 }}>
              We email you when admins or the join code change, when codes are paid for, refunded or close to their redeem-by date, and once a day with how many families joined or left and codes were used. Those emails never say which families.
            </p>
          ) : null}
          <div className="dash-col" style={{ gap: 12, marginTop: managed.length ? 16 : 4 }}>
            <div><div className="t-title">Create an organization</div><div className="t-meta">For a school, community group or business that wants to help families: share a join code, and buy sponsor codes that pay for families&apos; plans.</div></div>
            <CreateOrgForm />
          </div>
        </>
      );
    }

    case "notifications": {
      const push = pushAvailable();
      return (
        <>
          {head}
          <SettingSwitch setting="notifyPush" title="Push notifications"
            desc={!plan.realtimeAlerts ? `Push alerts are included with ${planWith((e) => e.realtimeAlerts).name}. Alerts still show in eGuard and by email.`
              : push ? "Protection changes, devices that need attention and children's requests, on phones signed in to the eGuard app"
              : "Protection changes and devices that need attention"}
            checked={user.notifyPush && plan.realtimeAlerts} disabled={!plan.realtimeAlerts} />
          <SettingSwitch setting="notifyEmail" title="Email alerts" desc="Protection changes, devices that stop syncing, anything that needs action, and organization activity" checked={user.notifyEmail} />
          <SettingSwitch setting="notifyApproval" title="App approval requests" desc="When a child asks for an app or a blocked website. Sent by email and push, for whichever of those is on." checked={user.notifyApproval} />
          <SettingSwitch setting="weeklySummary" title="Weekly summary" desc="Every Sunday at 6 PM" checked={user.weeklySummary} />
          <p className="t-meta" style={{ marginTop: 12 }}>
            Email alerts go to your verified email address.{" "}
            {push ? "The weekly summary isn't sent yet; your choice is saved and applies once it is." : "Push notifications and the weekly summary aren't sent yet; your choices are saved and apply once they are."}
          </p>
        </>
      );
    }

    case "privacy":
      return (
        <>
          {head}
          <SettingSwitch setting="keepLocationHistory" title="Keep location history" desc={!plan.locationSharing ? LOCATION_UPGRADE : family.keepLocationHistory ? "On: recent locations are kept for the retention period. Turning it off deletes the history already kept" : "Off: only the current location is stored"} checked={family.keepLocationHistory} disabled={!admin || (!plan.locationSharing && !family.keepLocationHistory)}
            confirmOff="This deletes every child's location history now. It can't be undone. Current locations keep working." />
          <SettingSwitch setting="shareAnalytics" title="Share anonymous product analytics" desc="Helps improve eGuard. Never includes children's data" checked={family.shareAnalytics} disabled={!admin} />
          <div className="setting-row"><div className="grow"><div className="t-title">What children can see</div><div className="t-meta">Children see which protections are on, and can ask you for new apps and for blocked websites</div></div></div>
          <div className="setting-row"><div className="grow"><div className="t-title">Data retention</div><div className="t-meta">Screen time, app usage, alerts, change history and location visits are deleted after {family.retentionDays} days</div></div><span className="pill tone-accent">{family.retentionDays} days</span></div>
          {!admin ? <p className="t-meta" style={{ marginTop: 12 }}>Only the family admin can change privacy settings.</p> : null}
        </>
      );

    case "security": {
      const [sessions, identities, twoStep, { recovery }] = await Promise.all([
        db.session.findMany({ where: { userId: u.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
        db.oAuthIdentity.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }),
        twoFactorStatus(u.id),
        props.searchParams,
      ]);
      // Just signed in with a recovery code (see verifySecondStep)
      const recoveryLeft = typeof recovery === "string" && /^\d+$/.test(recovery) ? Number(recovery) : null;
      return (
        <>
          {head}
          {recoveryLeft !== null && twoStep.enabled ? (
            <div className="verify-banner" role="status" style={{ marginBottom: 12 }}><Icon name="key-round" /><p>You signed in with a recovery code, so it no longer works. {recoveryLeft} {recoveryLeft === 1 ? "code is" : "codes are"} left.{recoveryLeft <= 2 ? " Make new ones below, and check your authenticator app is set up on your phone." : ""}</p></div>
          ) : null}
          <div className="setting-row">
            {twoStep.available || twoStep.enabled
              ? <TwoStepSettings enabled={twoStep.enabled} recoveryCodesLeft={twoStep.recoveryCodesLeft} />
              : <><div className="grow"><div className="t-title">Two-step verification</div><div className="t-meta">Not available yet. Sign-in currently uses your password only.</div></div><span className="pill tone-muted">Coming soon</span></>}
          </div>
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
      const [fam, devicesUsed, childrenUsed, purchase] = await Promise.all([
        db.family.findUniqueOrThrow({ where: { id: u.familyId } }),
        usedDeviceSlots(u.familyId),
        db.child.count({ where: { familyId: u.familyId } }),
        currentPurchase(u.familyId),
      ]);
      const current = planByName(fam.plan);
      const paidUntil = purchase?.expiresAt ? shortDate(purchase.expiresAt, tz) : null;
      const sponsor = await sponsorOf(purchase);
      const sponsored = purchase?.store === VOUCHER_STORE;
      const how = !purchase ? null : purchase.store === "GOOGLE_PLAY" ? "Google Play" : sponsored ? `Sponsored by ${sponsor ?? "an organization"}` : webProduct(purchase.productId)?.autoRenew ? (purchase.autoRenewing ? "Auto-renew" : "Auto-renew off") : "Prepaid pass";
      const nextCharge = purchase?.autoRenewing ? webProduct(purchase.productId) : null;
      // Plans retired before these keep billing at the price they were bought at, which only PayMongo knows
      const nextAmount = nextCharge && !nextCharge.legacy ? peso(webPrice(nextCharge.plan)) : null;
      const runningPass = purchase && !purchase.autoRenewing && purchase.store !== "GOOGLE_PLAY" ? planByProduct(purchase.productId) : null;
      const usage = (label: string, used: number, limit: number) => {
        const over = used > limit;
        return (
          <div>
            <div className="row" style={{ justifyContent: "space-between" }}><span className="t-meta">{label}</span><span className="t-meta num" style={over ? { color: "var(--warn-ink)" } : undefined}>{used} of {limit}</span></div>
            <div className="meter" role="meter" aria-label={`${label} used`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}><span style={{ width: `${limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100}%`, ...(over ? { background: "var(--warn)" } : {}) }} /></div>
            {over ? <p className="t-meta" style={{ marginTop: 6 }}>{used - limit} more than {fam.plan} covers. They stay protected; to add more, remove some or upgrade.</p> : null}
          </div>
        );
      };
      return (
        <>
          {head}
          {returned?.status === "paid" ? (
            <div className="form-ok" role="status" style={{ marginBottom: 16 }}><Icon name="circle-check" />Payment received. {returned.kind === "autorenew" ? "Auto-renew is on." : "Thank you!"} {fam.plan} is active{returned.expiresAt ? ` until ${shortDate(returned.expiresAt, tz)}` : ""}.</div>
          ) : returned?.status === "pending" ? (
            <div className="verify-banner" role="status" style={{ marginBottom: 16 }}><Icon name="hourglass" /><p>We&apos;re waiting for PayMongo to confirm your payment. It usually takes a minute; reload this page to check. If it doesn&apos;t go through, you won&apos;t be charged.</p></div>
          ) : returned?.status === "failed" ? (
            <div className="form-error" role="alert" style={{ marginBottom: 16 }}><Icon name="triangle-alert" />The payment didn&apos;t go through, so nothing changed. You can try again below.</div>
          ) : null}
          <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
            <span className="ico-tile" style={{ width: 52, height: 52 }}><Icon name="crown" /></span>
            <div className="grow">
              <div className="t-title" style={{ fontSize: 18 }}>{fam.plan}</div>
              <div className="t-meta">{current.monthlyPesos ? (fam.renewsAt ? `${renewalWord(purchase)} ${shortDate(fam.renewsAt, tz)}` : "No renewal date") : "Free forever"}{how ? ` · ${how}` : ""}</div>
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 20 }}>
            {usage("Children", childrenUsed, current.entitlements.childLimit)}
            {usage("Devices", devicesUsed, fam.deviceLimit)}
          </div>
          {current.entitlements.apiAccess ? (
            <div className="setting-row" style={{ marginTop: 12 }}>
              <span className="ico-tile"><Icon name="plug" /></span>
              <div className="grow"><div className="t-title">API access for schools and organizations</div><div className="t-meta">Included with {current.name}. Create API keys on the page of an organization you manage, under API access.</div></div>
              <Link className="btn btn-secondary btn-sm" href="/settings/organizations">Organizations</Link>
            </div>
          ) : null}
          {admin ? (
            <div className="setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10, marginTop: 8 }}>
              <div><div className="t-title">Have a sponsor code?</div><div className="t-meta">Schools, community groups and employers can give families eGuard codes. Enter yours to get the plan it covers.</div></div>
              <RedeemCodeForm />
            </div>
          ) : null}
          <hr className="divider" style={{ margin: "20px 0" }} />
          {!admin ? (
            <p className="t-meta">Only the family admin can change the plan.</p>
          ) : purchase?.store === "GOOGLE_PLAY" ? (
            <p className="t-meta">Your plan is billed through Google Play. Change or cancel it in the Play Store app.</p>
          ) : !webBillingAvailable() ? (
            <p className="t-meta">Online payment isn&apos;t available yet. To change your plan, contact <a className="link-btn" href={`mailto:${supportEmail()}`}>{supportEmail()}</a>.</p>
          ) : purchase?.autoRenewing && nextCharge ? (
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div><div className="t-title">Auto-renew is on</div><div className="t-meta">{purchase.state === "past_due" ? "The last renewal payment failed. PayMongo will try again; check your card or Maya balance." : `Next charge${nextAmount ? ` ${nextAmount}` : ""} on ${paidUntil ?? "your next billing date"}. To switch plans, turn auto-renew off; you keep ${fam.plan} until then.`}</div></div>
              <CancelAutoRenew plan={fam.plan} endsOn={paidUntil ?? "the end of this period"} />
            </div>
          ) : (
            <BuyPlan
              plans={PLANS.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb, price: p.id === "FREE" ? 0 : webPrice(p.id), features: p.features.map((f) => f.label) }))}
              current={current.id}
              methods={passMethodLabel()}
              payer={{ name: user.name, email: user.email }}
              autoRenewBlocked={purchase && paidUntil ? `available once your paid time ends on ${paidUntil}.` : null}
              passOnly={runningPass && paidUntil ? { plan: runningPass.id, reason: `Your ${sponsored ? `sponsored ${runningPass.name}` : `${runningPass.name} pass`} runs until ${paidUntil}. You can add months to it now, or switch plans after it ends.` } : null}
            />
          )}
        </>
      );
    }

    case "devices": {
      // Browsers take plan slots too, so they're listed here as on Subscription's device count
      const [graph, browsers] = await Promise.all([getFamilyGraph(u.familyId), listBrowsers(u.familyId)]);
      return (
        <>
          {head}
          {graph.devices.length || browsers.length ? null : <p className="t-meta">No devices are paired yet. Pair your child&apos;s phone or tablet with the eGuard app.</p>}
          {graph.devices.map((d) => (
            <div className="setting-row" key={d.id}>
              <span className="ico-tile"><DeviceIcon kind={d.kind} /></span>
              <div className="grow"><div className="t-title">{d.name}</div><div className="t-meta">{d.child.name} · {d.osVersion} · synced {dayTime(d.lastSeenAt, tz)}</div></div>
              <Link className="link-btn" href={`/devices/${d.id}`}>Open</Link>
            </div>
          ))}
          {browsers.map((b) => (
            <div className="setting-row" key={b.id}>
              <span className="ico-tile"><Icon name="monitor" /></span>
              <div className="grow"><div className="t-title">{browserLabel(b)}</div><div className="t-meta">{b.child.name} · {b.revokedAt ? "Disconnected for security, doesn't count toward your plan" : `seen ${dayTime(b.lastSeenAt, tz)}`}</div></div>
              <Link className="link-btn" href="/devices#add-browser">Manage</Link>
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
          <div className="setting-row"><div className="grow"><div className="t-title">Export family data</div><div className="t-meta">Settings, children, devices and browsers, configuration history and activity summaries as JSON</div></div><form method="post" action="/api/account/export"><button className="btn btn-secondary btn-sm"><Icon name="download" />Download</button></form></div>
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
