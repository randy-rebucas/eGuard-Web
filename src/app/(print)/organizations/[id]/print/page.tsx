import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { getFamily } from "@/lib/queries";
import { shortDate } from "@/lib/format";
import { planByName } from "@/lib/plans";
import { organizationView } from "@/lib/organizations";
import { appUrl } from "@/lib/email-verification";
import { Icon } from "@/components/icon";
import { LogoMark } from "@/components/logo";
import { PrintButton } from "@/components/organizations";
import "./print.css";

/** Reads the session on every request, like the rest of the signed-in pages. */
export const instant = false;

/** Coupons per printed page: 2 across, 4 down, fits both A4 and Letter at 10mm margins. */
const PER_PAGE = 8;

/** Same rule as the organization page: only its admins learn it exists. Never in search results, like every signed-in page. */
export async function generateMetadata(props: PageProps<"/organizations/[id]/print">) {
  const { id } = await props.params;
  const u = await getUser();
  const m = u ? await db.orgMember.findUnique({ where: { orgId_userId: { orgId: id, userId: u.id } }, select: { org: { select: { name: true } } } }) : null;
  return { title: m ? `Sponsor coupons · ${m.org.name}` : "Organization", robots: { index: false, follow: false } };
}

async function orNotFound<T>(p: Promise<T>) {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  }
}

/** Made here, not by a QR service: a code on its way to a third party could be redeemed by someone else. */
const qrSvg = (text: string) =>
  QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b2348", light: "#ffffff" } });

/**
 * A printable sheet of an organization's available sponsor codes, styled as cut-out coupons, so an admin can hand
 * a code to a family in person. `?batch=` limits it to one batch, `?code=` to one code. Redeemed, cancelled and
 * expired codes never print: they're no use to anyone.
 */
export default async function PrintCouponsPage(props: PageProps<"/organizations/[id]/print">) {
  const { id } = await props.params;
  const { batch, code } = await props.searchParams;
  const u = await requireUser();
  const [org, family] = await Promise.all([orNotFound(organizationView(u, id)), getFamily(u.familyId)]);
  const tz = family.timezone;
  const base = appUrl();
  const site = base.replace(/^https?:\/\//, "");

  const batches = org.batches.filter((b) => b.state === "PAID");
  const coupons = batches
    .filter((b) => typeof batch !== "string" || b.id === batch)
    .flatMap((b) => b.codes.filter((c) => c.status === "AVAILABLE" && (typeof code !== "string" || c.id === code)).map((c) => ({
      id: c.id, code: c.code, plan: b.plan, months: b.months, children: planByName(b.plan).entitlements.childLimit, expiresAt: c.expiresAt,
    })));
  const withQr = await Promise.all(coupons.map(async (c) => ({ ...c, qr: await qrSvg(`${base}/settings/subscription?code=${c.code}`) })));
  const pages = Array.from({ length: Math.ceil(withQr.length / PER_PAGE) }, (_, i) => withQr.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
  const available = (b: (typeof batches)[number]) => b.codes.filter((c) => c.status === "AVAILABLE").length;
  const href = (q?: string) => `/organizations/${org.id}/print${q ? `?batch=${q}` : ""}`;
  const scope = typeof code === "string" ? "code" : typeof batch === "string" ? batch : null;

  return (
    <div className="coupon-print">
      <header className="print-bar">
        <div className="print-bar-inner">
          <Link className="link-btn print-back" href={`/organizations/${org.id}`}><Icon name="arrow-left" />{org.name}</Link>
          <div className="print-bar-head">
            <div>
              <h1>Print sponsor coupons</h1>
              <p className="t-meta">
                {withQr.length
                  ? `${withQr.length} coupon${withQr.length === 1 ? "" : "s"} on ${pages.length} page${pages.length === 1 ? "" : "s"}. Cut along the edges and give each one to a single family. Anyone holding a coupon can redeem it, so keep them somewhere safe until you hand them out.`
                  : "Nothing to print here."}
              </p>
            </div>
            {withQr.length ? <PrintButton /> : null}
          </div>
          {batches.length > 1 || scope === "code" ? (
            <nav className="print-filter" aria-label="Which codes to print">
              <Link className={`chip${scope === null ? " on" : ""}`} href={href()} aria-current={scope === null ? "page" : undefined}>All available ({org.totals.available})</Link>
              {batches.map((b) => available(b) ? (
                <Link key={b.id} className={`chip${scope === b.id ? " on" : ""}`} href={href(b.id)} aria-current={scope === b.id ? "page" : undefined}>
                  {b.plan}, {b.months} mo · {shortDate(b.paidAt ?? b.createdAt, tz)} ({available(b)})
                </Link>
              ) : null)}
              {scope === "code" ? <span className="chip on" aria-current="page">One code</span> : null}
            </nav>
          ) : null}
        </div>
      </header>

      {withQr.length ? pages.map((page, i) => (
        <section className="coupon-page" key={i} aria-label={`Page ${i + 1} of ${pages.length}`}>
          {page.map((c) => (
            <div className="coupon-wrap" key={c.id}>
              <article className="coupon">
                <div className="coupon-main">
                  <div className="coupon-top">
                    <span className="coupon-brand"><LogoMark size={18} />eGuard</span>
                    <span className="coupon-tag">Sponsor code</span>
                  </div>
                  <div className="coupon-from">A gift from <b>{org.name}</b></div>
                  <div className="coupon-plan">{c.months} month{c.months === 1 ? "" : "s"} <span>free</span></div>
                  <div className="coupon-sub"><b>{c.plan}</b> · parental controls for up to {c.children} children</div>
                  <div className="coupon-code">{c.code}</div>
                  <div className="coupon-foot">
                    <span>Redeem by <b>{shortDate(c.expiresAt, tz)}</b> · one family, once</span>
                    <span>{site} › Settings › Subscription</span>
                  </div>
                </div>
                <div className="coupon-stub">
                  <div className="coupon-qr" dangerouslySetInnerHTML={{ __html: c.qr }} />
                  <span>Scan to redeem</span>
                </div>
              </article>
            </div>
          ))}
        </section>
      )) : (
        <div className="print-empty card card-pad">
          <span className="ico-tile"><Icon name="ticket" /></span>
          <h2>No codes to print</h2>
          <p className="t-meta">
            {scope === "code"
              ? "That code has already been redeemed, cancelled or has expired, so there's nothing to hand out."
              : "Only available codes print. Buy sponsor codes on the organization page, or check that the payment went through."}
          </p>
          <Link className="btn btn-secondary btn-sm" href={`/organizations/${org.id}`}>Back to {org.name}</Link>
        </div>
      )}
    </div>
  );
}
