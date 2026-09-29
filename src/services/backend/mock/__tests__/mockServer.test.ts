import { randomUUID } from 'expo-crypto';

import { CALLABLES, type CreatePreviewRequest, type CreatePreviewResponse, type PreviewDoc, type WalletDoc } from '@shared/api';
import { PLAN_ALLOWANCE, previewCost } from '@shared/pricing';
import { PRIZES } from '@shared/wheel';

import { BackendError } from '../../types';
import { initialAllowance, mockServer } from '../mockServer';

const flush = () => new Promise((resolve) => setTimeout(resolve, 5));

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof BackendError ? error.code : 'unexpected';
  }
}

function wallet(): WalletDoc {
  let value: WalletDoc | null = null;
  mockServer.watchWallet((w) => {
    value = w;
  })();
  if (!value) throw new Error('no wallet');
  return value;
}

function previews(): PreviewDoc[] {
  let value: PreviewDoc[] = [];
  mockServer.watchPreviews((p) => {
    value = p;
  })();
  return value;
}

async function waitForTerminal(previewId: string): Promise<PreviewDoc> {
  for (let i = 0; i < 100; i++) {
    const doc = previews().find((p) => p.id === previewId);
    if (doc && (doc.status === 'succeeded' || doc.status === 'failed' || doc.status === 'canceled')) return doc;
    await flush();
  }
  throw new Error('preview never finished');
}

function request(overrides: Partial<CreatePreviewRequest> = {}): CreatePreviewRequest {
  return {
    idempotencyKey: randomUUID(),
    photoPath: mockServer.putLocalFile('photo', 'file:///selfie.jpg'),
    goal: 'hairline',
    styleId: 'hairline_soft',
    density: 'natural',
    quality: 'standard',
    ...overrides,
  };
}

const create = (req: CreatePreviewRequest) =>
  mockServer.handle(CALLABLES.createPreview, req) as Promise<CreatePreviewResponse>;

beforeEach(async () => {
  await mockServer.ready();
  await mockServer.reset();
  mockServer.resetFlags();
  mockServer.flags.latency = 0;
});

describe('consent and validation', () => {
  it('refuses a preview before consent', async () => {
    expect(await code(create(request()))).toBe('consent_required');
  });

  it('rejects a style that does not belong to the goal or a disallowed density', async () => {
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
    mockServer.grantDevCredits(10);
    expect(await code(create(request({ goal: 'crown', styleId: 'hairline_soft' })))).toBe('invalid_input');
    expect(await code(create(request({ styleId: 'hairline_lower', density: 'full' })))).toBe('invalid_input');
    expect(await code(create(request({ photoPath: 'uploads/someone-else/x.jpg' })))).toBe('invalid_input');
    expect(wallet().balance).toBe(10);
  });

  it('answers previews_disabled when the kill switch is off, before any charge', async () => {
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
    mockServer.grantDevCredits(5);
    mockServer.flags.generationEnabled = false;
    expect(await code(create(request()))).toBe('previews_disabled');
    expect(wallet().balance).toBe(5);
  });
});

describe('credits', () => {
  beforeEach(async () => {
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
  });

  it('gives the onboarding preview free once, standard and watermarked', async () => {
    const first = await create(request({ onboarding: true }));
    expect(first.reservedCredits).toBe(0);
    const doc = await waitForTerminal(first.previewId);
    expect(doc.status).toBe('succeeded');
    expect(doc.watermarked).toBe(true);
    expect(wallet().previewUsed).toBe(true);
    expect(await code(create(request({ onboarding: true })))).toBe('already_claimed');
    expect(await code(create(request({ onboarding: true, quality: 'high' })))).toBe('invalid_input');
  });

  it('reserves the quoted price and charges it on success, without a watermark', async () => {
    mockServer.grantDevCredits(5);
    const res = await create(request({ quality: 'high' }));
    expect(res.reservedCredits).toBe(previewCost('high'));
    expect(res.balance).toBe(5 - previewCost('high'));
    const doc = await waitForTerminal(res.previewId);
    expect(doc.status).toBe('succeeded');
    expect(doc.chargedCredits).toBe(previewCost('high'));
    expect(doc.watermarked).toBe(false);
    expect(doc.resultPath).not.toBeNull();
    expect(doc.expiresAt - doc.createdAt).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('refuses without enough credits and charges nothing', async () => {
    mockServer.grantDevCredits(2);
    expect(await code(create(request({ quality: 'high' })))).toBe('insufficient_credits');
    expect(wallet().balance).toBe(2);
  });

  it('refunds automatically when the render fails', async () => {
    mockServer.grantDevCredits(3);
    mockServer.flags.failNextPreview = true;
    const res = await create(request());
    const doc = await waitForTerminal(res.previewId);
    expect(doc.status).toBe('failed');
    expect(doc.errorCode).toBe('provider_failed');
    expect(wallet().balance).toBe(3);
  });

  it('gives back the free claim when the onboarding preview fails', async () => {
    mockServer.flags.failNextPreview = true;
    const res = await create(request({ onboarding: true }));
    await waitForTerminal(res.previewId);
    expect(wallet().previewUsed).toBe(false);
  });

  it('replays an idempotency key instead of charging twice', async () => {
    mockServer.grantDevCredits(5);
    const req = request();
    const a = await create(req);
    const b = await create(req);
    expect(b.previewId).toBe(a.previewId);
    expect(wallet().balance).toBe(4);
    expect(previews()).toHaveLength(1);
  });

  it('spends a free-high token instead of credits and restores it on cancel', async () => {
    mockServer.grantDevFreeHigh(1);
    expect(await code(create(request({ useFreeHighToken: true, quality: 'standard' })))).toBe('invalid_input');
    mockServer.flags.latency = 1;
    const res = await create(request({ useFreeHighToken: true, quality: 'high' }));
    expect(res.reservedCredits).toBe(0);
    expect(wallet().freeHighTokens).toBe(0);
    const cancel = (await mockServer.handle(CALLABLES.cancelPreview, { previewId: res.previewId })) as {
      canceled: boolean;
    };
    expect(cancel.canceled).toBe(true);
    expect(wallet().freeHighTokens).toBe(1);
  });

  it('rate-limits per hour before any money moves', async () => {
    mockServer.grantDevCredits(20);
    mockServer.flags.hourlyLimit = 2;
    const a = await create(request());
    await waitForTerminal(a.previewId);
    const b = await create(request());
    await waitForTerminal(b.previewId);
    expect(await code(create(request()))).toBe('rate_limited');
    expect(wallet().balance).toBe(18);
  });

  it('deletes only finished previews', async () => {
    mockServer.grantDevCredits(1);
    const res = await create(request());
    await waitForTerminal(res.previewId);
    await mockServer.handle(CALLABLES.deletePreview, { previewId: res.previewId });
    expect(previews()).toHaveLength(0);
    expect(await code(mockServer.handle(CALLABLES.deletePreview, { previewId: res.previewId }))).toBe('not_found');
  });
});

describe('purchases (webhook stand-in)', () => {
  it('grants the plan allowance and pack credits exactly once per transaction', () => {
    mockServer.grantPurchase('t1', 'com.techtactoe.kok.pro.weekly');
    mockServer.grantPurchase('t1', 'com.techtactoe.kok.pro.weekly');
    expect(wallet().balance).toBe(PLAN_ALLOWANCE.weekly.credits);
    expect(mockServer.isPro).toBe(true);
    mockServer.grantPurchase('t2', 'com.techtactoe.kok.credits_25');
    expect(wallet().balance).toBe(PLAN_ALLOWANCE.weekly.credits + 25);
  });

  it('uses the annual initial allowance', () => {
    expect(initialAllowance('annual')).toBe(PLAN_ALLOWANCE.annual.initial);
    expect(initialAllowance('monthly')).toBe(PLAN_ALLOWANCE.monthly.credits);
  });
});

describe('gift wheel', () => {
  it('spins once, grants what it shows, and expires on a date', async () => {
    mockServer.flags.nextPrize = 'credits10';
    const spin = (await mockServer.handle(CALLABLES.spinGiftWheel, {})) as { grantedCredits: number; expiresAt: string };
    expect(spin.grantedCredits).toBe(PRIZES.credits10.credits);
    expect(wallet().balance).toBe(10);
    expect(Date.parse(spin.expiresAt)).toBeGreaterThan(Date.now());
    expect(await code(mockServer.handle(CALLABLES.spinGiftWheel, {}))).toBe('already_claimed');
  });

  it('turns the discount prize into an open gift offer', async () => {
    mockServer.flags.nextPrize = 'discount40';
    await mockServer.handle(CALLABLES.spinGiftWheel, {});
    expect(mockServer.giftOfferActive).toBe(true);
    mockServer.grantPurchase('t9', 'com.techtactoe.kok.pro.annual.gift');
    expect(mockServer.giftOfferActive).toBe(false);
  });
});

describe('cohort', () => {
  it('stores only date, goal and kind, and returns the configured counts', async () => {
    expect(
      await code(mockServer.handle(CALLABLES.joinCohort, { procedureDate: '2026-02-30', goal: 'hairline', kind: 'transplant' })),
    ).toBe('invalid_input');
    await mockServer.handle(CALLABLES.joinCohort, { procedureDate: '2026-09-01', goal: 'crown', kind: 'transplant' });
    mockServer.flags.cohortSameWeek = 42;
    expect(await mockServer.handle(CALLABLES.getCohort, {})).toEqual({ sameWeek: 42, sameGoal: 0 });
  });
});
