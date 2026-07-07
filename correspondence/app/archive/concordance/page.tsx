import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReader } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The Act V exhibit as an appendix. RLS only surfaces these rows when the
// post-reveal toggle is on and each row was flipped to the archive.
export default async function ArchiveConcordance() {
  const { supabase } = await requireReader();
  const { data: phrases } = await supabase
    .from("concordance_phrases")
    .select("phrase, context_note, replies(received_date)")
    .order("created_at");
  if (!phrases || phrases.length === 0) notFound();

  return (
    <main className="laid-paper min-h-screen px-6 py-12">
      <article className="mx-auto max-w-2xl">
        <nav className="mb-8 font-mono text-xs text-sepia">
          <Link href="/archive" className="hover:text-seal">← Contents</Link>
        </nav>
        <h1 className="text-center font-display text-3xl">Her words, kept</h1>
        <p className="mt-2 text-center font-display italic text-ink-soft">
          a concordance of sentences he could not let go of
        </p>
        <div className="mt-10 space-y-6">
          {phrases.map((p, i) => {
            const reply = p.replies as unknown as { received_date: string } | null;
            return (
              <figure key={i}>
                <blockquote className="letter-text text-xl">“{p.phrase}”</blockquote>
                <figcaption className="mt-1 font-mono text-[11px] text-ink-faint">
                  {reply?.received_date ?? ""}{p.context_note ? ` · ${p.context_note}` : ""}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </article>
    </main>
  );
}
