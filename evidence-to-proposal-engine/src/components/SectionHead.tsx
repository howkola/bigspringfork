import type { SectionDef } from "../../shared/types";

interface SectionHeadProps {
  def: SectionDef;
  reviewed: boolean;
  onReview: () => void;
  onCopy: () => void;
  copied: boolean;
  onRegen?: () => void;
  regenerating?: boolean;
  onEdit?: () => void;
  editing?: boolean;
}

export function SectionHead({
  def,
  reviewed,
  onReview,
  onCopy,
  copied,
  onRegen,
  regenerating,
  onEdit,
  editing,
}: SectionHeadProps) {
  return (
    <div className="sec-head">
      <div className="sec-title">
        <span className="sec-num">{def.num}</span>
        <h2>{def.label}</h2>
      </div>
      <div className="sec-actions">
        {onEdit && (
          <button className="btn small" onClick={onEdit} disabled={editing}>
            {editing ? "Editing…" : "Edit"}
          </button>
        )}
        {onRegen && (
          <button className="btn small" onClick={onRegen} disabled={regenerating || editing}>
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
