// verify-citation — adversarial check that a paper actually supports a claim.
// This is the integrity step that makes drafting "research-backed" rather than
// "plausible-sounding": a citation should only be marked `supports` after this.
import { handleOptions, json } from "../_shared/cors.ts";
import { getAuthedContext } from "../_shared/auth.ts";
import { structuredCompletion } from "../_shared/anthropic.ts";

interface VerifyResult {
  verdict: "supports" | "weak" | "contradicts";
  rationale: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["supports", "weak", "contradicts"] },
    rationale: { type: "string" },
  },
  required: ["verdict", "rationale"],
};

const SYSTEM = `You are a rigorous research-integrity reviewer for grant proposals.
Given a CLAIM and a paper's ABSTRACT, judge whether the abstract provides
direct evidence for the claim. Be adversarial and conservative:
- "supports": the abstract reports findings that directly substantiate the claim.
- "weak": related/tangential, small/indirect, or only partial support.
- "contradicts": the abstract's findings run counter to the claim.
Do not give the benefit of the doubt. If the abstract does not clearly address
the claim's specific population, intervention, or outcome, it is at most "weak".
Keep the rationale to 1-2 sentences citing what the abstract actually says.`;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const ctx = await getAuthedContext(req);
  if (!ctx) return json({ error: "Unauthorized" }, 401);

  let body: { claimText?: string; citationAbstract?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const claim = (body.claimText ?? "").trim();
  const abstract = (body.citationAbstract ?? "").trim();
  if (!claim || !abstract) {
    return json({ error: "Provide `claimText` and `citationAbstract`" }, 400);
  }

  try {
    const result = await structuredCompletion<VerifyResult>({
      system: SYSTEM,
      user: `CLAIM:\n${claim}\n\nPAPER TITLE: ${body.title ?? "(unknown)"}\n\nABSTRACT:\n${abstract}`,
      schema: SCHEMA,
      maxTokens: 2000,
      effort: "high",
    });
    return json(result);
  } catch (e) {
    return json({ error: `Verification failed: ${String(e)}` }, 502);
  }
});
