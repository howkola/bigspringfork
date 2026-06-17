import type { Citation } from "../../shared/types";
import { SECTION_DEFS } from "../../shared/anchors";
import { tokenizeMarkdown, type Span } from "./markdownTokens";

/* Real .docx export, built from the same markdown tokens the UI renders.
   `docx` is lazy-imported so it stays out of the main bundle. */

const GARNET = "7A2E2A";
const AMBER = "9A6A1F";
const MOSS = "3F5D43";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadDocx(
  request: string,
  sections: Record<string, string>,
  citations: Citation[],
  verified: Record<string, boolean>
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const runs = (spans: Span[]) =>
    spans.map(
      (s) =>
        new TextRun({
          text: s.placeholder ? `{{${s.text}}}` : s.text,
          bold: s.bold || undefined,
          italics: s.placeholder || undefined,
          color: s.cite ? GARNET : s.placeholder ? AMBER : undefined,
        })
    );

  const children: import("docx").Paragraph[] = [];
  children.push(
    new Paragraph({
      text: "Evidence-to-Proposal Packet — Project Harmony CAC",
      heading: HeadingLevel.TITLE,
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Funding request: ", bold: true }),
        new TextRun({ text: request }),
      ],
    })
  );

  const unverified = citations.filter((c) => !verified[c.id]).length;
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text:
            unverified === 0
              ? "Review status: All citations human-verified."
              : `Review status: ${unverified} citation(s) NOT yet human-verified. Confirm bibliographic details and any statistics, and replace all {{LOCAL: ...}} placeholders before submission.`,
          italics: true,
          color: unverified === 0 ? MOSS : AMBER,
        }),
      ],
    })
  );

  for (const s of SECTION_DEFS) {
    if (s.key === "citationPacket") {
      children.push(
        new Paragraph({ text: `${s.num} · Citation Packet`, heading: HeadingLevel.HEADING_1 })
      );
      for (const c of citations) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `[${c.id}] `, bold: true, color: GARNET }),
              new TextRun({ text: `${c.authors} (${c.year}). ` }),
              new TextRun({ text: `${c.title}. `, italics: true }),
              new TextRun({ text: `${c.source}. ` }),
              new TextRun({ text: `— ${c.finding} ` }),
              new TextRun({
                text: verified[c.id] ? "✓ verified" : "⚠ verify",
                bold: true,
                color: verified[c.id] ? MOSS : AMBER,
              }),
            ],
          })
        );
      }
      continue;
    }

    const md = sections[s.key];
    if (!md) continue;
    children.push(new Paragraph({ text: `${s.num} · ${s.label}`, heading: HeadingLevel.HEADING_1 }));

    for (const b of tokenizeMarkdown(md)) {
      if (b.kind === "heading") {
        const heading =
          b.level <= 1
            ? HeadingLevel.HEADING_2
            : b.level === 2
            ? HeadingLevel.HEADING_3
            : HeadingLevel.HEADING_4;
        children.push(new Paragraph({ children: runs(b.spans), heading }));
      } else if (b.kind === "list") {
        for (const item of b.items) {
          children.push(new Paragraph({ children: runs(item), bullet: { level: 0 } }));
        }
      } else {
        children.push(new Paragraph({ children: runs(b.spans) }));
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, "evidence-to-proposal-packet.docx");
}
