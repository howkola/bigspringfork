import Link from "next/link";
import { requireWriter } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RepliesPage() {
  const { supabase } = await requireWriter();
  const { data: replies } = await supabase
    .from("replies")
    .select("id,letter_id,received_date,body_text,photo_paths,visibility, letters(number,title)")
    .order("received_date", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Her replies</h1>
        <Link href="/replies/new" className="btn btn-seal">Log reply</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(replies ?? []).length === 0 && (
          <p className="text-sm italic text-ink-faint">No replies yet. The post is slow in 1817.</p>
        )}
        {(replies ?? []).map((r) => {
          const letter = r.letters as unknown as { number: number; title: string | null } | null;
          return (
            <Link key={r.id} href={`/replies/${r.id}`} className="card transition hover:border-sepia">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg">Reply to Letter {letter?.number ?? "?"}</span>
                <span className="font-mono text-xs text-ink-faint">{r.received_date}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                {r.body_text ?? <span className="italic text-ink-faint">no transcription yet · {r.photo_paths.length} photo(s)</span>}
              </p>
              {r.visibility === "archive" && <span className="pill mt-2 border-seal text-seal">in the volume</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
