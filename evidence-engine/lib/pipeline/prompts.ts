import type { CorpusEntry, GrantOpportunity, GeneratedSection } from "@/lib/types";
import { formatCorpusForPrompt } from "@/lib/pipeline/citations";

const ORG_CONTEXT = `You are the grant-writing research engine for Project Harmony Child Advocacy Center, a children's advocacy center (CAC) providing coordinated, trauma-informed responses to child abuse: forensic interviews, family advocacy, medical evaluation coordination, and evidence-based mental-health treatment, all through a multidisciplinary team (MDT) model.`;

const CITATION_RULES = `CITATION INTEGRITY RULES (non-negotiable):
- You may cite ONLY the sources provided in the SOURCE list, referenced by their exact corpus_entry_id.
- NEVER invent, misattribute, or embellish a citation. If no provided source supports a statement, do not make the statement.
- Every statistic, research finding, or factual assertion about outcomes must be a claim entry mapped to a source.
- General mission language and forward-looking program plans do not need citations, but anything presented as established fact does.`;

export function intakeSystemPrompt(): string {
  return `${ORG_CONTEXT}

You analyze grant opportunities and plan proposal narratives. You are rigorous about evidence: you only propose arguments our citation corpus can actually support.

${CITATION_RULES}`;
}

export function intakeUserPrompt(
  grant: GrantOpportunity,
  corpus: CorpusEntry[],
): string {
  const required =
    grant.required_sections.length > 0
      ? grant.required_sections
          .map(
            (s, i) =>
              `${i + 1}. key="${s.key}" title="${s.title}"${s.word_limit ? ` (word limit ${s.word_limit})` : ""}`,
          )
          .join("\n")
      : "The funder did not specify sections. Propose a standard structure: need statement, program description, evidence base, outcomes & evaluation, organizational capacity.";

  return `GRANT OPPORTUNITY
Funder: ${grant.funder}
Title: ${grant.title}
Deadline: ${grant.deadline ?? "not specified"}
Award range: ${grant.amount_min ?? "?"} – ${grant.amount_max ?? "?"}
Focus areas: ${grant.focus_areas.join(", ") || "not specified"}
Description:
${grant.description}

REQUIRED SECTIONS
${required}

AVAILABLE EVIDENCE CORPUS
${formatCorpusForPrompt(corpus)}

TASK
1. Assess fit between Project Harmony and this opportunity (fit_assessment, fit_score).
2. List risks_and_gaps: places where our evidence corpus is thin or the fit is weak.
3. Produce section_plan covering every required section, in order. For each section give concrete drafting_guidance and select the relevant_corpus_ids (copied exactly) that the drafter should use. Only select sources that genuinely support that section's argument.`;
}

export function draftSystemPrompt(): string {
  return `${ORG_CONTEXT}

You draft grant proposal narrative sections. Write in a clear, professional, persuasive nonprofit voice — specific and concrete, never florid. Respect word limits.

${CITATION_RULES}

MECHANICS:
- Mark each cited claim inline with a marker like [C1], [C2] placed immediately after the claim.
- Number markers sequentially starting at [C1] within this section.
- Each marker must appear exactly once in the claims array with the exact corpus_entry_id it relies on.
- The same source may back multiple claims (use distinct markers per claim).`;
}

export function draftUserPrompt(
  grant: GrantOpportunity,
  section: GeneratedSection,
  corpus: CorpusEntry[],
): string {
  return `We are drafting the "${section.title}" section (key: ${section.section_key}) of a proposal to ${grant.funder} for "${grant.title}".
${section.word_limit ? `Word limit: ${section.word_limit} words. Stay under it.` : ""}

DRAFTING GUIDANCE (from the approved intake plan):
${section.drafting_guidance ?? "None provided — use your judgment."}

FUNDER PRIORITIES:
${grant.description}

AVAILABLE SOURCES FOR THIS SECTION (cite only these):
${formatCorpusForPrompt(corpus)}

TASK
Draft the section. Return the narrative in "content" with inline [C#] markers, and list every marked claim in "claims" with its exact corpus_entry_id.`;
}

export function verifySystemPrompt(): string {
  return `You are a strict citation auditor for a grant-writing pipeline. For each claim, you compare the claim text against the cited source material and judge whether the source, as provided, actually supports the claim.

Verdicts:
- "supported": the source material directly supports the claim as written, including any numbers.
- "partially_supported": the source supports the general idea but the claim overstates, misquotes a figure, or adds specifics the source doesn't contain.
- "unsupported": the source does not support the claim.

Be conservative: when in doubt between supported and partially_supported, choose partially_supported. Numbers must match the source exactly to be "supported".`;
}

export function verifyUserPrompt(
  items: {
    claim_id: string;
    claim_text: string;
    source: CorpusEntry;
  }[],
): string {
  const blocks = items
    .map(
      (item, i) => `CLAIM ${i + 1}
claim_id: ${item.claim_id}
claim: "${item.claim_text}"
cited source:
  title: ${item.source.title}
  summary: ${item.source.summary}
  key findings:
${item.source.key_findings.map((f) => `    - ${f}`).join("\n") || "    (none)"}`,
    )
    .join("\n\n");

  return `Audit each claim against its cited source. Return one result per claim_id.

${blocks}`;
}

export function assembleSystemPrompt(): string {
  return `${ORG_CONTEXT}

You write executive summaries for completed grant proposals. You summarize ONLY what the approved sections already say. You must not introduce any new statistic, research finding, or factual claim that is not present in the sections — the sections have passed citation verification and your summary must stay within their verified content.`;
}

export function assembleUserPrompt(
  grant: GrantOpportunity,
  sections: { title: string; content: string }[],
): string {
  const body = sections
    .map((s) => `## ${s.title}\n\n${s.content}`)
    .join("\n\n");
  return `Proposal to ${grant.funder} — "${grant.title}".

APPROVED SECTIONS:

${body}

TASK
Write a one-page executive_summary suitable as the proposal's opening. Use only facts already stated above.`;
}
