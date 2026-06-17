import type { SectionDef } from "../../shared/types";

interface SectionHeadProps {
  def: SectionDef;
  reviewed: boolean;
  onReview: () => void;
  onCopy: () => void;
  copied: boolean;
  onRegen?: () => void;
  regenerating?: boolean;
}

export function SectionHead({
  def,
  reviewed,
  onReview,
  onCopy,
  copied,
  onRegen,
  regenerating,
}: SectionHeadProps) {
  return (
    <div className="sec-head">
      <div className="sec-title">
        <span className="sec-num">{def.num}</span>
        <h2>{def.label}</h2>
      </div>
      <div className="sec-actions">
        {onRegen && (
          <button className="btn small" onClick={onRegen} disabled={regenerating}>
            {regenerating ? "Working…" : "Regenerate"}
          </button>
        )}
        <button className="btn small" onClick={onCopy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <label className={`review-toggle ${reviewed ? "on" : ""}`}>
          <input type="checkbox" checked={!!reviewed} onChange={onReview} />
          {reviewed ? "Reviewed" : "Mark reviewed"}
        </label>
      </div>
    </div>
  );
}
