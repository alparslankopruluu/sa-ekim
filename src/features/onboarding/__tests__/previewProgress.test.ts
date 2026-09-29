import { checklistStates, CHECKLIST_LENGTH, ringProgress, type PreviewStage } from '../previewProgress';

const ORDER: PreviewStage[] = ['uploading', 'submitting', 'queued', 'processing', 'finalizing', 'ready'];

describe('previewProgress', () => {
  it('ticks lines only from real stage transitions', () => {
    expect(checklistStates('uploading')).toEqual(['active', 'pending', 'pending', 'pending']);
    expect(checklistStates('submitting')).toEqual(['done', 'active', 'pending', 'pending']);
    expect(checklistStates('queued')).toEqual(['done', 'done', 'active', 'pending']);
    expect(checklistStates('processing')).toEqual(['done', 'done', 'active', 'pending']);
    expect(checklistStates('finalizing')).toEqual(['done', 'done', 'done', 'active']);
    expect(checklistStates('ready')).toEqual(['done', 'done', 'done', 'done']);
  });

  it('always returns one state per line', () => {
    for (const stage of ORDER) expect(checklistStates(stage)).toHaveLength(CHECKLIST_LENGTH);
  });

  it('ring progress never goes backwards across stages', () => {
    let previous = -1;
    for (const stage of ORDER) {
      const value = ringProgress(stage, 0);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('uses the provider progress while processing, clamped', () => {
    expect(ringProgress('processing', 0.5)).toBeGreaterThan(ringProgress('processing', 0));
    expect(ringProgress('processing', 2)).toBeLessThanOrEqual(ringProgress('finalizing', 0));
    expect(ringProgress('processing', -1)).toBe(ringProgress('processing', 0));
  });

  it('is complete only when ready', () => {
    expect(ringProgress('ready', 1)).toBe(1);
    expect(ringProgress('finalizing', 1)).toBeLessThan(1);
  });
});
