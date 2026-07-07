import { requireWriter } from "@/lib/auth";
import { saveSettings, signOut } from "@/app/actions";
import { RevealForm } from "@/components/reveal-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, user } = await requireWriter();
  const { data: state } = await supabase.from("app_state").select("*").single();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl">Settings</h1>

      <section className="card">
        <div className="chrome-label">Export everything</div>
        <p className="mt-2 text-sm text-ink-soft">
          One zip: full-database JSON (writer-only rows included — this is your export),
          all photographs, and the seed documents. One click, no partial exports.
          Six months of irreplaceable work should never be hostage to hosting.
        </p>
        <a className="btn btn-seal mt-3" href="/api/export" download>Download the archive</a>
      </section>

      <form action={saveSettings} className="card space-y-3">
        <div className="chrome-label">Cadence & post-reveal toggles</div>
        <label className="block space-y-1">
          <span className="chrome-label">weekly anchor date (real calendar)</span>
          <input className="input w-auto" type="date" name="cadence_anchor_date" defaultValue={state?.cadence_anchor_date ?? ""} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archive_include_concordance" defaultChecked={state?.archive_include_concordance} />
          include the concordance appendix in the archive (post-reveal)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archive_include_journal" defaultChecked={state?.archive_include_journal} />
          include journal entries marked for the archive (default off — the physical journal is the endgame gift)
        </label>
        <p className="text-xs text-ink-faint">
          Whatever these toggles say: drafts, guardian reviews, and the name workshop are
          unreachable from the archive. That is enforced by the database, not this page.
        </p>
        <button className="btn">Save</button>
      </form>

      <RevealForm revealed={!!state?.revealed} />

      <form action={signOut} className="card">
        <div className="chrome-label">Session</div>
        <p className="mt-1 text-sm text-ink-faint">{user.email}</p>
        <button className="btn mt-2">Sign out</button>
      </form>
    </div>
  );
}
