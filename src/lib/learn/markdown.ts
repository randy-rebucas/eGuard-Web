/**
 * The small Markdown subset knowledge center articles are written in. Kept deliberately narrow so articles stay
 * plain text that anyone can edit, and so nothing here needs a dependency or raw HTML.
 */

export type MdBlock =
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "note"; text: string }
  | { type: "table"; head: string[]; rows: string[][] };

export type Inline = { type: "text"; text: string } | { type: "bold"; text: string } | { type: "link"; text: string; href: string };

export const headingId = (text: string) =>
  text.toLowerCase().replace(/\*\*/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function parseMarkdown(src: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = src.replace(/\r/g, "").split("\n");
  const seen = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.startsWith("## ")) {
      const text = line.slice(3).trim();
      let id = headingId(text);
      const n = seen.get(id) ?? 0;
      seen.set(id, n + 1);
      if (n) id = `${id}-${n + 1}`;
      blocks.push({ type: "h2", text, id });
      i++;
    } else if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      i++;
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) items.push(lines[i++].trim().slice(2).trim());
      blocks.push({ type: "ul", items });
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^\d+\. /, ""));
      blocks.push({ type: "ol", items });
    } else if (line.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) parts.push(lines[i++].trim().replace(/^>\s?/, ""));
      blocks.push({ type: "note", text: parts.join(" ") });
    } else if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i++].trim();
        if (!/^\|[\s:|-]+\|$/.test(row)) rows.push(cells(row));
      }
      blocks.push({ type: "table", head: rows[0] ?? [], rows: rows.slice(1) });
    } else {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#{2,3} |- |\d+\. |>|\|)/.test(lines[i].trim())) parts.push(lines[i++].trim());
      blocks.push({ type: "p", text: parts.join(" ") });
    }
  }
  return blocks;
}

/** **bold** and [text](href); everything else is text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { type: "bold", text: m[1] } : { type: "link", text: m[2], href: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** Every link target in a body, for the tests that check internal links resolve. */
export const linksIn = (src: string) => [...src.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);

/** Plain words, for reading time. */
export const plainText = (src: string) => src.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[#*>|]/g, " ");
