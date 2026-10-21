import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { careReport, carePreferences } from "@/lib/parent-care/service";
import { addDays, localDay } from "@/lib/parent-care/schedule";
import { dayTime } from "@/lib/format";
import { Icon } from "@/components/icon";
import { EmptyState, PageHead } from "@/components/ui";

export const metadata = { title: "Monthly summary" };

const monthName = (ym: string) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
const shift = (ym: string, n: number) => addDays(`${ym}-15`, n * 30).slice(0, 7);

/**
 * Last month (or ?month=YYYY-MM) in numbers, from the parent's own records: activities done and started, the
 * family's protection changes and weekly plans. Says what happened, never what it achieved.
 */
export default async function ReportPage(props: PageProps<"/plan/report">) {
  const u = await requireUser();
  const sp = await props.searchParams;
  const prefs = await carePreferences(u);
  const tz = prefs.effectiveTimezone;
  const thisMonth = localDay(new Date(), tz).slice(0, 7);
  const asked = typeof sp.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) && sp.month <= thisMonth ? sp.month : undefined;
  const r = await careReport(u, asked);
  const name = monthName(r.month);
  const next = shift(r.month, 1);
  const stats = [
    { label: "Activities done", value: r.completed },
    { label: "Activities started", value: r.started },
    { label: "Protection changes", value: r.protectionChanges },
    { label: "Weekly plans", value: r.planWeeks },
  ];
  return (
    <>
      <PageHead title={`${name} summary`} text="What your family did with eGuard this month, counted from your own activity." crumbs={[{ href: "/plan", label: "Safety plan" }]}>
        <Link className="btn btn-ghost" href={`/plan/report?month=${shift(r.month, -1)}`}><Icon name="chevron-left" />Earlier</Link>
        {next <= thisMonth ? <Link className="btn btn-ghost" href={`/plan/report?month=${next}`}>Later<Icon name="chevron-right" /></Link> : null}
      </PageHead>
      {r.joinedAfter ? (
        <section className="card card-pad"><EmptyState icon="calendar" title="You joined eGuard after this month" text="Your first summary covers your first full month." /></section>
      ) : (
        <>
          <section className="card card-pad">
            <div className="metrics" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
              {stats.map((s) => (
                <div key={s.label} className="metric"><div className="usage-big num">{s.value}</div><div className="t-meta">{s.label}</div></div>
              ))}
            </div>
            <p className="t-meta" style={{ marginTop: 16 }}>Protection changes count every change your family confirmed on a device or in the browser this month, by any parent.</p>
          </section>
          <section className="card card-pad">
            <div className="card-head"><h2>Done this month</h2></div>
            {r.activities.length ? (
              <ul className="care-list">
                {r.activities.map((a) => (
                  <li key={`${a.key}:${a.completedAt}`}>
                    <span className="ico-tile ok"><Icon name="check" /></span>
                    <div className="grow"><Link className="t-title inline-link" href={`/plan/${a.key}`}>{a.title}</Link><div className="t-meta">{dayTime(new Date(a.completedAt), tz)}</div></div>
                  </li>
                ))}
              </ul>
            ) : <p className="t-meta">No activities marked as done in {name}. That&apos;s fine: one short activity is a good start.</p>}
          </section>
        </>
      )}
      {r.nextStep ? (
        <section className="card card-pad">
          <div className="card-head"><h2>A next step</h2></div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div className="grow"><div className="t-title">{r.nextStep.title}</div><div className="t-meta">About {r.nextStep.minutes} minutes</div></div>
            <Link className="btn btn-primary" href={`/plan/${r.nextStep.key}`}>See the steps</Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
