"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SectionEditorProps {
  runId: string;
  sectionId: string;
  initialContent: string;
}

export default function SectionEditor({
  runId,
  sectionId,
  initialContent,
}: SectionEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!reason.trim()) {
      setError("An edit reason is required — it goes in the audit trail.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/sections/${sectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, edit_reason: reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setOpen(false);
        setReason("");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setContent(initialContent);
          setOpen(true);
        }}
        className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
      >
        Edit text
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-md border border-stone-300 bg-white p-3">
      <p className="mb-2 text-xs text-stone-500">
        Keep [C#] markers next to the claims they support. Deleting a marker
        removes its claim from the citation map; adding new factual claims by
        hand means they ship uncited — prefer redrafting for substantive
        changes.
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        className="w-full rounded border border-stone-300 p-2 font-mono text-sm"
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for this edit (required, audited)"
        className="mt-2 w-full rounded border border-stone-300 p-2 text-sm"
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
        >
          {pending ? "Saving…" : "Save edit"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
