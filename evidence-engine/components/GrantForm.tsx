"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GrantForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);

    // One required section per line: "key | Title | word limit"
    const requiredSections = String(formData.get("required_sections") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, title, limit] = line.split("|").map((s) => s.trim());
        return {
          key: key || title?.toLowerCase().replace(/\W+/g, "_") || "section",
          title: title || key,
          ...(limit && Number(limit) > 0 ? { word_limit: Number(limit) } : {}),
        };
      });

    try {
      const res = await fetch("/api/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funder: formData.get("funder"),
          title: formData.get("title"),
          description: formData.get("description") ?? "",
          focus_areas: String(formData.get("focus_areas") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          amount_min: formData.get("amount_min")
            ? Number(formData.get("amount_min"))
            : null,
          amount_max: formData.get("amount_max")
            ? Number(formData.get("amount_max"))
            : null,
          deadline: formData.get("deadline") || null,
          guidelines_url: formData.get("guidelines_url") || null,
          required_sections: requiredSections,
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
        + Add grant opportunity
      </button>
    );
  }

  return (
    <form
      action={submit}
      className="rounded-lg border border-stone-300 bg-white p-4 shadow-sm"
    >
      <h3 className="mb-3 font-semibold">New grant opportunity</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="funder" required placeholder="Funder *" className="rounded border border-stone-300 p-2 text-sm" />
        <input name="title" required placeholder="Opportunity title *" className="rounded border border-stone-300 p-2 text-sm" />
        <textarea name="description" placeholder="Funder priorities / RFP description" rows={3} className="md:col-span-2 rounded border border-stone-300 p-2 text-sm" />
        <input name="focus_areas" placeholder="Focus areas (comma-separated)" className="rounded border border-stone-300 p-2 text-sm" />
        <input name="deadline" type="date" className="rounded border border-stone-300 p-2 text-sm" />
        <input name="amount_min" type="number" placeholder="Award min ($)" className="rounded border border-stone-300 p-2 text-sm" />
        <input name="amount_max" type="number" placeholder="Award max ($)" className="rounded border border-stone-300 p-2 text-sm" />
        <input name="guidelines_url" type="url" placeholder="Guidelines URL" className="md:col-span-2 rounded border border-stone-300 p-2 text-sm" />
        <textarea
          name="required_sections"
          placeholder={"Required sections, one per line:\nkey | Title | word limit\ne.g. need_statement | Statement of Need | 750"}
          rows={4}
          className="md:col-span-2 rounded border border-stone-300 p-2 font-mono text-sm"
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300">
          {pending ? "Saving…" : "Save opportunity"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
