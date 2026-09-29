import { ERROR_CODES, isErrorCode } from '@shared/api';
import { GOALS, STYLES, getStyle, stylesForGoal } from '@shared/catalog';

import {
  buildCreateRequest,
  cardKind,
  coerceDensity,
  creditsAction,
  ctaState,
  defaultDensityFor,
  defaultGoal,
  daysUntilExpiry,
  defaultStyleFor,
  displayProgress,
  errorUx,
  expiresSoon,
  inFlightCount,
  initialSelection,
  isExpired,
  isInFlightStatus,
  latestPhotoForAngle,
  quotePreview,
  refundedCredits,
  renderStage,
  resolveIdempotencyKey,
  selectionForGoalChange,
  selectionForStyle,
  sortPreviews,
  upgradeAction,
  validateDraft,
  type DraftSnapshot,
} from '../previewFlow';

const photo = { localUri: 'file:///a.jpg', storagePath: null, source: 'library' as const };

function draft(overrides: Partial<DraftSnapshot> = {}): DraftSnapshot {
  return {
    goal: 'hairline',
    styleId: 'hairline_soft',
    density: 'natural',
    quality: 'standard',
    photo,
    useFreeHigh: false,
    onboarding: false,
    ...overrides,
  };
}

describe('defaults', () => {
  it('uses the session goal, else hairline', () => {
    expect(defaultGoal('beard')).toBe('beard');
    expect(defaultGoal(null)).toBe('hairline');
    expect(defaultGoal(undefined)).toBe('hairline');
  });

  it('picks a style of the goal and a density the style supports, for every goal', () => {
    for (const goal of GOALS) {
      const style = defaultStyleFor(goal);
      expect(style.goal).toBe(goal);
      expect(style.densities).toContain(defaultDensityFor(style));
    }
  });

  it('starts at the lowest strength a style offers', () => {
    expect(defaultDensityFor(getStyle('crown_medium')!)).toBe('fuller');
    expect(defaultDensityFor(getStyle('hairline_soft')!)).toBe('natural');
  });

  it('coerces an unsupported density to a supported one and keeps a supported one', () => {
    const lower = getStyle('hairline_lower')!;
    expect(coerceDensity(lower, 'full')).toBe('natural');
    const dense = getStyle('hairline_density')!;
    expect(coerceDensity(dense, 'full')).toBe('full');
  });

  it('builds the initial selection for a goal', () => {
    const selection = initialSelection('crown');
    expect(selection.goal).toBe('crown');
    expect(getStyle(selection.styleId)?.goal).toBe('crown');
  });

  it('switching goal picks the new goal default style', () => {
    const next = selectionForGoalChange('brows');
    expect(getStyle(next.styleId)?.goal).toBe('brows');
    expect(getStyle(next.styleId)?.densities).toContain(next.density);
  });

  it('switching style keeps the density when allowed, else falls back', () => {
    expect(selectionForStyle('hairline_density', 'full').density).toBe('full');
    expect(selectionForStyle('hairline_lower', 'full').density).toBe('natural');
  });
});

describe('validateDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateDraft(draft())).toEqual({ ok: true, issues: [] });
  });

  it('reports every missing piece', () => {
    const result = validateDraft(draft({ goal: null, styleId: null, photo: null }));
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining(['goal', 'style', 'photo']));
  });

  it('rejects a style from another goal', () => {
    expect(validateDraft(draft({ goal: 'crown', styleId: 'hairline_soft' })).issues).toContain('style_goal_mismatch');
  });

  it('rejects a density the style cannot show', () => {
    expect(validateDraft(draft({ styleId: 'hairline_lower', density: 'full' })).issues).toContain('density');
  });

  it('rejects an empty photo uri', () => {
    expect(validateDraft(draft({ photo: { ...photo, localUri: '' } })).issues).toContain('photo');
  });
});

describe('quotePreview', () => {
  const base = { onboardingEntry: false, previewUsed: false, balance: 5, freeHighTokens: 0 };

  it('charges 1 credit for standard and 3 for high', () => {
    expect(quotePreview('standard', false, base)).toMatchObject({ kind: 'credits', credits: 1 });
    expect(quotePreview('high', false, base)).toMatchObject({ kind: 'credits', credits: 3 });
  });

  it('is free for the onboarding standard preview while it is unused', () => {
    const quote = quotePreview('standard', false, { ...base, onboardingEntry: true });
    expect(quote).toMatchObject({ kind: 'free', credits: 0, sendOnboarding: true });
  });

  it('is not free once the free preview was used, or when the entry is not onboarding', () => {
    expect(quotePreview('standard', false, { ...base, onboardingEntry: true, previewUsed: true }).kind).toBe('credits');
    expect(quotePreview('standard', false, base).sendOnboarding).toBe(false);
  });

  it('never applies the free preview to high quality', () => {
    const quote = quotePreview('high', false, { ...base, onboardingEntry: true });
    expect(quote).toMatchObject({ kind: 'credits', credits: 3, sendOnboarding: false });
  });

  it('spends a free HD token only when asked, on high, with a token available', () => {
    expect(quotePreview('high', true, { ...base, freeHighTokens: 1 })).toMatchObject({
      kind: 'free_token',
      credits: 0,
      useFreeHighToken: true,
    });
    expect(quotePreview('high', false, { ...base, freeHighTokens: 1 }).kind).toBe('credits');
    expect(quotePreview('high', true, base).kind).toBe('credits');
    expect(quotePreview('standard', true, { ...base, freeHighTokens: 1 }).useFreeHighToken).toBe(false);
  });
});

describe('ctaState', () => {
  const paid = quotePreview('standard', false, { onboardingEntry: false, previewUsed: true, balance: 5, freeHighTokens: 0 });
  const free = quotePreview('standard', false, { onboardingEntry: true, previewUsed: false, balance: 0, freeHighTokens: 0 });
  const ok = { issues: [], hasConsent: true, balance: 5 } as const;

  it('needs a photo first', () => {
    expect(ctaState({ ...ok, issues: ['photo'], quote: paid })).toBe('needs_photo');
  });

  it('needs a style when the selection is broken', () => {
    expect(ctaState({ ...ok, issues: ['style'], quote: paid })).toBe('needs_style');
  });

  it('needs consent before anything is uploaded, even when the preview is free', () => {
    expect(ctaState({ ...ok, hasConsent: false, quote: paid })).toBe('needs_consent');
    expect(ctaState({ ...ok, hasConsent: false, quote: free, balance: 0 })).toBe('needs_consent');
  });

  it('needs credits when the balance is short, but never for a free preview', () => {
    expect(ctaState({ ...ok, balance: 0, quote: paid })).toBe('needs_credits');
    expect(ctaState({ ...ok, balance: 0, quote: free })).toBe('free');
  });

  it('is paid when the balance covers the price, free for token and free previews', () => {
    expect(ctaState({ ...ok, quote: paid })).toBe('paid');
    const high = quotePreview('high', false, { onboardingEntry: false, previewUsed: true, balance: 2, freeHighTokens: 0 });
    expect(ctaState({ ...ok, balance: 2, quote: high })).toBe('needs_credits');
    const token = quotePreview('high', true, { onboardingEntry: false, previewUsed: true, balance: 0, freeHighTokens: 1 });
    expect(ctaState({ ...ok, balance: 0, quote: token })).toBe('free');
  });
});

describe('creditsAction', () => {
  it('sends a non-Pro user with nothing left to the paywall (insufficient_credits)', () => {
    expect(creditsAction({ isPro: false, balance: 0 })).toEqual({ kind: 'paywall', source: 'insufficient_credits' });
  });

  it('sends everyone else to the credit packs', () => {
    expect(creditsAction({ isPro: true, balance: 0 })).toEqual({ kind: 'credits' });
    expect(creditsAction({ isPro: false, balance: 2 })).toEqual({ kind: 'credits' });
  });
});

describe('buildCreateRequest', () => {
  const noFree = { onboardingEntry: false, previewUsed: true, balance: 9, freeHighTokens: 0 };

  it('maps the draft onto the callable request without leaking local fields', () => {
    const request = buildCreateRequest(draft(), quotePreview('standard', false, noFree), 'uploads/u/1.jpg');
    expect(request).toEqual({
      photoPath: 'uploads/u/1.jpg',
      goal: 'hairline',
      styleId: 'hairline_soft',
      density: 'natural',
      quality: 'standard',
    });
  });

  it('adds the region hint, the onboarding flag and the free HD token only when they apply', () => {
    const regionHint = { points: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.5, y: 0.6 }] };
    const withHint = draft({ photo: { ...photo, regionHint }, onboarding: true });
    const freeQuote = quotePreview('standard', false, { ...noFree, onboardingEntry: true, previewUsed: false });
    expect(buildCreateRequest(withHint, freeQuote, 'p')).toMatchObject({ regionHint, onboarding: true });

    const high = draft({ quality: 'high', useFreeHigh: true });
    const tokenQuote = quotePreview('high', true, { ...noFree, freeHighTokens: 2 });
    const request = buildCreateRequest(high, tokenQuote, 'p');
    expect(request.useFreeHighToken).toBe(true);
    expect(request.onboarding).toBeUndefined();
  });

  it('throws for an incomplete draft', () => {
    expect(() => buildCreateRequest(draft({ photo: null }), quotePreview('standard', false, noFree), 'p')).toThrow();
  });
});

describe('resolveIdempotencyKey', () => {
  const fresh = () => 'new-key';

  it('reuses the key after a create-stage failure of the same request', () => {
    const previous = { key: 'old', signature: 's', phase: 'error' as const, failedStage: 'create' as const };
    expect(resolveIdempotencyKey(previous, 's', fresh)).toBe('old');
  });

  it('uses a new key for a different request, a finished attempt or an upload failure', () => {
    expect(resolveIdempotencyKey({ key: 'old', signature: 'x', phase: 'error', failedStage: 'create' }, 's', fresh)).toBe('new-key');
    expect(resolveIdempotencyKey({ key: 'old', signature: 's', phase: 'submitted', failedStage: null }, 's', fresh)).toBe('new-key');
    expect(resolveIdempotencyKey({ key: 'old', signature: 's', phase: 'error', failedStage: 'upload' }, 's', fresh)).toBe('new-key');
    expect(resolveIdempotencyKey(null, 's', fresh)).toBe('new-key');
  });
});

describe('errorUx', () => {
  it('maps every error code and agrees with the shared retryable rule', () => {
    for (const code of ERROR_CODES) {
      const ux = errorUx(code);
      expect(isErrorCode(ux.code)).toBe(true);
      expect(ux.retryable).toBe(['provider_failed', 'timeout', 'offline', 'rate_limited'].includes(code));
      if (ux.retryable) expect(ux.action).toBe('retry');
    }
  });

  it('sends the user to the place that fixes the problem', () => {
    expect(errorUx('insufficient_credits').action).toBe('credits');
    expect(errorUx('consent_required').action).toBe('consent');
    expect(errorUx('pro_required').action).toBe('paywall');
    expect(errorUx('content_blocked').action).toBe('change_photo');
    expect(errorUx('invalid_input').action).toBe('change_photo');
    expect(errorUx('previews_disabled').action).toBe('close');
  });
});

describe('refundedCredits', () => {
  it('returns the reserved credits for failed or canceled previews only', () => {
    expect(refundedCredits({ status: 'failed', reservedCredits: 3 })).toBe(3);
    expect(refundedCredits({ status: 'canceled', reservedCredits: 1 })).toBe(1);
    expect(refundedCredits({ status: 'failed', reservedCredits: 0 })).toBe(0);
    expect(refundedCredits({ status: 'processing', reservedCredits: 3 })).toBe(0);
    expect(refundedCredits({ status: 'succeeded', reservedCredits: 3 })).toBe(0);
  });
});

describe('renderStage', () => {
  it('follows the document once it exists', () => {
    expect(renderStage({ phase: 'submitted', previewId: 'p', doc: { status: 'queued' } })).toBe('queued');
    expect(renderStage({ phase: 'submitted', previewId: 'p', doc: { status: 'processing' } })).toBe('processing');
    expect(renderStage({ phase: 'submitted', previewId: 'p', doc: { status: 'finalizing' } })).toBe('finalizing');
    expect(renderStage({ phase: 'submitted', previewId: 'p', doc: { status: 'succeeded' } })).toBe('succeeded');
    expect(renderStage({ phase: 'submitted', previewId: 'p', doc: { status: 'failed' } })).toBe('failed');
    expect(renderStage({ phase: 'idle', previewId: 'p', doc: { status: 'canceled' } })).toBe('canceled');
  });

  it('waits for the snapshot when the id is known but the document has not arrived', () => {
    expect(renderStage({ phase: 'submitted', previewId: 'p', doc: undefined })).toBe('waiting');
  });

  it('reports the submit phases before an id exists', () => {
    expect(renderStage({ phase: 'idle', previewId: null, doc: undefined })).toBe('uploading');
    expect(renderStage({ phase: 'uploading', previewId: null, doc: undefined })).toBe('uploading');
    expect(renderStage({ phase: 'creating', previewId: null, doc: undefined })).toBe('creating');
    expect(renderStage({ phase: 'error', previewId: null, doc: undefined })).toBe('submit_error');
  });
});

describe('displayProgress', () => {
  it('never exceeds 0.9 before success and reaches 1 on success', () => {
    expect(displayProgress('processing', 0, 10 * 60000)).toBeLessThanOrEqual(0.9);
    expect(displayProgress('succeeded', 0, 0)).toBe(1);
  });

  it('follows the server progress when it is ahead of the estimate', () => {
    expect(displayProgress('processing', 0.7, 1000)).toBe(0.7);
  });

  it('grows with time and stays clamped', () => {
    expect(displayProgress('processing', 0, 30000)).toBeGreaterThan(displayProgress('processing', 0, 5000));
    expect(displayProgress('processing', 5, 0)).toBe(1);
    expect(displayProgress('uploading', Number.NaN, -50)).toBeGreaterThan(0);
  });
});

describe('cards and lists', () => {
  it('classifies statuses', () => {
    expect(cardKind('succeeded')).toBe('ready');
    expect(cardKind('queued')).toBe('inflight');
    expect(cardKind('processing')).toBe('inflight');
    expect(cardKind('finalizing')).toBe('inflight');
    expect(cardKind('failed')).toBe('failed');
    expect(cardKind('canceled')).toBe('canceled');
    expect(isInFlightStatus('finalizing')).toBe(true);
    expect(isInFlightStatus('succeeded')).toBe(false);
  });

  it('sorts newest first without mutating the input and counts in-flight ones', () => {
    const list = [
      { id: 'a', createdAt: 1, status: 'succeeded' as const },
      { id: 'b', createdAt: 3, status: 'queued' as const },
      { id: 'c', createdAt: 2, status: 'failed' as const },
    ];
    expect(sortPreviews(list).map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(list.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(inFlightCount(list)).toBe(1);
  });
});

describe('latestPhotoForAngle', () => {
  const photos = [
    { id: '1', angle: 'front' as const, takenAt: 10 },
    { id: '2', angle: 'front' as const, takenAt: 30 },
    { id: '3', angle: 'top' as const, takenAt: 50 },
  ];

  it('returns the newest photo of exactly that angle', () => {
    expect(latestPhotoForAngle(photos, 'front')?.id).toBe('2');
    expect(latestPhotoForAngle(photos, 'top')?.id).toBe('3');
  });

  it('returns null when the angle was never captured', () => {
    expect(latestPhotoForAngle(photos, 'crown')).toBeNull();
    expect(latestPhotoForAngle([], 'front')).toBeNull();
  });
});

describe('upgradeAction', () => {
  it('creates the HD preview directly when credits or a free token cover it', () => {
    expect(upgradeAction({ isPro: false, balance: 3, freeHighTokens: 0 })).toEqual({ kind: 'try_high' });
    expect(upgradeAction({ isPro: false, balance: 0, freeHighTokens: 1 })).toEqual({ kind: 'try_high' });
    expect(upgradeAction({ isPro: true, balance: 5, freeHighTokens: 0 })).toEqual({ kind: 'try_high' });
  });

  it('sends a short wallet to the credit store, never gating HD behind Pro', () => {
    expect(upgradeAction({ isPro: true, balance: 1, freeHighTokens: 0 })).toEqual({ kind: 'credits' });
    expect(upgradeAction({ isPro: false, balance: 2, freeHighTokens: 0 })).toEqual({ kind: 'credits' });
    expect(upgradeAction({ isPro: true, balance: 0, freeHighTokens: 0 })).toEqual({ kind: 'credits' });
  });

  it('opens the result_upgrade paywall only for a user with no credits and no subscription', () => {
    expect(upgradeAction({ isPro: false, balance: 0, freeHighTokens: 0 })).toEqual({
      kind: 'paywall',
      source: 'result_upgrade',
    });
  });
});

describe('retention', () => {
  const now = Date.UTC(2026, 8, 29);
  const day = 24 * 60 * 60 * 1000;

  it('knows when a preview is deleted', () => {
    expect(isExpired(now - 1, now)).toBe(true);
    expect(isExpired(now, now)).toBe(true);
    expect(isExpired(now + day, now)).toBe(false);
    expect(isExpired(undefined, now)).toBe(false);
    expect(isExpired(Number.NaN, now)).toBe(false);
  });

  it('counts whole days left, rounding up, and null when unknown', () => {
    expect(daysUntilExpiry(now + 30 * day, now)).toBe(30);
    expect(daysUntilExpiry(now + day / 2, now)).toBe(1);
    expect(daysUntilExpiry(now - day, now)).toBe(0);
    expect(daysUntilExpiry(undefined, now)).toBeNull();
  });

  it('nudges to save only in the last week and never after deletion', () => {
    expect(expiresSoon(now + 8 * day, now)).toBe(false);
    expect(expiresSoon(now + 7 * day, now)).toBe(true);
    expect(expiresSoon(now + 1, now)).toBe(true);
    expect(expiresSoon(now - 1, now)).toBe(false);
    expect(expiresSoon(null, now)).toBe(false);
  });
});

describe('catalog assumptions', () => {
  it('every style resolves and every goal has at least one style', () => {
    expect(STYLES.length).toBeGreaterThan(0);
    for (const goal of GOALS) expect(stylesForGoal(goal).length).toBeGreaterThan(0);
  });
});
