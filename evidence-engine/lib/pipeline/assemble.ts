import type { CitationClaim, CorpusEntry, GeneratedSection } from "@/lib/types";

/**
 * Deterministic final assembly: concatenate approved sections in order,
 * renumber every per-section [C#] marker into a document-wide footnote
 * sequence, and build the references list from the verified claim mapping.
 * No model call — the narrative that was approved is the narrative that ships.
 */
export function assembleDocument(
  sections: GeneratedSection[],
  claimsBySection: Map<string, CitationClaim[]>,
  corpusById: Map<string, CorpusEntry>,
): { document: string; references: string[] } {
  const ordered = [...sections].sort((a, b) => a.sort_order - b.sort_order);

  // A source cited by multiple claims gets one footnote number.
  const footnoteByCorpusId = new Map<string, number>();
  const references: string[] = [];

  const bodyParts = ordered.map((section) => {
    let content = section.current_content ?? section.draft_content ?? "";
    const claims = claimsBySection.get(section.id) ?? [];

    for (const claim of claims) {
      if (!claim.corpus_entry_id) continue;
      let n = footnoteByCorpusId.get(claim.corpus_entry_id);
      if (n === undefined) {
        const entry = corpusById.get(claim.corpus_entry_id);
        n = references.length + 1;
        footnoteByCorpusId.set(claim.corpus_entry_id, n);
        references.push(entry ? formatReference(entry) : "Unknown source");
      }
      content = content.split(claim.citation_marker).join(`[${n}]`);
    }
    return `## ${section.title}\n\n${content}`;
  });

  let document = bodyParts.join("\n\n");
  if (references.length > 0) {
    document +=
      "\n\n## References\n\n" +
      references.map((r, i) => `${i + 1}. ${r}`).join("\n");
  }

  return { document, references };
}

export function formatReference(entry: CorpusEntry): string {
  const parts = [
    entry.authors,
    entry.title,
    entry.publication,
    entry.publication_year?.toString(),
  ].filter(Boolean);
  let ref = parts.join(". ");
  if (entry.url) ref += `. ${entry.url}`;
  return ref;
}
