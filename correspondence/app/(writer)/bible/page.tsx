import Link from "next/link";
import { requireWriter } from "@/lib/auth";
import { addFact, resolveFact } from "@/app/actions";
import type { BibleCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS: { key: BibleCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "fixed_canon", label: "Fixed canon" },
  { key: "established_fact", label: "Established facts" },
  { key: "promise", label: "Promises" },
  { key: "open_decision", label: "Open decisions" },
  { key: "name_workshop", label: "Name Workshop" },
];

export default async function BiblePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { supabase } = await requireWriter();
  const { q, tab = "all" } = await searchParams;

  let query = supabase
    .from("bible_facts")
    .select("*, letters(number)")
    .order("created_at", { ascending: false });
  if (tab !== "all") query = query.eq("category", tab);
  if (q?.trim()) query = query.textSearch("fts", q.trim(), { type: "websearch" });
  const { data: facts } = await query;

  // full-text over letters too ("did I name his horse?" = 2-second check)
  const { data: letterHits } = q?.trim()
    ? await supabase.from("letters").select("id,number,title").textSearch("fts", q.trim(), { type: "websearch" })
    : { data: [] as { id: string; number: number; title: string | null }[] };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl">Continuity Bible</h1>
        {q && <span className="font-mono text-xs text-ink-faint">searching: “{q}”</span>}
      </div>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/bible?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`pill ${tab === t.key ? "border-seal bg-seal text-paper" : "border-paper-deep text-ink-soft"} ${t.key === "name_workshop" ? "!border-seal" : ""}`}
          >
            {t.label}{t.key === "name_workshop" ? " 🔒" : ""}
          </Link>
        ))}
      </nav>

      {tab === "name_workshop" && (
        <p className="rounded border border-seal bg-seal/10 p-3 font-mono text-xs uppercase tracking-wider text-seal">
          Secret — permanently writer-only. The schema itself refuses to let these rows into the archive.
        </p>
      )}

      {(letterHits ?? []).length > 0 && (
        <section className="card">
          <div className="chrome-label">letters matching “{q}”</div>
          <ul className="mt-2 space-y-1 text-sm">
            {letterHits!.map((l) => (
              <li key={l.id}>
                <Link className="text-seal underline" href={`/letters/${l.id}`}>Letter {l.number}{l.title ? ` — ${l.title}` : ""}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-2">
        {(facts ?? []).length === 0 && <li className="text-sm italic text-ink-faint">Nothing here{q ? " for that search" : ""}.</li>}
        {(facts ?? []).map((f) => {
          const letter = f.letters as unknown as { number: number } | null;
          return (
            <li key={f.id} className="card">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`pill ${f.category === "name_workshop" ? "border-seal text-seal" : f.category === "open_decision" ? "border-sepia text-sepia" : "border-paper-deep text-ink-faint"}`}>
                  {f.category.replace("_", " ")}
                </span>
                {letter && <span className="font-mono text-[11px] text-ink-faint">est. Letter {letter.number}</span>}
                {f.tags?.map((t: string) => <span key={t} className="font-mono text-[11px] text-sepia">#{t}</span>)}
                {f.category === "open_decision" && !f.resolved && (
                  <form action={resolveFact} className="ml-auto">
                    <input type="hidden" name="id" value={f.id} />
                    <button className="btn px-2 py-1" title="Converts to fixed canon">resolve → canon</button>
                  </form>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{f.body}</p>
            </li>
          );
        })}
      </ul>

      <form action={addFact} className="card max-w-xl space-y-2">
        <div className="chrome-label">Record a fact</div>
        <select className="input" name="category" defaultValue={tab !== "all" ? tab : "established_fact"}>
          <option value="fixed_canon">fixed canon</option>
          <option value="established_fact">established fact</option>
          <option value="promise">promise</option>
          <option value="open_decision">open decision</option>
          <option value="name_workshop">name workshop (secret)</option>
        </select>
        <textarea className="input min-h-20" name="body" required placeholder="the fact, the promise, the candidate…" />
        <input className="input" name="tags" placeholder="tags, comma-separated" />
        <button className="btn btn-seal">Record</button>
      </form>
    </div>
  );
}
