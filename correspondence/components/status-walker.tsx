"use client";

// Explicit status transitions; "break the seal" demands confirmation.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LETTER_STATUSES, type LetterStatus } from "@/lib/types";

export function StatusWalker({
  letterId, status, hasPhoto,
}: { letterId: string; status: LetterStatus; hasPhoto: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const idx = LETTER_STATUSES.indexOf(status);
  const next = LETTER_STATUSES[idx + 1];
  const prev = LETTER_STATUSES[idx - 1];

  function move(to: LetterStatus) {
    if (status === "sealed" && LETTER_STATUSES.indexOf(to) < idx) {
      const sure = window.confirm(
        'Break the seal? The fair copy unlocks for editing. Type-of-confirmation: press OK only if you mean it.'
      );
      if (!sure) return;
    }
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("letters").update({ status: to }).eq("id", letterId);
      if (error) window.alert(error.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {LETTER_STATUSES.map((s, i) => (
        <span key={s} className={`pill ${i === idx ? "border-seal bg-seal text-paper" : i < idx ? "border-sepia text-sepia" : "border-paper-deep text-ink-faint"}`}>
          {s.replace("_", " ")}
        </span>
      ))}
      <span className="mx-2" />
      {prev && (
        <button className="btn" disabled={pending} onClick={() => move(prev)}>
          ← {status === "sealed" ? "break the seal" : prev.replace("_", " ")}
        </button>
      )}
      {next && (
        <button
          className="btn btn-seal"
          disabled={pending || (next === "photographed" && !hasPhoto)}
          title={next === "photographed" && !hasPhoto ? "Upload at least one photograph first" : undefined}
          onClick={() => move(next)}
        >
          {next.replace("_", " ")} →
        </button>
      )}
    </div>
  );
}
