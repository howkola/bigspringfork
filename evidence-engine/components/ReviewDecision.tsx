"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReviewDecisionProps {
  runId: string;
  checkpointId: string;
  /** final_review has no "changes requested" concept. */
  allowChangesRequested?: boolean;
}

export default function ReviewDecision({
  runId,
  checkpointId,
  allowChangesRequested = true,
}: ReviewDecisionProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  async function decide(
    decision: "approved" | "rejected" | "changes_requested",
  ) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkpoint_id: checkpointId,
          decision,
          notes: notes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setOutcome(data.outcome ?? "Decision recorded.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
      <p className="mb-2 text-sm font-semibold text-amber-900">
        Review checkpoint — your decision is required
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Reviewer notes (recorded in the audit trail)"
        className="mb-2 w-full rounded border border-stone-300 p-2 text-sm"
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => decide("approved")}
          disabled={pending}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300"
        >
          Approve
        </button>
        {allowChangesRequested && (
          <button
            onClick={() => decide("changes_requested")}
            disabled={pending}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-amber-300"
          >
            Request changes
          </button>
        )}
        <button
          onClick={() => decide("rejected")}
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300"
        >
          Reject
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {outcome && <p className="mt-2 text-xs text-emerald-700">{outcome}</p>}
    </div>
  );
}
