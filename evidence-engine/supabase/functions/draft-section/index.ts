// draft-section — rewrite a passage of grant narrative so it weaves in the
// selected evidence with inline citation markers. Returns structured output:
// the drafted markdown plus which citations were used and where.
import { handleOptions, json } from "../_shared/cors.ts";
import { getAuthedContext } from "../_shared/auth.ts";
import { structuredCompletion } from "../_shared/anthropic.ts";

interface CitationInput {
  id: string; // caller-supplied stable id (e.g. DB citation id or index)
  title: string;
  authors?: string;
  year?: number | null;
  abstract?: string | null;
  verdict?: string | null;
}

interface DraftResult {
  draft_markdown: string;
  citations_used: { id: string; supports: string }[];
  unused_citations: string[];
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    draft_markdown: { type: "string" },
    citations_used: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          supports: { type: "string" },
        },
        required: ["id", "supports"],
      },
    },
    unused_citations: { type: "array", items: { type: "string" } },
  },
  required: ["draft_markdown", "citations_used", "unused_citations"],
};

const SYSTEM = `You are an expert grant writer. Rewrite the provided passage of a
grant narrative so it is evidence-backed, persuasive, and funder-ready.

Rules:
- Ground every factual/statistical assertion in the supplied evidence. Insert an
  inline citation marker of the form [id] immediately after each supported
  statement, where "id" is the citation's id.
- Do NOT invent citations, findings, statistics, or facts not present in the
  supplied evidence. If a claim cannot be supported by the evidence, keep it but
  do not attach a citation.
- Prefer citations whose verdict is "supports" over "weak"; do not use any whose
  verdict is "contradicts".
- Preserve the author's intent and any section-specific framing given in context.
- Return clean markdown for the passage only (no headings unless the input had one).
- In citations_used, list each id you cited and a one-line note on what it supports.
- In unused_citations, list ids you were given but chose not to use.`;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const ctx = await getAuthedContext(req);
  if (!ctx) return json({ error: "Unauthorized" }, 401);

  let body: {
    sectionContext?: string;
    passage?: string;
    claims?: string[];
    citations?: CitationInput[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const passage = (body.passage ?? "").trim();
  const citations = body.citations ?? [];
  if (!passage) return json({ error: "Provide `passage` to draft" }, 400);
  if (!citations.length) {
    return json({ error: "Provide at least one citation" }, 400);
  }

  const evidenceBlock = citations
    .map(
      (c) =>
        `[${c.id}] ${c.title}${c.authors ? ` — ${c.authors}` : ""}${
          c.year ? ` (${c.year})` : ""
        }${c.verdict ? ` [verdict: ${c.verdict}]` : ""}\nAbstract: ${
          c.abstract ?? "(no abstract available)"
        }`,
    )
    .join("\n\n");

  const user = [
    body.sectionContext ? `SECTION CONTEXT:\n${body.sectionContext}\n` : "",
    body.claims?.length ? `KEY CLAIMS TO SUPPORT:\n- ${body.claims.join("\n- ")}\n` : "",
    `PASSAGE TO REWRITE:\n${passage}\n`,
    `AVAILABLE EVIDENCE (cite by id):\n${evidenceBlock}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await structuredCompletion<DraftResult>({
      system: SYSTEM,
      user,
      schema: SCHEMA,
      maxTokens: 8000,
      effort: "high",
    });
    return json(result);
  } catch (e) {
    return json({ error: `Drafting failed: ${String(e)}` }, 502);
  }
});
