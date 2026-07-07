// Module 5 — the Guardian. Review only; never edits, never drafts, never
// persists suggestions into the letter. The API key lives server-side only.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { roleOf } from "@/lib/auth";
import type { GuardianFinding } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "claude-sonnet-4-6";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || roleOf(user) !== "writer") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const { letter_id, draft_version } = (await request.json()) as {
    letter_id?: string;
    draft_version?: number;
  };
  if (!letter_id) return NextResponse.json({ error: "letter_id required" }, { status: 400 });

  // ---- context assembly (server-side) ----
  const { data: letter } = await supabase.from("letters").select("*").eq("id", letter_id).single();
  if (!letter) return NextResponse.json({ error: "letter not found" }, { status: 404 });

  let draftBody = letter.final_text ?? "";
  if (draft_version != null) {
    const { data: draft } = await supabase
      .from("letter_drafts").select("body")
      .eq("letter_id", letter_id).eq("version", draft_version).single();
    if (draft?.body) draftBody = draft.body;
  }
  if (!draftBody.trim()) {
    return NextResponse.json({ error: "nothing to review: the draft is empty" }, { status: 400 });
  }

  const [{ data: configRows }, { data: facts }, { data: priorLetters }, { data: enclosures }] =
    await Promise.all([
      supabase.from("config").select("key,value"),
      supabase.from("bible_facts").select("category,body")
        .in("category", ["fixed_canon", "established_fact", "promise"]),
      supabase.from("letters").select("number,title,summary,salutation_rung,closing_rung,status")
        .lt("number", letter.number).order("number"),
      supabase.from("enclosures").select("kind,ref_id,description").eq("letter_id", letter_id),
    ]);

  const config = Object.fromEntries((configRows ?? []).map((r) => [r.key, r.value]));
  const glossary = (config.glossary ?? {}) as Record<string, unknown>;
  const ladder = (config.ladder ?? {}) as Record<string, unknown>;
  const acts = (config.acts ?? {}) as Record<string, { title?: string; notes?: string }>;
  const throughlines = (config.throughlines ?? {}) as Record<string, string>;
  const austenRules = (config.austen_rules ?? {}) as Record<string, unknown>;

  // guardrails of attached library items
  const guardrails: string[] = [];
  for (const enc of enclosures ?? []) {
    if (enc.kind === "austen" && enc.ref_id) {
      const { data } = await supabase.from("austen_items").select("code,title,guardrails").eq("id", enc.ref_id).single();
      if (data?.guardrails) guardrails.push(`${data.code} (${data.title}): ${data.guardrails}`);
    }
  }

  const delivered = (priorLetters ?? []).filter((l) =>
    ["delivered", "replied"].includes(l.status as string));
  const priorSummaries = delivered
    .map((l) => `Letter ${l.number}${l.title ? ` — ${l.title}` : ""} (salutation rung ${l.salutation_rung ?? "?"}, closing rung ${l.closing_rung ?? "?"}): ${l.summary ?? "(no summary recorded)"}`)
    .join("\n");
  const lastRungs = delivered.at(-1);

  const actNote = acts[String(letter.act)] ?? {};

  const system = `You are the Guardian for a serial epistolary work set in England, 1817, written in Regency voice. You REVIEW drafts; you never rewrite, never draft, never supply replacement prose beyond a brief optional suggestion. Return findings strictly as JSON: {"findings":[{"severity":"blocker"|"warning"|"note","category":"anachronism"|"continuity"|"ladder"|"throughline"|"voice"|"guardrail","excerpt":"<verbatim text from the draft>","explanation":"...","suggestion":"(optional)"}]}. Return {"findings":[]} if nothing is wrong. No prose outside the JSON.

What you must catch:
- anachronism: any blacklisted word; false friends used with their modern sense; post-1817 references.
- continuity: contradiction of any fixed canon, established fact, or promise listed below.
- ladder: salutation/closing advancing more than ${(ladder as { rules?: { max_advance_per_letter?: number } }).rules?.max_advance_per_letter ?? 1} rung(s) from the previous delivered letter; unearned retreats (one deliberate retreat is allowed, in Act 4 only).
- throughline: missing Stella postscript; misuse of the fixed wrong-direction idiom; a Gigi question left unanswered beyond one letter.
- voice: departures from the writer's voice card; fashionable intensifiers he never uses.
- guardrail: violating any enclosure guardrail, especially: never name the authoress before Letter ${(austenRules as { never_name_before_letter?: number }).never_name_before_letter ?? 17}; never use in-story titles that do not exist yet.`;

  const userMsg = `LETTER UNDER REVIEW: Letter ${letter.number}, Act ${letter.act}${letter.title ? ` — ${letter.title}` : ""}
In-story date: ${letter.in_story_date ?? "unset"}
Proposed salutation rung: ${letter.salutation_rung ?? "unset"}; proposed closing rung: ${letter.closing_rung ?? "unset"}
Previous delivered letter rungs: salutation ${lastRungs?.salutation_rung ?? "n/a"}, closing ${lastRungs?.closing_rung ?? "n/a"}

ACT NOTES: ${actNote.title ?? ""} — ${actNote.notes ?? ""}

LADDER CONFIG: ${JSON.stringify(ladder)}

THROUGH-LINE RULES: ${JSON.stringify(throughlines)}

ANACHRONISM BLACKLIST: ${JSON.stringify((glossary as { blacklist?: unknown }).blacklist ?? [])}

FALSE FRIENDS: ${JSON.stringify((glossary as { false_friends?: unknown }).false_friends ?? [])}

VOICE CARDS: ${JSON.stringify((glossary as { voice_cards?: unknown }).voice_cards ?? {})}

CANON (fixed canon, established facts, promises):
${(facts ?? []).map((f) => `- [${f.category}] ${f.body}`).join("\n")}

ENCLOSURE GUARDRAILS FOR THIS LETTER:
${guardrails.length ? guardrails.join("\n") : "(none attached)"}

PRIOR DELIVERED LETTERS:
${priorSummaries || "(none yet)"}

THE DRAFT:
<<<
${draftBody}
>>>`;

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let findings: { findings: GuardianFinding[] };
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    findings = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(findings.findings)) throw new Error("bad shape");
  } catch {
    findings = {
      findings: [{
        severity: "note",
        category: "voice",
        excerpt: "",
        explanation: `The Guardian returned an unparseable review. Raw output: ${text.slice(0, 500)}`,
      }],
    };
  }

  const { data: saved, error } = await supabase
    .from("guardian_reviews")
    .insert({ letter_id, draft_version: draft_version ?? null, findings, model: MODEL })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(saved);
}
