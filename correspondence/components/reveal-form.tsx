"use client";

// THE FLIP. Typed confirmation, no accidental taps.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevealForm({ revealed }: { revealed: boolean }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, reader_email: email }),
      });
      const body = (await res.json()) as { error?: string; magic_link?: string };
      if (!res.ok) throw new Error(body.error ?? "reveal failed");
      setLink(body.magic_link ?? null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card border-seal">
      <div className="chrome-label text-seal">{revealed ? "The volume is bound" : "The Reveal"}</div>
      <p className="mt-2 text-sm text-ink-soft">
        {revealed
          ? "The archive is live and its contents are read-only at the database level. Mint a fresh reading link below if the last one expired."
          : "This binds the volume: archive content locks read-only, and a private reading link is minted for her. There is no accidental way to do this."}
      </p>
      <div className="mt-3 space-y-2">
        <label className="block space-y-1">
          <span className="chrome-label">reader's email (receives nothing; only names the account)</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="chrome-label">type REVEAL to proceed</span>
          <input className="input font-mono" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="REVEAL" />
        </label>
        <button className="btn btn-seal" disabled={busy || confirmation !== "REVEAL" || !email} onClick={reveal}>
          {busy ? "Binding…" : revealed ? "Mint a fresh reading link" : "Bind the volume"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-seal">{error}</p>}
      {link && (
        <div className="mt-3 rounded border border-sepia bg-white/60 p-3">
          <div className="chrome-label">her reading link (share it however the moment deserves)</div>
          <code className="mt-1 block break-all text-xs">{link}</code>
        </div>
      )}
    </div>
  );
}
