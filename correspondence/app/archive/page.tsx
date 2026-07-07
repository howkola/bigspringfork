import Link from "next/link";
import { requireReader } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The Archive: the correspondence as a bound volume. Reading first — generous
// type, no chrome. RLS decides what exists here; this page just lays type.
export default async function ArchiveCover() {
  const { supabase, role } = await requireReader();

  const { data: state } = await supabase.from("app_state").select("revealed").maybeSingle();
  const revealed = !!state?.revealed;

  if (!revealed) {
    return (
      <main className="laid-paper flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-seal font-display text-2xl text-paper">T</div>
          <p className="mt-6 font-display text-xl italic text-ink-soft">
            {role === "writer"
              ? "The volume is not yet bound. It binds from Settings, when the story is told."
              : "Nothing is published here yet."}
          </p>
        </div>
      </main>
    );
  }

  const { data: letters } = await supabase
    .from("letters")
    .select("number,title,in_story_date,status")
    .order("number");

  const { data: phrases } = await supabase.from("concordance_phrases").select("id").limit(1);
  const hasConcordance = (phrases ?? []).length > 0;
  const { data: journal } = await supabase.from("journal_entries").select("id").limit(1);
  const hasJournal = (journal ?? []).length > 0;

  return (
    <main className="laid-paper min-h-screen px-6 py-16">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-seal font-display text-3xl text-paper shadow">T</div>
        <h1 className="mt-8 font-display text-4xl leading-tight">The Correspondence</h1>
        <p className="mt-2 font-display text-lg italic text-ink-soft">
          being the letters of a gentleman of Northamptonshire · 1817
        </p>
        <div className="mx-auto my-10 h-px w-24 bg-sepia" />
        <p className="font-display italic text-ink-soft">
          For the lady who required an Act of Parliament to be free —<br />
          and a single correspondence to be won.
        </p>
        <div className="mx-auto my-10 h-px w-24 bg-sepia" />

        <ol className="space-y-3 text-left">
          {(letters ?? []).map((l) => (
            <li key={l.number}>
              <Link href={`/archive/${l.number}`} className="group flex items-baseline gap-3">
                <span className="font-mono text-xs text-sepia">L{String(l.number).padStart(2, "0")}</span>
                <span className="font-display text-lg group-hover:text-seal">{l.title ?? `Letter ${l.number}`}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-faint">{l.in_story_date ?? ""}</span>
              </Link>
            </li>
          ))}
          {(letters ?? []).length === 0 && (
            <li className="text-center font-display italic text-ink-faint">The volume awaits its letters.</li>
          )}
        </ol>

        {(hasConcordance || hasJournal) && (
          <div className="mt-10 space-y-2 border-t border-sepia/40 pt-6 text-left">
            {hasConcordance && (
              <Link href="/archive/concordance" className="block font-display text-lg hover:text-seal">
                Appendix — Her words, kept
              </Link>
            )}
            {hasJournal && (
              <Link href="/archive/journal" className="block font-display text-lg hover:text-seal">
                Appendix — From the private journal
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
