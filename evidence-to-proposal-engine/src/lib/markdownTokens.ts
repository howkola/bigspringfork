/* Markdown tokenizer shared by the export builders (DOCX + print/PDF). Mirrors
   the inline/line grammar of the React renderer in lib/markdown.tsx, but emits
   plain data instead of React nodes so it can drive non-DOM outputs. */

export interface Span {
  text: string;
  bold?: boolean;
  cite?: boolean;
  placeholder?: boolean;
}

export type MdBlock =
  | { kind: "heading"; level: number; spans: Span[] }
  | { kind: "para"; spans: Span[] }
  | { kind: "list"; items: Span[][] };

export function parseInline(text: string): Span[] {
  const parts = String(text).split(/(\[[AC]\d+\]|\*\*[^*]+\*\*|\{\{[^}]+\}\})/g);
  const spans: Span[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (/^\[[AC]\d+\]$/.test(p)) spans.push({ text: p, cite: true });
    else if (/^\*\*[^*]+\*\*$/.test(p)) spans.push({ text: p.slice(2, -2), bold: true });
    else if (/^\{\{[^}]+\}\}$/.test(p))
      spans.push({ text: p.replace(/[{}]/g, "").trim(), placeholder: true });
    else spans.push({ text: p });
  }
  return spans;
}

export function tokenizeMarkdown(text: string): MdBlock[] {
  const lines = String(text || "").split("\n");
  const out: MdBlock[] = [];
  let list: Span[][] | null = null;
  const flush = () => {
    if (list) {
      out.push({ kind: "list", items: list });
      list = null;
    }
  };

  for (const ln of lines) {
    const t = ln.trim();
    if (/^#{1,4}\s+/.test(t)) {
      flush();
      const level = (t.match(/^#+/) as RegExpMatchArray)[0].length;
      out.push({ kind: "heading", level: Math.min(level, 4), spans: parseInline(t.replace(/^#+\s+/, "")) });
    } else if (/^[-*]\s+/.test(t)) {
      if (!list) list = [];
      list.push(parseInline(t.replace(/^[-*]\s+/, "")));
    } else if (t === "") {
      flush();
    } else {
      flush();
      out.push({ kind: "para", spans: parseInline(t) });
    }
  }
  flush();
  return out;
}
