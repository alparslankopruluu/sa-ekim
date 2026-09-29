import {
  type FlowContext,
  isBackable,
  nextStep,
  plannedPath,
  previousStep,
  progressPosition,
  primaryAngleFor,
} from '../flow';

const base: FlowContext = {
  stage: null,
  photo: 'unknown',
  consentGivenAtStart: false,
  consentDeclined: false,
  notifyDecided: false,
  previewEnabled: true,
};

const ctx = (patch: Partial<FlowContext> = {}): FlowContext => ({ ...base, ...patch });

describe('onboarding flow', () => {
  it('walks the full path for a planned user who takes a photo', () => {
    const c = ctx({ stage: 'planned' });
    expect(plannedPath(c)).toEqual(['welcome', 'goal', 'stage', 'date', 'photo', 'consent', 'notify', 'crafting', 'reveal']);
  });

  it('skips the date step while researching', () => {
    const c = ctx({ stage: 'researching' });
    expect(nextStep('stage', c)).toBe('photo');
    expect(plannedPath(c)).not.toContain('date');
  });

  it('includes the date step for planned and done', () => {
    expect(nextStep('stage', ctx({ stage: 'planned' }))).toBe('date');
    expect(nextStep('stage', ctx({ stage: 'done' }))).toBe('date');
  });

  it('goes photo -> consent -> notify -> crafting -> reveal -> finish', () => {
    const c = ctx({ stage: 'done', photo: 'present' });
    expect(nextStep('photo', c)).toBe('consent');
    expect(nextStep('consent', c)).toBe('notify');
    expect(nextStep('notify', c)).toBe('crafting');
    expect(nextStep('crafting', c)).toBe('reveal');
    expect(nextStep('reveal', c)).toBe('finish');
  });

  it('a skipped photo drops consent, crafting and reveal but keeps notify', () => {
    const c = ctx({ stage: 'planned', photo: 'skipped' });
    expect(nextStep('photo', c)).toBe('notify');
    expect(nextStep('notify', c)).toBe('finish');
    expect(plannedPath(c)).toEqual(['welcome', 'goal', 'stage', 'date', 'photo', 'notify']);
  });

  it('a declined consent skips the preview but keeps notify', () => {
    const c = ctx({ stage: 'researching', photo: 'present', consentDeclined: true });
    expect(nextStep('photo', c)).toBe('notify');
    expect(nextStep('notify', c)).toBe('finish');
  });

  it('skips consent when it was already given before onboarding', () => {
    const c = ctx({ stage: 'researching', photo: 'present', consentGivenAtStart: true });
    expect(nextStep('photo', c)).toBe('notify');
    expect(nextStep('notify', c)).toBe('crafting');
  });

  it('skips notify when the permission is already decided', () => {
    const c = ctx({ stage: 'researching', photo: 'present', notifyDecided: true });
    expect(nextStep('consent', c)).toBe('crafting');
    const skipped = ctx({ stage: 'researching', photo: 'skipped', notifyDecided: true });
    expect(nextStep('photo', skipped)).toBe('finish');
  });

  it('skips crafting and reveal when previews are disabled or already used', () => {
    const c = ctx({ stage: 'researching', photo: 'present', previewEnabled: false });
    expect(nextStep('photo', c)).toBe('notify');
    expect(nextStep('notify', c)).toBe('finish');
  });

  it('only goal, stage, date and photo can go back', () => {
    expect(isBackable('goal')).toBe(true);
    expect(isBackable('stage')).toBe(true);
    expect(isBackable('date')).toBe(true);
    expect(isBackable('photo')).toBe(true);
    expect(isBackable('welcome')).toBe(false);
    expect(isBackable('consent')).toBe(false);
    expect(isBackable('notify')).toBe(false);
    expect(isBackable('crafting')).toBe(false);
    expect(isBackable('reveal')).toBe(false);
  });

  it('goes back to the nearest applicable earlier step', () => {
    expect(previousStep('goal', ctx())).toBe('welcome');
    expect(previousStep('stage', ctx())).toBe('goal');
    expect(previousStep('date', ctx({ stage: 'done' }))).toBe('stage');
    expect(previousStep('photo', ctx({ stage: 'done' }))).toBe('date');
    expect(previousStep('photo', ctx({ stage: 'researching' }))).toBe('stage');
    expect(previousStep('welcome', ctx())).toBeNull();
  });

  it('reports progress so the last step reaches the end of the bar', () => {
    const c = ctx({ stage: 'researching', photo: 'skipped', notifyDecided: true });
    // welcome, goal, stage, photo
    expect(plannedPath(c)).toHaveLength(4);
    expect(progressPosition('welcome', c)).toEqual({ index: 0, total: 3 });
    expect(progressPosition('photo', c)).toEqual({ index: 3, total: 3 });
  });

  it('keeps progress defined for a step that has just left the path', () => {
    const c = ctx({ stage: 'researching', photo: 'present', consentDeclined: true });
    const position = progressPosition('consent', c);
    expect(position.total).toBeGreaterThan(0);
    expect(position.index).toBeGreaterThanOrEqual(0);
    expect(position.index).toBeLessThanOrEqual(position.total);
  });

  it('asks for the primary angle of each goal', () => {
    expect(primaryAngleFor('hairline')).toBe('front');
    expect(primaryAngleFor('crown')).toBe('crown');
    expect(primaryAngleFor('part')).toBe('top');
    expect(primaryAngleFor('brows')).toBe('front');
    expect(primaryAngleFor('beard')).toBe('front');
    expect(primaryAngleFor(null)).toBe('front');
  });
});
