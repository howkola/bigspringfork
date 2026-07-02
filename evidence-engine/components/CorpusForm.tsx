"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CorpusForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    const keyFindings = String(formData.get("key_findings") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const tags = String(formData.get("tags") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/corpus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          source_type: formData.get("source_type"),
          authors: formData.get("authors") || null,
          publication: formData.get("publication") || null,
          publication_year: formData.get("publication_year")
            ? Number(formData.get("publication_year"))
            : null,
          url: formData.get("url") || null,
          summary: formData.get("summary"),
          key_findings: keyFindings,
          tags,
          confidence: formData.get("confidence"),
          freshness_months: Number(formData.get("freshness_months") ?? 12),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        + Add corpus entry
      </button>
    );
  }

  return (
    <form
      action={submit}
      className="rounded-lg border border-stone-300 bg-white p-4 shadow-sm"
    >
      <h3 className="mb-3 font-semibold">New corpus entry</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="title" required placeholder="Title *" className="input md:col-span-2 rounded border border-stone-300 p-2 text-sm" />
        <select name="source_type" className="rounded border border-stone-300 p-2 text-sm">
          <option value="peer_reviewed_study">Peer-reviewed study</option>
          <option value="government_report">Government report</option>
          <option value="internal_program_data">Internal program data</option>
          <option value="evaluation_report">Evaluation report</option>
          <option value="news_or_media">News / media</option>
          <option value="other">Other</option>
        </select>
        <select name="confidence" defaultValue="medium" className="rounded border border-stone-300 p-2 text-sm">
          <option value="high">High confidence</option>
          <option value="medium">Medium confidence</option>
          <option value="low">Low confidence</option>
        </select>
        <input name="authors" placeholder="Authors" className="rounded border border-stone-300 p-2 text-sm" />
        <input name="publication" placeholder="Publication" className="rounded border border-stone-300 p-2 text-sm" />
        <input name="publication_year" type="number" placeholder="Year" className="rounded border border-stone-300 p-2 text-sm" />
        <input name="url" type="url" placeholder="URL" className="rounded border border-stone-300 p-2 text-sm" />
        <textarea name="summary" required placeholder="Summary of the evidence *" rows={3} className="md:col-span-2 rounded border border-stone-300 p-2 text-sm" />
        <textarea name="key_findings" placeholder="Key findings — one per line (quotable, with exact numbers)" rows={3} className="md:col-span-2 rounded border border-stone-300 p-2 text-sm" />
        <input name="tags" placeholder="Tags (comma-separated)" className="rounded border border-stone-300 p-2 text-sm" />
        <label className="flex items-center gap-2 text-sm text-stone-600">
          Re-verify every
          <input name="freshness_months" type="number" defaultValue={12} min={1} max={60} className="w-16 rounded border border-stone-300 p-1 text-sm" />
          months
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300">
          {pending ? "Saving…" : "Save entry"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
