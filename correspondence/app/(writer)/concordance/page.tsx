import { requireWriter } from "@/lib/auth";
import { setQuotedBack, addPhrase } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ConcordancePage() {
  const { supabase } = await requireWriter();
  const [{ data: phrases }, { data: letters }] = await Promise.all([
    supabase.from("concordance_phrases")
      .select("*, replies(received_date, letters(number))")
      .order("created_at"),
    supabase.from("letters").select("id,number").order("number"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">The Concordance</h1>
      <p className="max-w-2xl text-sm text-ink-faint">
        Her sentences, verbatim, with where they were quoted back. Six months of this table
        is the declaration exhibit.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-paper-deep text-left">
              <th className="chrome-label py-2 pr-4">received</th>
              <th className="chrome-label py-2 pr-4">her words</th>
              <th className="chrome-label py-2 pr-4">context</th>
              <th className="chrome-label py-2">quoted back in</th>
            </tr>
          </thead>
          <tbody>
            {(phrases ?? []).length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center italic text-ink-faint">Nothing harvested yet.</td></tr>
            )}
            {(phrases ?? []).map((p) => {
              const reply = p.replies as unknown as { received_date: string; letters: { number: number } | null } | null;
              return (
                <tr key={p.id} className="border-b border-paper-deep/60 align-top">
                  <td className="py-2 pr-4 font-mono text-xs">{reply?.received_date ?? "—"}</td>
                  <td className="py-2 pr-4 font-display italic">“{p.phrase}”</td>
                  <td className="py-2 pr-4 text-ink-faint">{p.context_note}</td>
                  <td className="py-2">
                    <form action={setQuotedBack} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <select className="input w-auto py-1" name="letter_id" defaultValue={p.quoted_back_in_letter_id ?? ""}>
                        <option value="">not yet</option>
                        {(letters ?? []).map((l) => (
                          <option key={l.id} value={l.id}>Letter {l.number}</option>
                        ))}
                      </select>
                      <button className="btn px-2 py-1">set</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form action={addPhrase} className="card max-w-xl space-y-2">
        <div className="chrome-label">Add a phrase (no reply attached)</div>
        <input className="input" name="phrase" placeholder="her words, verbatim" required />
        <input className="input" name="context_note" placeholder="context (spoken? undated note?)" />
        <button className="btn">Add</button>
      </form>
    </div>
  );
}
