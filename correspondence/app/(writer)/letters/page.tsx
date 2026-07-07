import Link from "next/link";
import { requireWriter } from "@/lib/auth";
import { createLetter } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  outlined: "border-ink-faint text-ink-faint",
  drafted: "border-sepia text-sepia",
  fair_copy: "border-sepia text-ink-soft",
  photographed: "border-ink-soft text-ink-soft",
  sealed: "border-seal text-seal",
  delivered: "border-seal bg-seal text-paper",
  replied: "border-ink bg-ink text-paper",
};

export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { supabase } = await requireWriter();
  const params = await searchParams;
  const [{ data: letters }, { data: actsRow }] = await Promise.all([
    supabase.from("letters").select("id,number,act,title,status,in_story_date,sent_date").order("number"),
    supabase.from("config").select("value").eq("key", "acts").single(),
  ]);
  const acts = (actsRow?.value ?? {}) as Record<string, { title?: string; letters?: string; notes?: string }>;
  const nextNumber = params.new ? Number(params.new) : ((letters ?? []).at(-1)?.number ?? 0) + 1;

  return (
    <div className="space-y-8">
      {[1, 2, 3, 4, 5].map((act) => {
        const inAct = (letters ?? []).filter((l) => l.act === act);
        const meta = acts[String(act)] ?? {};
        return (
          <section key={act}>
            <h2 className="font-display text-xl">
              Act {act}{meta.title ? ` — ${meta.title}` : ""}
              <span className="ml-2 font-mono text-xs text-ink-faint">{meta.letters ?? ""}</span>
            </h2>
            {meta.notes && <p className="mt-1 max-w-3xl text-sm text-ink-faint">{meta.notes}</p>}
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {inAct.length === 0 && (
                <p className="text-sm italic text-ink-faint">Nothing outlined yet.</p>
              )}
              {inAct.map((l) => (
                <Link key={l.id} href={`/letters/${l.id}`} className="card transition hover:border-sepia">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-lg">Letter {l.number}</span>
                    <span className={`pill ${STATUS_COLORS[l.status] ?? ""}`}>{l.status.replace("_", " ")}</span>
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">{l.title ?? <span className="italic text-ink-faint">untitled</span>}</div>
                  <div className="mt-1 font-mono text-[11px] text-ink-faint">
                    {l.in_story_date ? `in-story ${l.in_story_date}` : "in-story date unset"}
                    {l.sent_date ? ` · sent ${l.sent_date}` : ""}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <section className="card max-w-md">
        <h3 className="chrome-label">Begin a letter</h3>
        <form action={createLetter} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="chrome-label">number</span>
            <input className="input w-20" name="number" type="number" min={1} defaultValue={nextNumber} required />
          </label>
          <label className="space-y-1">
            <span className="chrome-label">act</span>
            <input className="input w-16" name="act" type="number" min={1} max={5} defaultValue={Math.min(5, Math.ceil(nextNumber / 5))} required />
          </label>
          <label className="flex-1 space-y-1">
            <span className="chrome-label">title</span>
            <input className="input" name="title" placeholder="working title" />
          </label>
          <button className="btn btn-seal">Outline it</button>
        </form>
      </section>
    </div>
  );
}
