import Link from "next/link";
import { requireWriter } from "@/lib/auth";
import { StellaBarometer, SalutationLadder, LedgerCard } from "@/components/instruments";
import type { LadderConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { supabase } = await requireWriter();

  const [{ data: state }, { data: letters }, { data: events }, { data: replies },
    { data: poems }, { data: austen }, { data: clippings }, { data: ladderRow }, { data: cadenceRow }] =
    await Promise.all([
      supabase.from("app_state").select("*").single(),
      supabase.from("letters").select("id,number,act,title,status,sent_date").order("number"),
      supabase.from("throughline_events").select("kind,value,numeric_value,created_at").order("created_at"),
      supabase.from("replies").select("received_date").order("received_date", { ascending: false }).limit(1),
      supabase.from("poems").select("act,status,reserved_for_letter_number,title"),
      supabase.from("austen_items").select("code,title,status,reserved_for_letter_number"),
      supabase.from("clippings").select("number,status,reserved_for_letter_number"),
      supabase.from("config").select("value").eq("key", "ladder").single(),
      supabase.from("config").select("value").eq("key", "cadence").single(),
    ]);

  const ladder = (ladderRow?.value ?? { salutations: [], closings: [], rules: {} }) as LadderConfig;
  const cadence = (cadenceRow?.value ?? { interval_days: 7, letters_planned: 24 }) as {
    interval_days: number; letters_planned: number;
  };

  const all = letters ?? [];
  const sent = all.filter((l) => ["delivered", "replied"].includes(l.status));
  const current = sent.at(-1) ?? null;
  const nextNumber = (current?.number ?? 0) + 1;
  const currentAct = all.find((l) => l.number === nextNumber)?.act ?? current?.act ?? 1;

  // cadence math: next due = anchor + interval × letters already sent
  let nextDue: string | null = null;
  let daysUntilDue: number | null = null;
  if (state?.cadence_anchor_date) {
    const anchor = new Date(state.cadence_anchor_date + "T00:00:00Z");
    const due = new Date(anchor.getTime() + sent.length * cadence.interval_days * 86400_000);
    nextDue = due.toISOString().slice(0, 10);
    daysUntilDue = Math.ceil((due.getTime() - Date.now()) / 86400_000);
  }

  const lastReply = replies?.[0]?.received_date ?? null;
  const daysSinceReply = lastReply
    ? Math.floor((Date.now() - new Date(lastReply + "T00:00:00Z").getTime()) / 86400_000)
    : null;

  const stella = (events ?? []).filter((e) => e.kind === "stella_barometer")
    .map((e) => ({ value: e.value, numeric: e.numeric_value === null ? null : Number(e.numeric_value) }));
  const wrongDirection = (events ?? []).filter((e) => e.kind === "wrong_direction").length;
  const claire = (events ?? []).filter((e) => e.kind === "claire_ledger").at(-1);
  const gigi = (events ?? []).filter((e) => e.kind === "gigi_question");
  const gigiAsked = gigi.filter((e) => (e.value ?? "").toLowerCase().startsWith("asked")).length;
  const gigiAnswered = gigi.filter((e) => (e.value ?? "").toLowerCase().startsWith("answered")).length;
  const salRung = (events ?? []).filter((e) => e.kind === "ladder_salutation").at(-1)?.numeric_value ?? 1;
  const closRung = (events ?? []).filter((e) => e.kind === "ladder_closing").at(-1)?.numeric_value ?? 1;

  const poemsByAct = [1, 2, 3, 4, 5].map((act) => ({
    act,
    left: (poems ?? []).filter((p) => p.act === act && p.status === "available").length,
    total: (poems ?? []).filter((p) => p.act === act).length,
  }));
  const treasures = [
    ...(poems ?? []).filter((p) => p.reserved_for_letter_number).map((p) => ({ label: p.title, at: p.reserved_for_letter_number, status: p.status })),
    ...(austen ?? []).filter((a) => a.reserved_for_letter_number).map((a) => ({ label: `${a.code} — ${a.title}`, at: a.reserved_for_letter_number, status: a.status })),
    ...(clippings ?? []).filter((c) => c.reserved_for_letter_number).map((c) => ({ label: `Clipping ${c.number}`, at: c.reserved_for_letter_number, status: c.status })),
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="chrome-label">Next letter due</div>
          <div className="mt-1 font-display text-3xl">
            {nextDue ? nextDue : "—"}
          </div>
          <p className="text-sm text-ink-faint">
            {nextDue
              ? daysUntilDue! >= 0 ? `${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} to write Letter ${nextNumber}` : `${-daysUntilDue!} day(s) overdue — the post waits`
              : "Set the anchor date in Settings to start the clock."}
          </p>
        </div>
        <div className="card">
          <div className="chrome-label">Days since last reply</div>
          <div className="mt-1 font-display text-3xl">{daysSinceReply ?? "—"}</div>
          <p className="text-sm text-ink-faint">
            {lastReply ? `Last received ${lastReply}` : "No replies yet. The post is slow in 1817."}
          </p>
        </div>
        <div className="card">
          <div className="chrome-label">Position</div>
          <div className="mt-1 font-display text-3xl">
            {current?.number ?? 0} <span className="text-lg text-ink-faint">of {cadence.letters_planned}</span>
          </div>
          <p className="text-sm text-ink-faint">Act {currentAct} · {sent.length} delivered</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StellaBarometer readings={stella} />
        <SalutationLadder rung={Number(salRung)} closingRung={Number(closRung)} rungs={ladder.salutations} />
        <div className="space-y-4">
          <LedgerCard title="Claire's Ledger">
            <p className="font-display text-lg italic">{claire?.value ?? "No trials recorded. She is patient."}</p>
          </LedgerCard>
          <LedgerCard title="Wrong Direction">
            <p className="font-display text-3xl">{wrongDirection}</p>
            <p className="text-xs text-ink-faint">deployments of the idiom (it must come from her first)</p>
          </LedgerCard>
          <LedgerCard title="Gigi's Questions">
            <p className="font-display text-lg">{gigiAsked - gigiAnswered > 0 ? `${gigiAsked - gigiAnswered} awaiting answer` : "All answered"}</p>
            <p className="text-xs text-ink-faint">{gigiAsked} asked · {gigiAnswered} answered · answer within one letter</p>
          </LedgerCard>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="chrome-label">Poems remaining, by act</div>
          <div className="mt-3 space-y-2">
            {poemsByAct.map(({ act, left, total }) => (
              <div key={act} className="flex items-center gap-3">
                <span className="w-12 font-mono text-xs">Act {act}</span>
                <div className="h-2 flex-1 rounded bg-paper-deep">
                  <div className="h-2 rounded bg-sepia" style={{ width: total ? `${(left / total) * 100}%` : 0 }} />
                </div>
                <span className="w-14 text-right font-mono text-xs">{left}/{total}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="chrome-label">Treasures reserved</div>
          <ul className="mt-3 space-y-2 text-sm">
            {treasures.length === 0 && <li className="text-ink-faint">Nothing under guard.</li>}
            {treasures.map((t, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2">
                <span className="font-display italic">{t.label}</span>
                <span className={`pill ${t.status === "used" ? "border-seal text-seal" : "border-sepia text-sepia"}`}>
                  {t.status === "used" ? "spent" : `held for L${t.at}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">The database refuses reserved items on the wrong letter. Guard the crown jewels.</p>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/replies/new" className="btn btn-seal">Log a reply</Link>
        <Link href="/letters" className="btn">Open the letters</Link>
        <Link href={`/letters?new=${nextNumber}`} className="btn">Begin Letter {nextNumber}</Link>
      </section>
    </div>
  );
}
