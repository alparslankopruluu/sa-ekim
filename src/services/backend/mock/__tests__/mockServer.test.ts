import { randomUUID } from 'expo-crypto';

import { CALLABLES, type CreateRenderResponse, type RenderDoc, type WalletDoc } from '@shared/api';
import { findSong } from '@shared/catalog';
import { MAX_PERFORMANCE_SECONDS, renderCost } from '@shared/pricing';

import { BackendError } from '../../types';
import { mockServer } from '../mockServer';

const flush = () => new Promise((resolve) => setTimeout(resolve, 30));

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
  const stop = mockServer.watchWallet((w) => {
    value = w;
  });
  stop();
  if (!value) throw new Error('no wallet');
  return value;
}

function renders(): RenderDoc[] {
  let value: RenderDoc[] = [];
  const stop = mockServer.watchRenders((r) => {
    value = r;
  });
  stop();
  return value;
}

async function waitForTerminal(renderId: string): Promise<RenderDoc> {
  for (let i = 0; i < 100; i += 1) {
    const render = renders().find((r) => r.id === renderId);
    if (render && ['succeeded', 'failed', 'canceled'].includes(render.status)) return render;
    await flush();
  }
  throw new Error('render never finished');
}

const song = findSong('main-character');

function renderRequest(photo: string, overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: randomUUID(),
    imagePath: photo,
    sound: { kind: 'song', songId: 'main-character' },
    resolution: '768p',
    purpose: 'full',
    lookId: 'original',
    ...overrides,
  };
}

describe('mock server (mirrors Cloud Functions rules)', () => {
  let photo: string;

  beforeEach(async () => {
    await mockServer.ready();
    await mockServer.reset();
    mockServer.flags.latency = 0;
    mockServer.flags.failNextRender = false;
    photo = mockServer.putLocalFile('photo', 'file:///photo.jpg');
  });

  it('requires AI-processing consent before any generation', async () => {
    expect(await code(mockServer.handle(CALLABLES.createRender, renderRequest(photo)))).toBe('consent_required');
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
    mockServer.grantDevCredits(100);
    expect(await code(mockServer.handle(CALLABLES.createRender, renderRequest(photo)))).toBe('ok');
  });

  it('gives exactly one free, watermarked 480p preview', async () => {
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
    const first = (await mockServer.handle(CALLABLES.createRender, renderRequest(photo, { purpose: 'preview' }))) as CreateRenderResponse;
    expect(first.reservedCredits).toBe(0);
    const done = await waitForTerminal(first.renderId);
    expect(done).toMatchObject({ status: 'succeeded', resolution: '480p', watermarked: true, chargedCredits: 0, seconds: 5 });
    expect(await code(mockServer.handle(CALLABLES.createRender, renderRequest(photo, { purpose: 'preview' })))).toBe('already_claimed');
  });

  it('reserves the maximum, then settles to the real length', async () => {
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
    expect(await code(mockServer.handle(CALLABLES.createRender, renderRequest(photo)))).toBe('insufficient_credits');
    mockServer.grantDevCredits(100);
    const res = (await mockServer.handle(CALLABLES.createRender, renderRequest(photo))) as CreateRenderResponse;
    expect(res.reservedCredits).toBe(renderCost('768p', MAX_PERFORMANCE_SECONDS));
    expect(res.balance).toBe(100 - res.reservedCredits);
    const done = await waitForTerminal(res.renderId);
    const expected = renderCost('768p', song?.seconds ?? 0);
    expect(done.chargedCredits).toBe(expected);
    expect(wallet().balance).toBe(100 - expected);
  });

  it('replays an idempotent request without charging twice', async () => {
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
    mockServer.grantDevCredits(200);
    const request = renderRequest(photo);
    const a = (await mockServer.handle(CALLABLES.createRender, request)) as CreateRenderResponse;
    const b = (await mockServer.handle(CALLABLES.createRender, request)) as CreateRenderResponse;
    expect(b.renderId).toBe(a.renderId);
    expect(renders()).toHaveLength(1);
    await waitForTerminal(a.renderId);
    expect(wallet().balance).toBe(200 - renderCost('768p', song?.seconds ?? 0));
  });

  it('refunds every reserved credit when a render fails', async () => {
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
    mockServer.grantDevCredits(100);
    mockServer.flags.failNextRender = true;
    const res = (await mockServer.handle(CALLABLES.createRender, renderRequest(photo))) as CreateRenderResponse;
    const done = await waitForTerminal(res.renderId);
    expect(done.status).toBe('failed');
    expect(wallet().balance).toBe(100);
  });

  it('keeps HD for Pro and rejects paths outside the caller prefix', async () => {
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
    mockServer.grantDevCredits(500);
    expect(await code(mockServer.handle(CALLABLES.createRender, renderRequest(photo, { resolution: '1080p' })))).toBe('pro_required');
    expect(await code(mockServer.handle(CALLABLES.createRender, renderRequest('uploads/someone-else/x.jpg')))).toBe('invalid_input');
    expect(await code(mockServer.handle(CALLABLES.createRender, renderRequest(photo, { idempotencyKey: 'nope' })))).toBe('invalid_input');
  });

  it('allows one gift spin and grants exactly what it shows', async () => {
    const spin = (await mockServer.handle(CALLABLES.spinGiftWheel, {})) as { prizeId: string; grantedCredits: number; balance: number };
    expect(spin.balance).toBe(spin.grantedCredits);
    expect(mockServer.getGift()?.prizeId).toBe(spin.prizeId);
    expect(await code(mockServer.handle(CALLABLES.spinGiftWheel, {}))).toBe('already_claimed');
  });

  it('grants a purchase once per transaction', () => {
    mockServer.grantPurchase('tx-1', 'app.belto.ios.credits_300');
    mockServer.grantPurchase('tx-1', 'app.belto.ios.credits_300');
    expect(wallet().balance).toBe(300);
    mockServer.grantPurchase('tx-2', 'app.belto.ios.pro.weekly');
    expect(mockServer.isPro).toBe(true);
    expect(wallet().balance).toBe(450);
  });

  it('deletes only finished renders', async () => {
    await mockServer.handle(CALLABLES.recordConsent, { version: 1 });
    mockServer.grantDevCredits(100);
    const res = (await mockServer.handle(CALLABLES.createRender, renderRequest(photo))) as CreateRenderResponse;
    await waitForTerminal(res.renderId);
    await mockServer.handle(CALLABLES.deleteRender, { renderId: res.renderId });
    expect(renders()).toHaveLength(0);
    expect(mockServer.getPerformance(res.renderId)).toBeNull();
    expect(await code(mockServer.handle(CALLABLES.deleteRender, { renderId: res.renderId }))).toBe('not_found');
  });
});
