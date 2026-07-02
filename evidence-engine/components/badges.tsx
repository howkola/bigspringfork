import type {
  ClaimVerificationStatus,
  ConfidenceLevel,
  PipelineStage,
  SectionStatus,
} from "@/lib/types";

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export function SectionStatusBadge({ status }: { status: SectionStatus }) {
  const map: Record<SectionStatus, [string, string]> = {
    planned: ["Planned", "bg-stone-200 text-stone-700"],
    drafting: ["Drafting…", "bg-blue-100 text-blue-800"],
    drafted: ["Drafted — needs verification", "bg-blue-100 text-blue-800"],
    verifying: ["Verifying…", "bg-violet-100 text-violet-800"],
    verification_failed: ["⛔ Citation gate failed", "bg-red-100 text-red-800"],
    awaiting_review: ["Awaiting your review", "bg-amber-100 text-amber-800"],
    changes_requested: ["Changes requested", "bg-orange-100 text-orange-800"],
    approved: ["Approved", "bg-emerald-100 text-emerald-800"],
    final: ["Final", "bg-emerald-200 text-emerald-900"],
  };
  const [label, cls] = map[status];
  return <Badge label={label} className={cls} />;
}

export function ClaimStatusBadge({
  status,
}: {
  status: ClaimVerificationStatus;
}) {
  const map: Record<ClaimVerificationStatus, [string, string]> = {
    pending: ["Pending verification", "bg-stone-200 text-stone-700"],
    verified: ["✓ Verified", "bg-emerald-100 text-emerald-800"],
    unsupported: ["✗ Unsupported", "bg-red-100 text-red-800"],
    partially_supported: ["△ Partially supported", "bg-orange-100 text-orange-800"],
    missing_source: ["✗ Fabricated citation", "bg-red-200 text-red-900"],
    stale_source: ["⏳ Stale source", "bg-yellow-100 text-yellow-800"],
  };
  const [label, cls] = map[status];
  return <Badge label={label} className={cls} />;
}

export function StageBadge({ stage }: { stage: PipelineStage }) {
  const map: Record<PipelineStage, [string, string]> = {
    intake: ["Intake", "bg-stone-200 text-stone-700"],
    intake_review: ["Intake review", "bg-amber-100 text-amber-800"],
    drafting: ["Drafting", "bg-blue-100 text-blue-800"],
    citation_verification: ["Citation verification", "bg-violet-100 text-violet-800"],
    section_review: ["Section review", "bg-amber-100 text-amber-800"],
    assembly: ["Assembly", "bg-blue-100 text-blue-800"],
    final_review: ["Final review", "bg-amber-100 text-amber-800"],
    completed: ["Completed", "bg-emerald-100 text-emerald-800"],
  };
  const [label, cls] = map[stage];
  return <Badge label={label} className={cls} />;
}

export function FreshnessBadge({
  staleAfter,
}: {
  staleAfter: string;
}) {
  const stale = new Date(staleAfter).getTime() <= Date.now();
  const soon =
    !stale &&
    new Date(staleAfter).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  if (stale) {
    return <Badge label="Stale — re-verify" className="bg-red-100 text-red-800" />;
  }
  if (soon) {
    return (
      <Badge
        label={`Fresh until ${new Date(staleAfter).toLocaleDateString()}`}
        className="bg-yellow-100 text-yellow-800"
      />
    );
  }
  return (
    <Badge
      label={`Fresh until ${new Date(staleAfter).toLocaleDateString()}`}
      className="bg-emerald-100 text-emerald-800"
    />
  );
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const map: Record<ConfidenceLevel, string> = {
    high: "bg-emerald-100 text-emerald-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-red-100 text-red-800",
  };
  return <Badge label={`${level} confidence`} className={map[level]} />;
}
