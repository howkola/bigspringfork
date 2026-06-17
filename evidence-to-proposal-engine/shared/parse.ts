// Tolerant parsers for model output. Kept identical in spirit to the prototype:
// a token-limit truncation should degrade gracefully, never throw away the run.

/** Strip code fences and trim to the outermost braces, then JSON.parse. */
export function parseJsonLoose(raw: string): unknown {
  if (!raw) throw new Error("Empty model response");
  let t = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in response");
  }
  t = t.slice(start, end + 1);
  return JSON.parse(t);
}

interface LooseCitation {
  id?: string;
  authors?: string;
  year?: string;
  title?: string;
  source?: string;
  finding?: string;
}

/**
 * Truncation-tolerant citation parser: if the JSON was cut off mid-string
 * (max_tokens), salvage every COMPLETE flat object individually instead of
 * failing the whole parse.
 */
export function parseCitationsLoose(raw: string): LooseCitation[] {
  try {
    const parsed = parseJsonLoose(raw) as { citations?: LooseCitation[] };
    if (Array.isArray(parsed.citations)) return parsed.citations;
  } catch {
    /* fall through to salvage mode */
  }
  const objs = (raw || "").match(/\{[^{}]*\}/g) || [];
  const out: LooseCitation[] = [];
  for (const o of objs) {
    try {
      const c = JSON.parse(o) as LooseCitation;
      if (c && c.title && c.authors) out.push(c);
    } catch {
      /* skip incomplete trailing object */
    }
  }
  return out;
}

/** Strip a leading/trailing markdown code fence from a section draft. */
export function stripFences(text: string): string {
  return text
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}
