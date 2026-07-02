// OpenAlex client — free, no API key. https://docs.openalex.org
// We reconstruct abstracts from OpenAlex's inverted index and normalize the
// shape the app consumes.

export interface Paper {
  openalex_id: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  cited_by_count: number;
  relevance: number; // 0..1, from OpenAlex relevance_score, normalized
}

// OpenAlex asks that you identify your app via the `mailto` param ("polite pool").
const MAILTO = Deno.env.get("OPENALEX_MAILTO") ?? "evidence-engine@example.com";

function reconstructAbstract(
  inverted: Record<string, number[]> | null | undefined,
): string | null {
  if (!inverted) return null;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const pos of positions) slots[pos] = word;
  }
  const text = slots.filter((w) => w !== undefined).join(" ").trim();
  return text.length ? text : null;
}

function authorsString(authorships: any[] | undefined): string {
  if (!authorships?.length) return "";
  const names = authorships
    .map((a) => a?.author?.display_name)
    .filter(Boolean) as string[];
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")}, et al.`;
}

export async function searchOpenAlex(
  query: string,
  perPage = 8,
): Promise<Paper[]> {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("per_page", String(perPage));
  // Prefer works with abstracts and a DOI; sort by relevance to the query.
  url.searchParams.set("filter", "has_abstract:true");
  url.searchParams.set("sort", "relevance_score:desc");
  url.searchParams.set("mailto", MAILTO);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": `evidence-engine (${MAILTO})` },
  });
  if (!res.ok) {
    throw new Error(`OpenAlex error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const results: any[] = data.results ?? [];

  // Normalize relevance_score into a 0..1 range for display.
  const maxScore = Math.max(
    1,
    ...results.map((r) => Number(r.relevance_score) || 0),
  );

  return results.map((r): Paper => ({
    openalex_id: r.id,
    title: r.display_name ?? r.title ?? "(untitled)",
    authors: authorsString(r.authorships),
    year: r.publication_year ?? null,
    venue: r.primary_location?.source?.display_name ?? null,
    doi: r.doi ? r.doi.replace(/^https?:\/\/doi\.org\//, "") : null,
    url: r.doi ?? r.primary_location?.landing_page_url ?? r.id,
    abstract: reconstructAbstract(r.abstract_inverted_index),
    cited_by_count: r.cited_by_count ?? 0,
    relevance: Math.min(1, (Number(r.relevance_score) || 0) / maxScore),
  }));
}
