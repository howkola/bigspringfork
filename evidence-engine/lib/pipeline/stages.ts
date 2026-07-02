import type { PipelineStage } from "@/lib/types";

/**
 * The pipeline state machine:
 *
 *   intake ──▶ intake_review ──▶ drafting ──▶ citation_verification ──▶
 *   section_review ──▶ assembly ──▶ final_review ──▶ completed
 *
 * Human review checkpoints sit at intake_review, section_review (per section),
 * and final_review. Rejections move the run backwards; the citation gate
 * blocks forward movement whenever any claim is unverified.
 */

export const STAGE_ORDER: PipelineStage[] = [
  "intake",
  "intake_review",
  "drafting",
  "citation_verification",
  "section_review",
  "assembly",
  "final_review",
  "completed",
];

const ALLOWED_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  intake: ["intake_review"],
  intake_review: ["drafting", "intake"], // reject -> re-run intake
  drafting: ["citation_verification"],
  citation_verification: ["section_review", "drafting"], // failures can send sections back
  section_review: ["assembly", "drafting", "citation_verification"],
  assembly: ["final_review"],
  final_review: ["completed", "section_review"], // reject -> back to section review
  completed: [],
};

export function canTransition(from: PipelineStage, to: PipelineStage): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function stageLabel(stage: PipelineStage): string {
  const labels: Record<PipelineStage, string> = {
    intake: "Intake analysis",
    intake_review: "Intake review",
    drafting: "Section drafting",
    citation_verification: "Citation verification",
    section_review: "Section review",
    assembly: "Final assembly",
    final_review: "Final review",
    completed: "Completed",
  };
  return labels[stage];
}

export function stageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}
