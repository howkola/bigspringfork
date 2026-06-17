import type { Citation } from "../../shared/types";
import { SECTION_DEFS } from "../../shared/anchors";
import { tokenizeMarkdown, type Span } from "./markdownTokens";

/* PDF export via the browser's print-to-PDF. We render a clean, paginated HTML
   document with the app's editorial styling and open the print dialog — the
   result is a real, text-selectable PDF that funders accept, with no heavy
   client-side PDF dependency. */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function spanHtml(s: Span): string {
  if (s.cite) return `<span class="cite">${esc(s.text)}</span>`;
  if (s.placeholder) return `<span class="ph">{{${esc(s.text)}}}</span>`;
  if (s.bold) return `<strong>${esc(s.text)}</strong>`;
  return esc(s.text);
}

function sectionHtml(md: string): string {
  const parts: string[] = [];
  for (const b of tokenizeMarkdown(md)) {
    const inner = (spans: Span[]) => spans.map(spanHtml).join("");
    if (b.kind === "heading") parts.push(`<h${b.level + 2}>${inner(b.spans)}</h${b.level + 2}>`);
    else if (b.kind === "list")
      parts.push(`<ul>${b.items.map((it) => `<li>${inner(it)}</li>`).join("")}</ul>`);
    else parts.push(`<p>${inner(b.spans)}</p>`);
  }
  return parts.join("\n");
}

const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
*{box-sizing:border-box}
body{font-family:'IBM Plex Sans',sans-serif;color:#211d16;line-height:1.6;max-width:780px;margin:0 auto;padding:32px}
h1{font-family:'Fraunces',serif;font-size:30px;margin:0 0 6px}
h2{font-family:'Fraunces',serif;font-size:22px;border-bottom:2px solid #211d16;padding-bottom:6px;margin:30px 0 12px;page-break-after:avoid}
h3{font-family:'Fraunces',serif;font-size:17px;margin:16px 0 6px}
h4,h5,h6{font-family:'IBM Plex Sans',sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#7a2e2a;margin:14px 0 4px}
p,li{font-size:13px}
ul{padding-left:20px}
.req{font-size:13px;margin:0 0 4px}
.status{font-size:12px;font-style:italic;border-left:3px solid #9a6a1f;background:#f4ead6;color:#6e4c14;padding:8px 12px;margin:10px 0 24px}
.status.ok{border-color:#3f5d43;background:#e9f0e9;color:#2f4a33}
.cite{font-family:monospace;font-size:11px;color:#7a2e2a;border-bottom:1px solid #7a2e2a}
.ph{font-family:monospace;font-size:11.5px;background:#f4ead6;border:1px dashed #9a6a1f;color:#6e4c14;padding:0 4px}
.cite-row{font-size:12px;padding:6px 0;border-bottom:1px solid #d8cfba}
.cite-row .id{font-family:monospace;color:#7a2e2a;font-weight:600}
.verify{font-family:monospace;font-size:10.5px}
.verify.ok{color:#3f5d43}.verify.no{color:#9a6a1f}
@media print{body{padding:0}a{color:inherit;text-decoration:none}}
`;

export function printPacket(
  request: string,
  sections: Record<string, string>,
  citations: Citation[],
  verified: Record<string, boolean>
): boolean {
  const unverified = citations.filter((c) => !verified[c.id]).length;
  const blocks: string[] = [];

  blocks.push(`<h1>Evidence-to-Proposal Packet — Project Harmony CAC</h1>`);
  blocks.push(`<p class="req"><strong>Funding request:</strong> ${esc(request)}</p>`);
  blocks.push(
    `<div class="status ${unverified === 0 ? "ok" : ""}">${
      unverified === 0
        ? "Review status: All citations human-verified."
        : `Review status: ${unverified} citation(s) NOT yet human-verified. Confirm bibliographic details and any statistics, and replace all {{LOCAL: ...}} placeholders before submission.`
    }</div>`
  );

  for (const s of SECTION_DEFS) {
    if (s.key === "citationPacket") {
      blocks.push(`<h2>${s.num} · Citation Packet</h2>`);
      for (const c of citations) {
        blocks.push(
          `<div class="cite-row"><span class="id">[${esc(c.id)}]</span> ${esc(c.authors)} (${esc(
            c.year
          )}). <em>${esc(c.title)}.</em> ${esc(c.source)}. — ${esc(c.finding)} <span class="verify ${
            verified[c.id] ? "ok" : "no"
          }">${verified[c.id] ? "✓ verified" : "⚠ verify"}</span></div>`
        );
      }
      continue;
    }
    const md = sections[s.key];
    if (!md) continue;
    blocks.push(`<h2>${s.num} · ${esc(s.label)}</h2>`);
    blocks.push(sectionHtml(md));
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Evidence-to-Proposal Packet</title><style>${PRINT_CSS}</style></head><body>${blocks.join(
    "\n"
  )}</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false; // popup blocked
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // Give fonts a moment, then invoke the print/save-as-PDF dialog.
  const fire = () => {
    try {
      w.print();
    } catch {
      /* user can print manually */
    }
  };
  w.onload = fire;
  setTimeout(fire, 600);
  return true;
}
