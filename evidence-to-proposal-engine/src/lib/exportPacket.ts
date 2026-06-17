import type { Citation } from "../../shared/types";
import { SECTION_DEFS } from "../../shared/anchors";

/* ---------- Export (Phase 1: markdown) ----------
   Phase 4 will add real DOCX/PDF; the markdown builder stays as the canonical
   serialization and the basis for those converters. */

export function buildFullMarkdown(
  request: string,
  sections: Record<string, string>,
  citations: Citation[],
  verified: Record<string, boolean>
): string {
  const unverified = citations.filter((c) => !verified[c.id]).length;
  let md = `# Evidence-to-Proposal Packet — Project Harmony CAC\n\n`;
  md += `**Funding request:** ${request}\n\n`;
  md += `> ⚠️ Review status: ${
    unverified === 0
      ? "All citations human-verified."
      : `${unverified} citation(s) NOT yet human-verified. Confirm bibliographic details and any statistics before submission. Replace all {{LOCAL: ...}} placeholders with verified data.`
  }\n\n---\n\n`;
  SECTION_DEFS.forEach((s) => {
    if (s.key === "citationPacket") {
      md += `## ${s.num} · Citation Packet\n\n`;
      citations.forEach((c) => {
        md += `- **[${c.id}]** ${c.authors} (${c.year}). *${c.title}.* ${c.source}. — ${c.finding} ${
          verified[c.id] ? "✓ verified" : "⚠ verify"
        }\n`;
      });
      md += `\n`;
    } else if (sections[s.key]) {
      md += `## ${s.num} · ${s.label}\n\n${sections[s.key]}\n\n---\n\n`;
    }
  });
  return md;
}
