import { notFound } from "next/navigation";
import { requireWriter } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  updateLetter, saveDraft, uploadLetterPhoto, attachEnclosure, removeEnclosure,
  setEnclosureVisibility, logThroughline,
} from "@/app/actions";
import { GuardianPanel } from "@/components/guardian-panel";
import { StatusWalker } from "@/components/status-walker";
import type { GuardianReview, LadderConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LetterDetail({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireWriter();
  const { id } = await params;

  const { data: letter } = await supabase.from("letters").select("*").eq("id", id).single();
  if (!letter) notFound();

  const [{ data: drafts }, { data: enclosures }, { data: events }, { data: reviews },
    { data: actsRow }, { data: ladderRow },
    { data: poems }, { data: clippings }, { data: austen }] = await Promise.all([
    supabase.from("letter_drafts").select("*").eq("letter_id", id).order("version", { ascending: false }),
    supabase.from("enclosures").select("*").eq("letter_id", id).order("created_at"),
    supabase.from("throughline_events").select("*").eq("letter_id", id).order("created_at"),
    supabase.from("guardian_reviews").select("*").eq("letter_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.from("config").select("value").eq("key", "acts").single(),
    supabase.from("config").select("value").eq("key", "ladder").single(),
    supabase.from("poems").select("id,poet,title,act,status,reserved_for_letter_number").in("status", ["available", "reserved"]).order("act"),
    supabase.from("clippings").select("id,number,publication,act,status,reserved_for_letter_number").in("status", ["available", "reserved"]).order("number"),
    supabase.from("austen_items").select("id,code,title,tier,act,status,reserved_for_letter_number,guardrails").in("status", ["available", "reserved"]).order("code"),
  ]);

  const acts = (actsRow?.value ?? {}) as Record<string, { title?: string; notes?: string }>;
  const ladder = (ladderRow?.value ?? { salutations: [], closings: [], rules: { note: "" } }) as LadderConfig;
  const actNote = acts[String(letter.act)] ?? {};
  const sealed = letter.status === "sealed" || letter.status === "delivered" || letter.status === "replied";

  // photo previews via short-lived signed URLs (bucket is private)
  const admin = createAdminClient();
  const photoUrls: { path: string; url: string }[] = [];
  for (const path of letter.photo_paths ?? []) {
    const { data } = await admin.storage.from("photos").createSignedUrl(path, 3600);
    if (data?.signedUrl) photoUrls.push({ path, url: data.signedUrl });
  }

  // labels for attached enclosures
  const refLabel = new Map<string, string>();
  for (const enc of enclosures ?? []) {
    if (!enc.ref_id) continue;
    if (enc.kind === "poem") {
      const { data } = await supabase.from("poems").select("poet,title").eq("id", enc.ref_id).single();
      if (data) refLabel.set(enc.id, `${data.poet} — ${data.title}`);
    } else if (enc.kind === "clipping") {
      const { data } = await supabase.from("clippings").select("number,publication").eq("id", enc.ref_id).single();
      if (data) refLabel.set(enc.id, `Clipping ${data.number} (${data.publication ?? ""})`);
    } else if (enc.kind === "austen") {
      const { data } = await supabase.from("austen_items").select("code,title").eq("id", enc.ref_id).single();
      if (data) refLabel.set(enc.id, `${data.code} — ${data.title}`);
    }
  }
  const attachedAusten = (enclosures ?? []).filter((e) => e.kind === "austen" && e.ref_id);
  const austenGuardrails: string[] = [];
  for (const enc of attachedAusten) {
    const { data } = await supabase.from("austen_items").select("code,guardrails").eq("id", enc.ref_id!).single();
    if (data?.guardrails) austenGuardrails.push(`${data.code}: ${data.guardrails}`);
  }

  const throughlineChecklist = [
    { kind: "stella_barometer", label: "Stella postscript?" },
    { kind: "wrong_direction", label: "Wrong-direction usage?" },
    { kind: "gigi_question", label: "Gigi question (asked/answered)?" },
    { kind: "claire_ledger", label: "Claire ledger update?" },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-2xl">Letter {letter.number}</h1>
        <span className="text-ink-faint">Act {letter.act}</span>
        <span className="font-display italic text-ink-soft">{letter.title ?? ""}</span>
      </header>

      <StatusWalker letterId={letter.id} status={letter.status} hasPhoto={(letter.photo_paths ?? []).length > 0} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* left: outline & act notes, through-lines, enclosures */}
        <div className="space-y-4">
          <section className="card">
            <div className="chrome-label">Act {letter.act} — {actNote.title ?? ""}</div>
            <p className="mt-2 text-sm text-ink-soft">{actNote.notes ?? "No act notes seeded."}</p>
          </section>

          <section className="card">
            <div className="chrome-label">Enclosures</div>
            <ul className="mt-2 space-y-2 text-sm">
              {(enclosures ?? []).length === 0 && <li className="italic text-ink-faint">Nothing enclosed yet.</li>}
              {(enclosures ?? []).map((enc) => (
                <li key={enc.id} className="flex flex-wrap items-center gap-2">
                  <span className="pill border-sepia text-sepia">{enc.kind}</span>
                  <span className="font-display italic">{refLabel.get(enc.id) ?? enc.description ?? "—"}</span>
                  <form action={setEnclosureVisibility} className="ml-auto">
                    <input type="hidden" name="id" value={enc.id} />
                    <input type="hidden" name="letter_id" value={letter.id} />
                    <input type="hidden" name="visibility" value={enc.visibility === "archive" ? "writer_only" : "archive"} />
                    <button className={`pill ${enc.visibility === "archive" ? "border-seal text-seal" : "border-paper-deep text-ink-faint"}`}
                      title="Toggle whether this enclosure appears in the final Archive volume">
                      {enc.visibility === "archive" ? "in the volume" : "writer only"}
                    </button>
                  </form>
                  <form action={removeEnclosure}>
                    <input type="hidden" name="id" value={enc.id} />
                    <input type="hidden" name="letter_id" value={letter.id} />
                    <button className="btn px-2 py-0.5">detach</button>
                  </form>
                </li>
              ))}
            </ul>
            {austenGuardrails.length > 0 && (
              <div className="mt-3 rounded border border-seal/40 bg-seal/5 p-2 text-xs text-seal">
                {austenGuardrails.map((g, i) => <p key={i}>{g}</p>)}
              </div>
            )}

            <form action={attachEnclosure} className="mt-4 space-y-2">
              <input type="hidden" name="letter_id" value={letter.id} />
              <div className="chrome-label">attach</div>
              <select className="input" name="kind" required defaultValue="poem">
                <option value="poem">poem (library)</option>
                <option value="clipping">clipping (library)</option>
                <option value="austen">manuscript item (library)</option>
                <option value="object">free-text object</option>
              </select>
              <select className="input" name="ref_id" defaultValue="">
                <option value="">— library item (for poem/clipping/manuscript) —</option>
                <optgroup label="Poems (available + act-matched first)">
                  {(poems ?? [])
                    .sort((a, b) => Number(b.act === letter.act) - Number(a.act === letter.act))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.status === "reserved" ? `[held L${p.reserved_for_letter_number}] ` : ""}Act {p.act} · {p.poet} — {p.title}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Clippings">
                  {(clippings ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.status === "reserved" ? `[held L${c.reserved_for_letter_number}] ` : ""}#{c.number} · {c.publication}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Manuscript / Austen">
                  {(austen ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.status === "reserved" ? `[held L${a.reserved_for_letter_number}] ` : ""}{a.code} · {a.title}
                    </option>
                  ))}
                </optgroup>
              </select>
              <input className="input" name="description" placeholder="description (required for objects; optional otherwise)" />
              <button className="btn">Enclose</button>
              <p className="text-xs text-ink-faint">Attaching a library item marks it used; the database refuses reserved treasures on the wrong letter.</p>
            </form>
          </section>

          <section className="card">
            <div className="chrome-label">Through-line checklist</div>
            <ul className="mt-2 space-y-1 text-sm">
              {throughlineChecklist.map(({ kind, label }) => {
                const logged = (events ?? []).filter((e) => e.kind === kind);
                return (
                  <li key={kind} className="flex items-center gap-2">
                    <span className={logged.length ? "text-seal" : "text-ink-faint"}>{logged.length ? "✓" : "○"}</span>
                    <span>{label}</span>
                    {logged.length > 0 && <span className="ml-auto font-mono text-[11px] text-ink-faint">{logged.at(-1)?.value ?? logged.length}</span>}
                  </li>
                );
              })}
            </ul>
            <form action={logThroughline} className="mt-3 space-y-2">
              <input type="hidden" name="letter_id" value={letter.id} />
              <div className="flex gap-2">
                <select className="input" name="kind" required>
                  <option value="stella_barometer">stella barometer</option>
                  <option value="wrong_direction">wrong direction</option>
                  <option value="gigi_question">gigi question</option>
                  <option value="claire_ledger">claire ledger</option>
                </select>
                <input className="input w-24" name="numeric_value" placeholder="±0–5" title="numeric reading (barometer −5…5, ledger score, etc.)" />
              </div>
              <input className="input" name="value" placeholder='value — e.g. "asked: what does the T stand for?" or the P.S. line' />
              <button className="btn">Log it</button>
            </form>
          </section>

          <section className="card">
            <div className="chrome-label">Photographs</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {photoUrls.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.path} src={p.url} alt="letter photograph" className="h-24 rounded border border-paper-deep object-cover" />
              ))}
              {photoUrls.length === 0 && <p className="text-sm italic text-ink-faint">None yet — required before “photographed”.</p>}
            </div>
            <form action={uploadLetterPhoto} className="mt-3 flex items-center gap-2">
              <input type="hidden" name="letter_id" value={letter.id} />
              <input className="input" type="file" name="photo" accept="image/*" capture="environment" />
              <button className="btn">Upload</button>
            </form>
          </section>
        </div>

        {/* right: the editor */}
        <div className="space-y-4">
          <form action={updateLetter} className="card space-y-3">
            <input type="hidden" name="id" value={letter.id} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="space-y-1">
                <span className="chrome-label">title</span>
                <input className="input" name="title" defaultValue={letter.title ?? ""} />
              </label>
              <label className="space-y-1">
                <span className="chrome-label">act</span>
                <input className="input" name="act" type="number" min={1} max={5} defaultValue={letter.act} />
              </label>
              <label className="space-y-1">
                <span className="chrome-label">in-story date (1817)</span>
                <input className="input" name="in_story_date" type="date" min="1800-01-01" max="1899-12-31" defaultValue={letter.in_story_date ?? "1817-03-24"} />
              </label>
              <label className="space-y-1">
                <span className="chrome-label">sent (real)</span>
                <input className="input" name="sent_date" type="date" defaultValue={letter.sent_date ?? ""} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="chrome-label">salutation rung</span>
                <select className="input" name="salutation_rung" defaultValue={letter.salutation_rung ?? ""}>
                  <option value="">—</option>
                  {ladder.salutations.map((s, i) => (
                    <option key={i} value={i + 1}>{i + 1} · {s}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="chrome-label">closing rung</span>
                <select className="input" name="closing_rung" defaultValue={letter.closing_rung ?? ""}>
                  <option value="">—</option>
                  {ladder.closings.map((s, i) => (
                    <option key={i} value={i + 1}>{i + 1} · {s}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="font-mono text-[11px] text-ink-faint">{ladder.rules?.note}</p>
            <label className="block space-y-1">
              <span className="chrome-label">fair copy {sealed && "(sealed — break the seal to edit)"}</span>
              <textarea
                className="input laid-paper min-h-[420px] font-display text-base leading-8"
                name="final_text"
                defaultValue={letter.final_text ?? ""}
                readOnly={sealed}
              />
            </label>
            <label className="block space-y-1">
              <span className="chrome-label">one-paragraph summary (feeds the Guardian on later letters)</span>
              <textarea className="input min-h-20" name="summary" defaultValue={letter.summary ?? ""} />
            </label>
            {!sealed && <button className="btn btn-seal">Save letter</button>}
          </form>

          <GuardianPanel
            letterId={letter.id}
            draftVersions={(drafts ?? []).map((d) => d.version)}
            latest={(reviews?.[0] as GuardianReview | undefined) ?? null}
          />

          <section className="card">
            <div className="chrome-label">Drafts (never leave this room)</div>
            <form action={saveDraft} className="mt-2 space-y-2">
              <input type="hidden" name="letter_id" value={letter.id} />
              <textarea className="input min-h-40" name="body" placeholder="paste or write the next draft…" />
              <input className="input" name="notes" placeholder="draft notes" />
              <button className="btn">Save as v{((drafts?.[0]?.version ?? 0) + 1)}</button>
            </form>
            <ul className="mt-3 space-y-3">
              {(drafts ?? []).map((d) => (
                <li key={d.id} className="rounded border border-paper-deep bg-white/40 p-3">
                  <div className="chrome-label">v{d.version} · {new Date(d.created_at).toLocaleString()}{d.notes ? ` · ${d.notes}` : ""}</div>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-display text-sm">{d.body}</pre>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
