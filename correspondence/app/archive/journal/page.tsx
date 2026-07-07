import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReader } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Journal pages surface only if the post-reveal toggle is on AND the entry was
// deliberately flipped to the archive. Default is off: the physical journal is
// the endgame gift.
export default async function ArchiveJournal() {
  const { supabase } = await requireReader();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("in_story_date, body")
    .order("in_story_date");
  if (!entries || entries.length === 0) notFound();

  return (
    <main className="laid-paper min-h-screen px-6 py-12">
      <article className="mx-auto max-w-2xl">
        <nav className="mb-8 font-mono text-xs text-sepia">
          <Link href="/archive" className="hover:text-seal">← Contents</Link>
        </nav>
        <h1 className="text-center font-display text-3xl">From the private journal</h1>
        <div className="mt-10 space-y-10">
          {entries.map((e, i) => (
            <section key={i}>
              <h2 className="font-display italic text-sepia">{e.in_story_date}</h2>
              <div className="letter-text mt-2">{e.body}</div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
