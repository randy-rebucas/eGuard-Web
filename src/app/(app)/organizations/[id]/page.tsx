import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/errors";
import { getFamily } from "@/lib/queries";
import { peso, shortDate } from "@/lib/format";
import { webPrice } from "@/lib/plans";
import { passMethods, webBillingAvailable } from "@/lib/web-billing";
import { MAX_CODES_PER_BATCH, ORG_KINDS, confirmBatchReturn, organizationView } from "@/lib/organizations";
import { MAX_KEYS_PER_ORG, canCreateApiKeys, listApiKeys } from "@/lib/org-api";
import { planWith } from "@/lib/plan-access";
import { appUrl } from "@/lib/email-verification";
import { supportEmail } from "@/lib/support";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead } from "@/components/ui";
import { AddOrgAdminForm, ApiKeys, BuyCodesForm, CodesList, JoinCodeCard, OrgAdminActions } from "@/components/organizations";

export const metadata = { title: "Organization" };

/** Organization pages 404 for anyone who doesn't manage the organization, so they can't be probed. */
async function orNotFound<T>(p: Promise<T>) {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  }
}

const METHOD_NAMES: Record<string, string> = { gcash: "GCash", paymaya: "Maya", card: "card", qrph: "QR Ph" };
const methodsLabel = () => {
  const names = [...new Set(passMethods().map((m) => METHOD_NAMES[m] ?? m))];
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0] ?? "card";
};

export default async function OrganizationPage(props: PageProps<"/organizations/[id]">) {
  const { id } = await props.params;
  const { batch } = await props.searchParams;
  const u = await requireUser();
  // Back from PayMongo: check the payment now instead of waiting for the webhook
  const returned = typeof batch === "string" ? await orNotFound(confirmBatchReturn(u, id, batch)) : null;
  const [org, family] = await Promise.all([orNotFound(organizationView(u, id)), getFamily(u.familyId)]);
  const [keys, canCreate] = await Promise.all([listApiKeys(u, id), canCreateApiKeys(u)]);
  const tz = family.timezone;
  const owner = org.role === "OWNER";

  return (
    <>
      <PageHead title={org.name} text={`${ORG_KINDS[org.kind]} · you're ${owner ? "an owner" : "an admin"}. You see counts and codes only, never which family joined or redeemed a code.`}
        crumbs={[{ href: "/settings/organizations", label: "Organizations" }]} />

      {returned?.status === "paid" ? (
        <div className="form-ok" role="status"><Icon name="circle-check" />Payment received. Your {returned.quantity} code{returned.quantity === 1 ? " is" : "s are"} ready below.</div>
      ) : returned?.status === "pending" ? (
        <div className="verify-banner" role="status"><Icon name="hourglass" /><p>We&apos;re waiting for PayMongo to confirm your payment. It usually takes a minute; reload this page to check. Your codes appear here once it&apos;s confirmed.</p></div>
      ) : returned?.status === "failed" ? (
        <div className="form-error" role="alert"><Icon name="triangle-alert" />The payment didn&apos;t go through, so no codes were created. You can try again below.</div>
      ) : null}

      <div className="org-stats">
        <div className="card card-pad"><span className="t-meta">Families joined</span><b className="num">{org.families}</b></div>
        <div className="card card-pad"><span className="t-meta">Codes available</span><b className="num">{org.totals.available}</b></div>
        <div className="card card-pad"><span className="t-meta">Codes redeemed</span><b className="num">{org.totals.redeemed}<small> of {org.totals.bought}</small></b></div>
      </div>

      <div className="org-grid">
        <section className="card card-pad">
          <div className="card-head"><div><h2>Join code</h2><div className="sub">Share it with your families. A family admin enters it in eGuard under Settings › Organizations to join.</div></div></div>
          <JoinCodeCard orgId={org.id} code={org.joinCode} />
        </section>

        <section className="card card-pad">
          <div className="card-head"><div><h2>Admins</h2><div className="sub">People who can manage {org.name}. Owners can add and remove admins.</div></div></div>
          {org.admins.map((a) => (
            <div className="setting-row" key={a.id}>
              <span className="ico-tile"><Icon name="user" /></span>
              <div className="grow"><div className="t-title">{a.name}{a.you ? " (you)" : ""}</div><div className="t-meta">{a.role === "OWNER" ? "Owner" : "Admin"} · {a.email}</div></div>
              <OrgAdminActions orgId={org.id} userId={a.id} name={a.name.split(" ")[0]} you={a.you} isOwner={a.role === "OWNER"} canManage={owner} />
            </div>
          ))}
          {owner ? <div style={{ marginTop: 14 }}><AddOrgAdminForm orgId={org.id} /></div> : null}
        </section>
      </div>

      <section className="card card-pad">
        <div className="card-head"><div><h2>Sponsor codes</h2><div className="sub">Each code gives one family a paid plan. Hand codes out however you like; you&apos;ll see when each one is redeemed, but not by whom.</div></div>
          {org.totals.bought ? <a className="btn btn-secondary btn-sm" href={`/organizations/${org.id}/codes.csv`}><Icon name="download" />Download CSV</a> : null}
        </div>
        {webBillingAvailable() ? (
          <BuyCodesForm orgId={org.id} monthly={{ PLUS: webPrice("PLUS"), PRO: webPrice("PRO") }} maxQuantity={MAX_CODES_PER_BATCH} methods={methodsLabel()} />
        ) : (
          <p className="t-meta">Online payment isn&apos;t available yet. To buy sponsor codes, contact <a className="link-btn" href={`mailto:${supportEmail()}?subject=${encodeURIComponent(`Sponsor codes for ${org.name}`)}`}>{supportEmail()}</a>.</p>
        )}
      </section>

      <section className="card card-pad" id="api">
        <div className="card-head"><div><h2>API access</h2><div className="sub">Let your school&apos;s or company&apos;s own systems read your codes and counts, and cancel codes, with an API key. The API never shows which families joined or used a code.</div></div></div>
        <ApiKeys orgId={org.id} canCreate={canCreate} atLimit={keys.length >= MAX_KEYS_PER_ORG} baseUrl={`${appUrl()}/api/org/v1`}
          upgrade={`API keys are included with ${planWith((e) => e.apiAccess).name}. Your family's plan doesn't include them; upgrade in Settings › Subscription to create one. Any admin can revoke a key.`}
          keys={keys.map((k) => ({
            id: k.id, name: k.name, prefix: k.prefix, access: k.access, paused: k.state === "PAUSED",
            meta: [`by ${k.yours ? "you" : k.createdBy}`, k.lastUsedAt ? `last used ${shortDate(k.lastUsedAt, tz)}` : "never used",
              k.state === "PAUSED" ? `paused: ${k.yours ? "your" : `${k.createdBy}'s`} plan no longer includes API access` : null].filter(Boolean).join(" · "),
          }))} />
      </section>

      {org.batches.length ? org.batches.map((b) => (
        <section className="card card-pad" key={b.id}>
          <div className="card-head">
            <div>
              <h3>{b.quantity} × {b.plan}, {b.months} month{b.months === 1 ? "" : "s"}</h3>
              <div className="sub">Bought {shortDate(b.createdAt, tz)} · {peso(b.amount)}</div>
            </div>
            {b.state === "PENDING" ? <span className="pill tone-warn">Waiting for payment</span> : b.state === "VOIDED" ? <span className="pill tone-muted">Refunded</span> : null}
          </div>
          {b.codes.length ? (
            <CodesList orgId={org.id} codes={b.codes.map((c) => ({
              id: c.id, code: c.code, status: c.status,
              when: c.redeemedAt ? shortDate(c.redeemedAt, tz) : c.status === "AVAILABLE" ? `until ${shortDate(c.expiresAt, tz)}` : null,
            }))} />
          ) : <p className="t-meta">Codes appear here once PayMongo confirms the payment.</p>}
        </section>
      )) : (
        <div className="card"><EmptyState icon="ticket" title="No sponsor codes yet" text="Buy codes above to pay for families' plans. Each code is redeemed once, in Settings › Subscription." /></div>
      )}
    </>
  );
}
