/**
 * Onboarding step order and skip rules — pure, so the screen only renders what this says.
 * Order (spec §6): welcome → goal → stage → date → photo → consent → notify → crafting →
 * reveal → finish. Steps drop out when they cannot help the user (no date while researching,
 * no preview without a photo or consent, no priming once the permission is decided).
 */
import { ANGLES_BY_GOAL, type Angle, type Goal, type Stage } from '@shared/catalog';

export const STEP_IDS = [
  'welcome',
  'goal',
  'stage',
  'date',
  'photo',
  'consent',
  'notify',
  'crafting',
  'reveal',
] as const;
export type StepId = (typeof STEP_IDS)[number];

export type FlowTarget = StepId | 'finish';

export interface FlowContext {
  stage: Stage | null;
  /** `unknown` until the photo step is left; `skipped` drops the whole preview branch. */
  photo: 'unknown' | 'present' | 'skipped';
  /** Fixed at onboarding start so the consent step keeps its place in the progress bar. */
  consentGivenAtStart: boolean;
  consentDeclined: boolean;
  /** The notification permission was already granted or denied (nothing left to prime). */
  notifyDecided: boolean;
  /** Remote flag on and the free onboarding preview not yet used. */
  previewEnabled: boolean;
}

const BACKABLE: readonly StepId[] = ['goal', 'stage', 'date', 'photo'];

export function isBackable(step: StepId): boolean {
  return BACKABLE.includes(step);
}

function previewBranch(ctx: FlowContext): boolean {
  return ctx.previewEnabled && ctx.photo !== 'skipped' && !ctx.consentDeclined;
}

export function isApplicable(step: StepId, ctx: FlowContext): boolean {
  switch (step) {
    case 'date':
      return ctx.stage === 'planned' || ctx.stage === 'done';
    case 'consent':
      return previewBranch(ctx) && !ctx.consentGivenAtStart;
    case 'notify':
      return !ctx.notifyDecided;
    case 'crafting':
    case 'reveal':
      return previewBranch(ctx);
    default:
      return true;
  }
}

/** Every step the user will see, in order, given what is known now. */
export function plannedPath(ctx: FlowContext): StepId[] {
  return STEP_IDS.filter((step) => isApplicable(step, ctx));
}

export function nextStep(from: StepId, ctx: FlowContext): FlowTarget {
  const start = STEP_IDS.indexOf(from);
  for (let i = start + 1; i < STEP_IDS.length; i++) {
    const step = STEP_IDS[i] as StepId;
    if (isApplicable(step, ctx)) return step;
  }
  return 'finish';
}

export function previousStep(from: StepId, ctx: FlowContext): StepId | null {
  const start = STEP_IDS.indexOf(from);
  for (let i = start - 1; i >= 0; i--) {
    const step = STEP_IDS[i] as StepId;
    if (isApplicable(step, ctx)) return step;
  }
  return null;
}

/** Position for `StepProgress`: the last step of the path fills the bar. */
export function progressPosition(step: StepId, ctx: FlowContext): { index: number; total: number } {
  const path = plannedPath(ctx);
  const total = Math.max(1, path.length - 1);
  let index = path.indexOf(step);
  if (index === -1) {
    // The step just left the path (e.g. consent declined): stay just before the next one.
    const next = nextStep(step, ctx);
    index = next === 'finish' ? path.length - 1 : Math.max(0, path.indexOf(next) - 1);
  }
  return { index: Math.min(index, total), total };
}

/** The angle the capture screen opens on for a goal (first of its capture order). */
export function primaryAngleFor(goal: Goal | null): Angle {
  if (!goal) return 'front';
  return ANGLES_BY_GOAL[goal][0] ?? 'front';
}
