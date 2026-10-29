import { getChallengeRule } from "./rulebook";

export const PHASE_ONE = "Phase 1 (Evaluation)";
export const PHASE_TWO = "Phase 2 (Verification)";
export const PHASE_FUNDED = "Funded (Live)";

/**
 * Ordered account stages a plan actually runs through.
 * One Step, Flex and Instant never issue a Phase 2 (Verification) account.
 */
export function getStagePhases(planName?: string): string[] {
  const rule = getChallengeRule(planName);
  if (rule.key === "instant_funding") return [PHASE_FUNDED];
  if (rule.key === "one_step_pro" || rule.key === "flex") return [PHASE_ONE, PHASE_FUNDED];
  return [PHASE_ONE, PHASE_TWO, PHASE_FUNDED];
}

export function planSupportsPhase(planName: string | undefined, phase?: string) {
  return getStagePhases(planName).includes(String(phase || "").trim());
}

/**
 * Stages to offer in an admin phase picker: the plan's own stages, plus whatever stage a
 * legacy account is already sitting on so it stays visible and editable.
 */
export function getSelectableStagePhases(planName?: string, currentPhase?: string) {
  const phases = getStagePhases(planName);
  const current = String(currentPhase || "").trim();
  if (!current || phases.includes(current)) return phases;
  return [...phases, current].sort((a, b) => getPhaseRank(a) - getPhaseRank(b));
}

/** The stage that follows `currentPhase` for this plan, or null when already at the final stage. */
export function getNextStagePhase(planName: string | undefined, currentPhase?: string): string | null {
  const phases = getStagePhases(planName);
  const index = phases.indexOf(String(currentPhase || "").trim());
  if (index < 0 || index >= phases.length - 1) return null;
  return phases[index + 1];
}

export function getStageProfitTargetPercent(planName: string | undefined, phase?: string) {
  const rule = getChallengeRule(planName);
  if (phase === PHASE_FUNDED) return 0;
  if (phase === PHASE_TWO) return rule.phase2TargetPercent;
  return rule.phase1TargetPercent;
}

export function getStageProfitTarget(planName: string | undefined, phase: string | undefined, size: number) {
  return Number(size) * (getStageProfitTargetPercent(planName, phase) / 100);
}

/** A Flex order whose remaining balance is unpaid: passing does not fund it until the activation fee is paid. */
export function awaitingFlexActivation(order?: { activationFee?: number | null; parentOrderId?: string | null }) {
  return !order?.parentOrderId && Number(order?.activationFee) > 0;
}

export function getStageAccountStatus(phase?: string): "Active" | "Funded" {
  return phase === PHASE_FUNDED ? "Funded" : "Active";
}

/** Order ledger status that matches an account stage. */
export function getOrderStatusForPhase(phase?: string) {
  if (phase === PHASE_FUNDED) return "Live Active";
  if (phase === PHASE_TWO) return "Step2 Active";
  return "Active";
}

const PHASE_RANK: Record<string, number> = {
  [PHASE_ONE]: 0,
  [PHASE_TWO]: 1,
  [PHASE_FUNDED]: 2,
};

export function getPhaseRank(phase?: string) {
  return PHASE_RANK[String(phase || "").trim()] ?? -1;
}
