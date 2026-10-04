import Link from "next/link";
import { parseInline, type MdBlock } from "@/lib/learn/markdown";

function Inline({ text }: { text: string }) {
  return parseInline(text).map((t, i) => {
    if (t.type === "bold") return <strong key={i}>{t.text}</strong>;
    if (t.type === "link") {
      return t.href.startsWith("/")
        ? <Link key={i} href={t.href}>{t.text}</Link>
        : <a key={i} href={t.href} target="_blank" rel="noopener noreferrer">{t.text}</a>;
    }
    return t.text;
  });
}

export function MdBlocks({ blocks }: { blocks: MdBlock[] }) {
  return blocks.map((b, i) => {
    switch (b.type) {
      case "h2": return <h2 key={i} id={b.id}>{b.text}</h2>;
      case "h3": return <h3 key={i}><Inline text={b.text} /></h3>;
      case "ul": return <ul key={i}>{b.items.map((li, j) => <li key={j}><Inline text={li} /></li>)}</ul>;
      case "ol": return <ol key={i}>{b.items.map((li, j) => <li key={j}><Inline text={li} /></li>)}</ol>;
      case "note": return <p key={i} className="st-note"><Inline text={b.text} /></p>;
      case "table":
        return (
          <div key={i} className="st-table">
            <table>
              <thead><tr>{b.head.map((h, j) => <th key={j} scope="col"><Inline text={h} /></th>)}</tr></thead>
              <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}><Inline text={c} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      default: return <p key={i}><Inline text={b.text} /></p>;
    }
  });
}
