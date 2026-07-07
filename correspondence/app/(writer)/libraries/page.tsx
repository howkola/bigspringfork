import Link from "next/link";
import { requireWriter } from "@/lib/auth";
import { reserveItem, setReaction } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  available: "border-sepia text-sepia",
  reserved: "border-seal text-seal",
  used: "border-ink bg-ink text-paper",
};

function ReserveControls({ table, id, status, reservedFor }: {
  table: string; id: string; status: string; reservedFor: number | null;
}) {
  if (status === "used") return null;
  return (
    <form action={reserveItem} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      {status === "reserved" ? (
        <>
          <input type="hidden" name="letter_number" value="" />
          <button className="btn px-2 py-1">release hold (L{reservedFor})</button>
        </>
      ) : (
        <>
          <input className="input w-20 py-1" name="letter_number" type="number" min={1} placeholder="L#" required />
          <button className="btn px-2 py-1">hold for letter</button>
        </>
      )}
    </form>
  );
}

function ReactionControl({ table, id, reaction }: { table: string; id: string; reaction: string | null }) {
  return (
    <form action={setReaction} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input className="input py-1 text-xs" name="her_reaction" defaultValue={reaction ?? ""} placeholder="her reaction (steers future picks)" />
      <button className="btn px-2 py-1">save</button>
    </form>
  );
}

export default async function LibrariesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; act?: string; theme?: string }>;
}) {
  const { supabase } = await requireWriter();
  const { tab = "poems", act, theme } = await searchParams;

  const actFilter = act ? Number(act) : null;

  let poems, clippings, austen;
  if (tab === "poems") {
    let q = supabase.from("poems").select("*, letters:used_in_letter_id(number)").order("act").order("poet");
    if (actFilter) q = q.eq("act", actFilter);
    if (theme) q = q.eq("theme", theme);
    ({ data: poems } = await q);
  } else if (tab === "clippings") {
    let q = supabase.from("clippings").select("*, letters:used_in_letter_id(number)").order("number");
    if (actFilter) q = q.eq("act", actFilter);
    ({ data: clippings } = await q);
  } else {
    let q = supabase.from("austen_items").select("*, letters:used_in_letter_id(number)").order("code");
    if (actFilter) q = q.eq("act", actFilter);
    ({ data: austen } = await q);
  }

  const themes = ["first-notice", "scandal", "gauntlet", "animals", "gigi-astronomy", "deepening", "crisis", "declaration", "escalation", "new-poet-1817"];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">The Libraries</h1>
      <nav className="flex gap-2">
        {["poems", "clippings", "austen"].map((t) => (
          <Link key={t} href={`/libraries?tab=${t}`} className={`pill ${tab === t ? "border-seal bg-seal text-paper" : "border-paper-deep text-ink-soft"}`}>
            {t === "austen" ? "Manuscripts / Austen" : t}
          </Link>
        ))}
      </nav>
      <nav className="flex flex-wrap gap-2">
        <Link href={`/libraries?tab=${tab}`} className={`pill ${!actFilter ? "border-sepia text-sepia" : "border-paper-deep text-ink-faint"}`}>all acts</Link>
        {[1, 2, 3, 4, 5].map((a) => (
          <Link key={a} href={`/libraries?tab=${tab}&act=${a}`} className={`pill ${actFilter === a ? "border-sepia text-sepia" : "border-paper-deep text-ink-faint"}`}>
            act {a}
          </Link>
        ))}
        {tab === "poems" && themes.map((t) => (
          <Link key={t} href={`/libraries?tab=poems&theme=${t}`} className={`pill ${theme === t ? "border-sepia text-sepia" : "border-paper-deep text-ink-faint"}`}>
            {t}
          </Link>
        ))}
      </nav>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tab === "poems" && (poems ?? []).map((p) => {
          const used = p.letters as unknown as { number: number } | null;
          return (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-lg leading-snug">{p.title}</div>
                  <div className="text-sm text-ink-soft">{p.poet} · {p.date_str}</div>
                </div>
                <span className={`pill shrink-0 ${STATUS_STYLE[p.status]}`}>
                  {p.status}{used ? ` L${used.number}` : p.reserved_for_letter_number ? ` L${p.reserved_for_letter_number}` : ""}
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-ink-faint">act {p.act} · {p.theme}</div>
              <p className="mt-2 text-sm">{p.why_it_fits}</p>
              {p.deployment_note && <p className="mt-1 text-xs text-sepia">{p.deployment_note}</p>}
              {p.her_reaction && <p className="mt-1 text-xs italic text-seal">she: {p.her_reaction}</p>}
              <ReserveControls table="poems" id={p.id} status={p.status} reservedFor={p.reserved_for_letter_number} />
              {p.status === "used" && <ReactionControl table="poems" id={p.id} reaction={p.her_reaction} />}
            </div>
          );
        })}

        {tab === "clippings" && (clippings ?? []).map((c) => {
          const used = c.letters as unknown as { number: number } | null;
          return (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-lg">Clipping {c.number}</div>
                  <div className="text-sm text-ink-soft">{c.publication}</div>
                </div>
                <span className={`pill shrink-0 ${STATUS_STYLE[c.status]}`}>
                  {c.status}{used ? ` L${used.number}` : c.reserved_for_letter_number ? ` L${c.reserved_for_letter_number}` : ""}
                </span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-ink-faint">act {c.act}</div>
              <blockquote className="laid-paper mt-2 border-l-2 border-sepia p-2 font-display text-sm italic">{c.body}</blockquote>
              {c.design_note && <p className="mt-1 text-xs text-sepia">{c.design_note}</p>}
              {c.her_reaction && <p className="mt-1 text-xs italic text-seal">she: {c.her_reaction}</p>}
              <ReserveControls table="clippings" id={c.id} status={c.status} reservedFor={c.reserved_for_letter_number} />
              {c.status === "used" && <ReactionControl table="clippings" id={c.id} reaction={c.her_reaction} />}
            </div>
          );
        })}

        {tab === "austen" && (austen ?? []).map((a) => {
          const used = a.letters as unknown as { number: number } | null;
          return (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-lg leading-snug">{a.code} — {a.title}</div>
                  <div className="font-mono text-[11px] uppercase text-ink-faint">
                    {a.tier} · act {a.act}{a.planned_letter_number ? ` · planned L${a.planned_letter_number}` : ""}
                  </div>
                </div>
                <span className={`pill shrink-0 ${STATUS_STYLE[a.status]}`}>
                  {a.status}{used ? ` L${used.number}` : a.reserved_for_letter_number ? ` L${a.reserved_for_letter_number}` : ""}
                </span>
              </div>
              <p className="mt-2 text-sm">{a.deployment}</p>
              {a.guardrails && (
                <p className="mt-2 rounded border border-seal/40 bg-seal/5 p-2 text-xs text-seal">{a.guardrails}</p>
              )}
              {a.her_reaction && <p className="mt-1 text-xs italic text-seal">she: {a.her_reaction}</p>}
              <ReserveControls table="austen_items" id={a.id} status={a.status} reservedFor={a.reserved_for_letter_number} />
              {a.status === "used" && <ReactionControl table="austen_items" id={a.id} reaction={a.her_reaction} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
