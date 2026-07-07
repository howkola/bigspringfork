import { notFound } from "next/navigation";
import { requireWriter } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateReply, addPhrase, addFact } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ReplyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireWriter();
  const { id } = await params;

  const { data: reply } = await supabase
    .from("replies").select("*, letters(id,number,title)").eq("id", id).single();
  if (!reply) notFound();
  const letter = reply.letters as unknown as { id: string; number: number; title: string | null } | null;

  const { data: phrases } = await supabase
    .from("concordance_phrases").select("*").eq("reply_id", id).order("created_at");

  const admin = createAdminClient();
  const photoUrls: string[] = [];
  for (const path of reply.photo_paths ?? []) {
    const { data } = await admin.storage.from("photos").createSignedUrl(path, 3600);
    if (data?.signedUrl) photoUrls.push(data.signedUrl);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-2xl">Reply to Letter {letter?.number}</h1>

      <div className="flex flex-wrap gap-2">
        {photoUrls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt={`reply photograph ${i + 1}`} className="max-h-64 rounded border border-paper-deep" />
        ))}
      </div>

      <form action={updateReply} className="card space-y-3">
        <input type="hidden" name="id" value={reply.id} />
        <label className="block space-y-1">
          <span className="chrome-label">received</span>
          <input className="input w-auto" type="date" name="received_date" defaultValue={reply.received_date} />
        </label>
        <label className="block space-y-1">
          <span className="chrome-label">transcription</span>
          <textarea className="input laid-paper min-h-48 font-display" name="body_text" defaultValue={reply.body_text ?? ""} />
        </label>
        <label className="block space-y-1">
          <span className="chrome-label">notes</span>
          <input className="input" name="notes" defaultValue={reply.notes ?? ""} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="chrome-label">include in the archive volume?</span>
          <select className="input w-auto" name="visibility" defaultValue={reply.visibility}>
            <option value="writer_only">writer only</option>
            <option value="archive">archive (interleave in the volume)</option>
          </select>
        </label>
        <button className="btn btn-seal">Save</button>
      </form>

      <section className="card">
        <div className="chrome-label">Harvest phrases (the Act V exhibit builds itself)</div>
        <ul className="mt-2 space-y-1 text-sm">
          {(phrases ?? []).map((p) => (
            <li key={p.id} className="font-display italic">“{p.phrase}”{p.context_note ? <span className="not-italic text-ink-faint"> — {p.context_note}</span> : null}</li>
          ))}
        </ul>
        <form action={addPhrase} className="mt-3 space-y-2">
          <input type="hidden" name="reply_id" value={reply.id} />
          <input className="input" name="phrase" placeholder="her words, verbatim" required />
          <input className="input" name="context_note" placeholder="context note" />
          <button className="btn">Add to concordance</button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <form action={addFact} className="card space-y-2">
          <div className="chrome-label">What did she ask?</div>
          <p className="text-xs text-ink-faint">Must be answered within one letter.</p>
          <input type="hidden" name="category" value="promise" />
          <input type="hidden" name="letter_id" value={letter?.id ?? ""} />
          <input type="hidden" name="tags" value="her-question" />
          <textarea className="input min-h-16" name="body" placeholder="her question, and what answering it commits him to" />
          <button className="btn">Log to bible</button>
        </form>
        <form action={addFact} className="card space-y-2">
          <div className="chrome-label">What did she love?</div>
          <p className="text-xs text-ink-faint">Feeds the through-lines and the libraries.</p>
          <input type="hidden" name="category" value="established_fact" />
          <input type="hidden" name="letter_id" value={letter?.id ?? ""} />
          <input type="hidden" name="tags" value="she-loved" />
          <textarea className="input min-h-16" name="body" placeholder="what landed — steer the bench toward it" />
          <button className="btn">Log to bible</button>
        </form>
      </section>
    </div>
  );
}
