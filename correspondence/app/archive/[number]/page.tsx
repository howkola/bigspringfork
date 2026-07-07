import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReader } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ArchiveLetter({ params }: { params: Promise<{ number: string }> }) {
  const { supabase } = await requireReader();
  const { number: numberRaw } = await params;
  const number = Number(numberRaw);
  if (!Number.isInteger(number)) notFound();

  const { data: state } = await supabase.from("app_state").select("revealed").maybeSingle();
  if (!state?.revealed) notFound();

  // RLS filters everything below to visibility='archive'.
  const { data: letter } = await supabase.from("letters").select("*").eq("number", number).maybeSingle();
  if (!letter) notFound();

  const [{ data: enclosures }, { data: replies }, { data: neighbors }] = await Promise.all([
    supabase.from("enclosures").select("*").eq("letter_id", letter.id).order("created_at"),
    supabase.from("replies").select("*").eq("letter_id", letter.id).order("received_date"),
    supabase.from("letters").select("number").order("number"),
  ]);

  const numbers = (neighbors ?? []).map((n) => n.number);
  const prev = numbers.filter((n) => n < number).at(-1);
  const next = numbers.find((n) => n > number);

  // photographs come through short-lived signed URLs; reveal is verified above
  const admin = createAdminClient();
  async function sign(paths: string[]) {
    const out: string[] = [];
    for (const p of paths) {
      const { data } = await admin.storage.from("photos").createSignedUrl(p, 3600);
      if (data?.signedUrl) out.push(data.signedUrl);
    }
    return out;
  }
  const letterPhotos = await sign(letter.photo_paths ?? []);

  const replyViews = await Promise.all(
    (replies ?? []).map(async (r) => ({ reply: r, photos: await sign(r.photo_paths ?? []) }))
  );

  // enclosure display data (used library rows are readable post-reveal)
  const enclosureViews: { kind: string; heading: string; body?: string; photo?: string }[] = [];
  for (const enc of enclosures ?? []) {
    let heading = enc.description ?? "";
    let body: string | undefined;
    if (enc.kind === "poem" && enc.ref_id) {
      const { data } = await supabase.from("poems").select("poet,title,date_str").eq("id", enc.ref_id).maybeSingle();
      if (data) heading = `${data.title} — ${data.poet}${data.date_str ? `, ${data.date_str}` : ""}`;
    } else if (enc.kind === "clipping" && enc.ref_id) {
      const { data } = await supabase.from("clippings").select("publication,body").eq("id", enc.ref_id).maybeSingle();
      if (data) {
        heading = data.publication ?? "a clipping";
        body = data.body;
      }
    } else if (enc.kind === "austen" && enc.ref_id) {
      const { data } = await supabase.from("austen_items").select("title").eq("id", enc.ref_id).maybeSingle();
      if (data) heading = data.title;
    }
    const photo = enc.photo_path ? (await sign([enc.photo_path]))[0] : undefined;
    enclosureViews.push({ kind: enc.kind, heading, body, photo });
  }

  return (
    <main className="laid-paper min-h-screen px-6 py-12">
      <article className="mx-auto max-w-2xl">
        <nav className="mb-8 flex items-center justify-between font-mono text-xs text-sepia">
          {prev != null ? <Link href={`/archive/${prev}`} className="hover:text-seal">← Letter {prev}</Link> : <span />}
          <Link href="/archive" className="hover:text-seal">Contents</Link>
          {next != null ? <Link href={`/archive/${next}`} className="hover:text-seal">Letter {next} →</Link> : <span />}
        </nav>

        <header className="text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-sepia">Letter {letter.number}</div>
          <h1 className="mt-1 font-display text-3xl">{letter.title ?? ""}</h1>
          {letter.in_story_date && (
            <p className="mt-1 font-display italic text-ink-soft">{letter.in_story_date}</p>
          )}
        </header>

        {letterPhotos.length > 0 && (
          <div className="mt-8 space-y-4">
            {letterPhotos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`Letter ${letter.number}, leaf ${i + 1}`} className="w-full rounded shadow-md" />
            ))}
          </div>
        )}

        {letter.final_text && (
          <div className="letter-text mt-10">{letter.final_text}</div>
        )}

        {enclosureViews.length > 0 && (
          <section className="mt-12 border-t border-sepia/40 pt-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-sepia">Enclosed</h2>
            <div className="mt-4 space-y-6">
              {enclosureViews.map((e, i) => (
                <div key={i}>
                  <p className="font-display text-lg italic">{e.heading}</p>
                  {e.body && <blockquote className="letter-text mt-2 border-l-2 border-sepia/50 pl-4 text-base">{e.body}</blockquote>}
                  {e.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.photo} alt={e.heading} className="mt-2 max-h-96 rounded shadow" />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {(replies ?? []).length > 0 && (
          <section className="mt-12 border-t border-sepia/40 pt-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-sepia">Her reply</h2>
            {replyViews.map(({ reply: r, photos }) => (
              <div key={r.id} className="mt-4">
                <p className="font-mono text-[11px] text-ink-faint">received {r.received_date}</p>
                {photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="her reply" className="mt-2 w-full rounded shadow" />
                ))}
                {r.body_text && <div className="letter-text mt-3">{r.body_text}</div>}
              </div>
            ))}
          </section>
        )}

        <nav className="mt-16 flex items-center justify-between font-mono text-xs text-sepia">
          {prev != null ? <Link href={`/archive/${prev}`} className="hover:text-seal">← Letter {prev}</Link> : <span />}
          {next != null ? <Link href={`/archive/${next}`} className="hover:text-seal">Letter {next} →</Link> : <Link href="/archive" className="hover:text-seal">Contents</Link>}
        </nav>
      </article>
    </main>
  );
}
