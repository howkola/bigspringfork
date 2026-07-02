import { z } from "zod";

/**
 * Paired JSON Schemas (sent to the API as output_config.format) and Zod
 * validators (used to re-validate the parsed response server-side).
 */

// ---------------------------------------------------------------------------
// Stage 1: Intake — fit analysis + section plan
// ---------------------------------------------------------------------------

export const intakeJsonSchema = {
  type: "object",
  properties: {
    fit_assessment: {
      type: "string",
      description:
        "2-4 paragraph assessment of how well Project Harmony's programs fit this funder's priorities.",
    },
    fit_score: {
      type: "integer",
      enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      description: "Overall fit, 1 (poor) to 10 (excellent).",
    },
    risks_and_gaps: {
      type: "array",
      items: { type: "string" },
      description:
        "Weaknesses in our evidence base or program fit the team should address before submitting.",
    },
    section_plan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          sort_order: { type: "integer" },
          word_limit: { type: ["integer", "null"] },
          drafting_guidance: {
            type: "string",
            description:
              "Concrete guidance for drafting this section: what to argue, which evidence to lead with, funder language to mirror.",
          },
          relevant_corpus_ids: {
            type: "array",
            items: { type: "string" },
            description:
              "corpus_entry_id values (exactly as given in the source list) most relevant to this section.",
          },
        },
        required: [
          "key",
          "title",
          "sort_order",
          "word_limit",
          "drafting_guidance",
          "relevant_corpus_ids",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["fit_assessment", "fit_score", "risks_and_gaps", "section_plan"],
  additionalProperties: false,
} as const;

export const intakeValidator = z.object({
  fit_assessment: z.string().min(1),
  fit_score: z.number().int().min(1).max(10),
  risks_and_gaps: z.array(z.string()),
  section_plan: z
    .array(
      z.object({
        key: z.string().min(1),
        title: z.string().min(1),
        sort_order: z.number().int(),
        word_limit: z.number().int().nullable(),
        drafting_guidance: z.string().min(1),
        relevant_corpus_ids: z.array(z.string()),
      }),
    )
    .min(1),
});

export type IntakeOutput = z.infer<typeof intakeValidator>;

// ---------------------------------------------------------------------------
// Stage 2: Section drafting — narrative with claim-to-citation mapping
// ---------------------------------------------------------------------------

export const draftJsonSchema = {
  type: "object",
  properties: {
    content: {
      type: "string",
      description:
        "The drafted narrative section. Every factual claim must carry an inline marker like [C1] that maps to an entry in claims.",
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          citation_marker: {
            type: "string",
            description: "The inline marker used in content, e.g. [C1].",
          },
          claim_text: {
            type: "string",
            description: "The factual claim exactly as stated in the content.",
          },
          corpus_entry_id: {
            type: "string",
            description:
              "The corpus_entry_id of the supporting source, copied exactly from the provided source list. Never invent an id.",
          },
        },
        required: ["citation_marker", "claim_text", "corpus_entry_id"],
        additionalProperties: false,
      },
    },
  },
  required: ["content", "claims"],
  additionalProperties: false,
} as const;

export const draftValidator = z.object({
  content: z.string().min(1),
  claims: z.array(
    z.object({
      citation_marker: z.string().regex(/^\[C\d+\]$/),
      claim_text: z.string().min(1),
      corpus_entry_id: z.string().min(1),
    }),
  ),
});

export type DraftOutput = z.infer<typeof draftValidator>;

// ---------------------------------------------------------------------------
// Stage 3: Citation verification — claim-by-claim support check
// ---------------------------------------------------------------------------

export const verifyJsonSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim_id: { type: "string" },
          verdict: {
            type: "string",
            enum: ["supported", "partially_supported", "unsupported"],
          },
          reasoning: {
            type: "string",
            description:
              "One or two sentences explaining exactly what in the source does or does not support the claim.",
          },
        },
        required: ["claim_id", "verdict", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

export const verifyValidator = z.object({
  results: z.array(
    z.object({
      claim_id: z.string().min(1),
      verdict: z.enum(["supported", "partially_supported", "unsupported"]),
      reasoning: z.string().min(1),
    }),
  ),
});

export type VerifyOutput = z.infer<typeof verifyValidator>;

// ---------------------------------------------------------------------------
// Stage 5: Final assembly — executive summary + transitions polish
// ---------------------------------------------------------------------------

export const assembleJsonSchema = {
  type: "object",
  properties: {
    executive_summary: {
      type: "string",
      description:
        "A one-page executive summary of the full proposal. Summarize only what the approved sections say; introduce no new factual claims or statistics.",
    },
  },
  required: ["executive_summary"],
  additionalProperties: false,
} as const;

export const assembleValidator = z.object({
  executive_summary: z.string().min(1),
});

export type AssembleOutput = z.infer<typeof assembleValidator>;
