import Link from "next/link";
import { ArrowRight, Check, Languages, X } from "lucide-react";
import { Phone, ScreenChildHome } from "@/components/flow-devices";
import { PageHead } from "../page-head";
import { KIDS_COPY, type Lang } from "./copy";
import { PrintButton } from "./print-button";
import "./kids.css";

/** The page for children, in either language (copy.tsx). `lang` marks the content for screen readers and translation tools. */
export function KidsPage({ lang }: { lang: Lang }) {
  const c = KIDS_COPY[lang];
  return (
    <div lang={lang === "fil" ? "fil" : "en"}>
      <div className="kd-screen">
        <PageHead eyebrow={c.eyebrow} title={c.title} lede={c.lede}>
          <Link href={c.switchTo.href} hrefLang={c.switchTo.lang} lang={c.switchTo.lang} className="kd-lang"><Languages aria-hidden="true" />{c.switchTo.label}</Link>
        </PageHead>
      </div>

      <div className="lp-wrap st-about kd">
        <div className="st-split kd-screen">
          <div>
            <h2>{c.what.title}</h2>
            {c.what.body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="kd-art">
            <Phone os="android" className="kd-phone" caption={c.what.caption} label={c.what.phoneLabel}>
              <ScreenChildHome />
            </Phone>
          </div>
        </div>

        <div className="st-block kd-screen">
          <h2>{c.does.title}</h2>
          <ul className="kd-does">
            {c.does.items.map(([Ico, tone, title, body]) => <li key={title}><i className={tone}><Ico /></i><h3>{title}</h3><p>{body}</p></li>)}
          </ul>
        </div>

        <div className="st-block kd-screen">
          <h2>{c.see.title}</h2>
          <div className="kd-see">
            <div className="kd-can">
              <h3><i><Check /></i>{c.see.can}</h3>
              <ul>{c.see.canList.map((s) => <li key={s}><Check />{s}</li>)}</ul>
            </div>
            <div className="kd-cant">
              <h3><i><X /></i>{c.see.cant}</h3>
              <ul>{c.see.cantList.map((s) => <li key={s}><X />{s}</li>)}</ul>
            </div>
          </div>
        </div>

        <div className="st-block kd-screen">
          <h2>{c.ask.title}</h2>
          <p>{c.ask.body}</p>
          <ol className="kd-ask">
            {c.ask.steps.map(([title, body], i) => <li key={title}><span>{i + 1}</span><b>{title}</b>{body}</li>)}
          </ol>
        </div>

        <div className="st-split st-flip kd-screen">
          <ul className="kd-tips">
            {c.tips.map(([Ico, title, body]) => <li key={title}><i><Ico /></i><div><b>{title}</b><span>{body}</span></div></li>)}
          </ul>
          <div>
            <h2>{c.team.title}</h2>
            <p>{c.team.body}</p>
          </div>
        </div>

        {/* ---------- Printable agreement ---------- */}
        <section className="kd-agreement" id="agreement" aria-labelledby="agreement-h">
          <div className="kd-agreement-head">
            <div>
              <span className="lp-eyebrow kd-screen">{c.agreement.eyebrow}</span>
              <h2 id="agreement-h">{c.agreement.title}</h2>
              <p>{c.agreement.body}</p>
            </div>
            <div className="kd-screen"><PrintButton label={c.agreement.print} /></div>
          </div>

          <div className="kd-fields">
            {c.agreement.fields.map((f) => <div key={f}><span>{f}</span><i /></div>)}
            <div className="wide"><span>{c.agreement.wideField}</span><i /></div>
          </div>

          <div className="kd-promises">
            <div>
              <h3>{c.agreement.kidTitle}</h3>
              <ul>{c.agreement.kid.map((p) => <li key={p}><span className="kd-box" />{p}</li>)}<li><span className="kd-box" /><i className="kd-line" /></li></ul>
            </div>
            <div>
              <h3>{c.agreement.parentTitle}</h3>
              <ul>{c.agreement.parent.map((p) => <li key={p}><span className="kd-box" />{p}</li>)}<li><span className="kd-box" /><i className="kd-line" /></li></ul>
            </div>
          </div>

          <div className="kd-sign">
            {c.agreement.sign.map((s) => <div key={s}><i /><span>{s}</span></div>)}
          </div>
          <p className="kd-foot">{c.agreement.foot}</p>
        </section>

        <div className="st-cta kd-screen">
          <div>
            <h2>{c.cta.title}</h2>
            <p>{c.cta.body}</p>
          </div>
          <Link href="/how-it-works" className="lp-btn lp-btn-white">{c.cta.button}<ArrowRight /></Link>
        </div>
      </div>
    </div>
  );
}
