/**
 * What the crafting screen may claim. Every state comes from a real transition (upload
 * finished, request accepted, provider status) — never from a timer.
 */
export const PREVIEW_STAGES = ['uploading', 'submitting', 'queued', 'processing', 'finalizing', 'ready'] as const;
export type PreviewStage = (typeof PREVIEW_STAGES)[number];

export type LineState = 'done' | 'active' | 'pending';

/** upload · reserve the free preview · edit the photo · finishing. */
export const CHECKLIST_LENGTH = 4;

/** Stage at which each checklist line becomes done. */
const DONE_AT: readonly PreviewStage[] = ['submitting', 'queued', 'finalizing', 'ready'];

export function checklistStates(stage: PreviewStage): LineState[] {
  const at = PREVIEW_STAGES.indexOf(stage);
  const states: LineState[] = DONE_AT.map((doneStage) =>
    at >= PREVIEW_STAGES.indexOf(doneStage) ? 'done' : 'pending',
  );
  const firstPending = states.indexOf('pending');
  if (firstPending !== -1) states[firstPending] = 'active';
  return states;
}

const FLOOR: Record<PreviewStage, number> = {
  uploading: 0.06,
  submitting: 0.12,
  queued: 0.18,
  processing: 0.2,
  finalizing: 0.92,
  ready: 1,
};
const PROCESSING_SPAN = 0.65;

/** Ring fill: the stage floor plus the provider's own progress while it is processing. */
export function ringProgress(stage: PreviewStage, providerProgress: number): number {
  if (stage !== 'processing') return FLOOR[stage];
  const p = Math.min(1, Math.max(0, Number.isFinite(providerProgress) ? providerProgress : 0));
  return FLOOR.processing + PROCESSING_SPAN * p;
}
