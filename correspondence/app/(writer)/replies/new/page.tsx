import { requireWriter } from "@/lib/auth";
import { logReply } from "@/app/actions";

export const dynamic = "force-dynamic";

// MOBILE-CRITICAL: one-thumb flow, excellent at 390px.
// Photo first, everything else optional; details can wait for the desk.
export default async function NewReply() {
  const { supabase } = await requireWriter();
  const { data: letters } = await supabase
    .from("letters").select("id,number,title,status")
    .in("status", ["delivered", "replied"])
    .order("number", { ascending: false });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl">Log a reply</h1>
      {(letters ?? []).length === 0 ? (
        <p className="card text-sm text-ink-faint">
          No delivered letters yet — a reply needs a letter to answer. Walk one to “delivered” first.
        </p>
      ) : (
        <form action={logReply} className="space-y-4">
          <label className="block space-y-1">
            <span className="chrome-label">replying to</span>
            <select className="input py-3 text-base" name="letter_id" defaultValue={letters![0].id} required>
              {letters!.map((l) => (
                <option key={l.id} value={l.id}>Letter {l.number}{l.title ? ` — ${l.title}` : ""}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="chrome-label">photograph(s) of her reply</span>
            <input className="input py-3" type="file" name="photos" accept="image/*" capture="environment" multiple />
          </label>

          <label className="block space-y-1">
            <span className="chrome-label">received</span>
            <input className="input py-3" type="date" name="received_date" defaultValue={today} />
          </label>

          <details className="card">
            <summary className="chrome-label cursor-pointer">transcription & notes (can wait)</summary>
            <label className="mt-3 block space-y-1">
              <span className="chrome-label">transcription</span>
              <textarea className="input min-h-32" name="body_text" placeholder="her words, verbatim…" />
            </label>
            <label className="mt-3 block space-y-1">
              <span className="chrome-label">notes</span>
              <input className="input" name="notes" />
            </label>
          </details>

          <details className="card" open>
            <summary className="chrome-label cursor-pointer">first phrase for the concordance</summary>
            <label className="mt-3 block space-y-1">
              <span className="chrome-label">paste phrase (verbatim)</span>
              <input className="input py-3 text-base" name="phrase" placeholder="her exact words" />
            </label>
            <label className="mt-3 block space-y-1">
              <span className="chrome-label">context</span>
              <input className="input" name="phrase_note" />
            </label>
          </details>

          <button className="btn btn-seal w-full py-4 text-sm">Done — save the reply</button>
        </form>
      )}
    </div>
  );
}
