import type { ReactNode } from "react";
import type { Citation } from "../../shared/types";

/* ---------- Markdown mini-renderer (headings, bold, lists, citations) ---------- */

type CitationMap = Record<string, Citation>;

export function renderMarkdown(
  text: string,
  citationMap: CitationMap,
  onCiteClick?: (id: string) => void
): ReactNode[] {
  if (!text) return [];
  const lines = String(text).split("\n");
  const out: ReactNode[] = [];
  let listBuf: string[] = [];

  const flushList = (k: string | number) => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${k}`} className="md-ul">
          {listBuf.map((li, i) => (
            <li key={i}>{renderInline(li, citationMap, onCiteClick)}</li>
          ))}
        </ul>
      );
      listBuf = [];
    }
  };

  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (/^#{1,4}\s+/.test(t)) {
      flushList(i);
      const lvl = (t.match(/^#+/) as RegExpMatchArray)[0].length;
      const txt = t.replace(/^#+\s+/, "");
      out.push(
        <div key={i} className={`md-h md-h${Math.min(lvl, 4)}`}>
          {renderInline(txt, citationMap, onCiteClick)}
        </div>
      );
    } else if (/^[-*]\s+/.test(t)) {
      listBuf.push(t.replace(/^[-*]\s+/, ""));
    } else if (t === "") {
      flushList(i);
    } else {
      flushList(i);
      out.push(
        <p key={i} className="md-p">
          {renderInline(t, citationMap, onCiteClick)}
        </p>
      );
    }
  });
  flushList("end");
  return out;
}

export function renderInline(
  text: string,
  citationMap: CitationMap,
  onCiteClick?: (id: string) => void
): ReactNode[] {
  // split on citation markers, bold, and local placeholders
  const parts = String(text).split(/(\[[AC]\d+\]|\*\*[^*]+\*\*|\{\{[^}]+\}\})/g);
  return parts.map((p, i) => {
    const cite = p.match(/^\[([AC]\d+)\]$/);
    if (cite) {
      const id = cite[1];
      const known = citationMap[id];
      return (
        <button
          key={i}
          className={`cite-chip ${known ? "" : "cite-unknown"}`}
          title={
            known
              ? `${known.authors} (${known.year})`
              : "Unrecognized citation — flag for review"
          }
          onClick={() => onCiteClick && onCiteClick(id)}
        >
          {id}
        </button>
      );
    }
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\{\{[^}]+\}\}$/.test(p))
      return (
        <span
          key={i}
          className="local-placeholder"
          title="Insert verified local data before submission"
        >
          {p.replace(/[{}]/g, "").trim()}
        </span>
      );
    return <span key={i}>{p}</span>;
  });
}
