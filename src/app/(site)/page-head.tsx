/** Title band at the top of every public page. */
export function PageHead({ eyebrow, title, lede, children }: { eyebrow: string; title: React.ReactNode; lede?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="st-head">
      <div className="lp-wrap">
        <span className="lp-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {lede ? <p className="st-lede">{lede}</p> : null}
        {children}
      </div>
    </section>
  );
}

/** Legal pages: a table of contents beside numbered sections. */
export function LegalBody({ sections }: { sections: { id: string; title: string; body: React.ReactNode }[] }) {
  return (
    <div className="lp-wrap st-legal">
      <nav className="st-toc" aria-label="On this page">
        <b>On this page</b>
        <ol>{sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ol>
      </nav>
      <div className="st-prose">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id}>
            <h2><span className="st-num">{i + 1}</span>{s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </div>
  );
}
