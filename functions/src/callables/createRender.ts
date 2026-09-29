/**
 * The core action: photo + sound → lip-synced performance video.
 *
 * 1. Validate (shared validators + stored-object checks) — nothing charged yet.
 * 2. One transaction: idempotent replay check, consent, Pro gate, rate limits,
 *    reserve credits for the longest possible performance (or consume the
 *    free preview / hdBoost token), create the RenderDoc (queued) and the
 *    server-only render record.
 * 3. Prepare inputs (short-lived signed URLs; previews/recordings get their
 *    audio trimmed + normalized server-side) and submit the fal queue job with
 *    a per-render HMAC webhook URL.
 * 4. Any failure before fal accepted the job refunds the whole reservation.
 */
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { onCall } from 'firebase-functions/v2/https';

import {
  FAL_KEY,
  FAL_WEBHOOK_TOKEN_SALT,
  PROVIDER_QUEUE_URL_TTL_MS,
  REGION,
} from '../config.js';
import { hasConsent, isProActive } from '../lib/access.js';
import { db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { falWebhookBaseUrl } from '../lib/endpoints.js';
import { errorName, fail } from '../lib/errors.js';
import { trimAudioToMp3 } from '../lib/ffmpeg.js';
import { failureCodeOf, httpStatusOf } from '../lib/failures.js';
import { decideReplay } from '../lib/idempotency.js';
import { isTokenUsable, NO_CHARGE, normalizeWallet, planRenderCharge } from '../lib/ledger.js';
import { log } from '../lib/log.js';
import { downloadObjectToFile, signedReadUrl, uploadFile, withTempDir } from '../lib/media.js';
import { assertUsableObject, type ObjectRole } from '../lib/objects.js';
import { docPaths, storagePaths } from '../lib/paths.js';
import { mediaProvider } from '../lib/provider.js';
import { decideRenderRateLimit, RENDER_LIMITS } from '../lib/rate-limit.js';
import {
  ACTIVE_RENDER_STATUSES,
  markRenderSubmitted,
  refundRender,
  type RenderPrivateDoc,
  renderPrivateRef,
  renderRef,
} from '../lib/renders.js';
import { buildFalWebhookUrl, createRenderToken } from '../lib/render-token.js';
import type { RenderPlan } from '../lib/validate.js';
import { parseCreateRender } from '../lib/validate.js';
import {
  chargeChange,
  giftRef,
  markRequestFailed,
  newRequestRecord,
  requestRef,
  walletRef,
  writeGiftRedemption,
  writeLedger,
  writeWalletChange,
} from '../lib/wallet.js';
import { decideFinish } from '../lib/watermark.js';
import type { CreateRenderResponse, RenderDoc } from '../shared/api.js';
import { MAX_PERFORMANCE_SECONDS } from '../shared/pricing.js';

type RenderStart = { kind: 'replay' | 'reserved'; response: CreateRenderResponse };

async function beginRender(uid: string, plan: RenderPlan, renderId: string): Promise<RenderStart> {
  return await db().runTransaction(async (tx): Promise<RenderStart> => {
    const now = Date.now();
    const [requestSnap, consentSnap, walletSnap, entitlementSnap, giftSnap] = await tx.getAll(
      requestRef(uid, plan.idempotencyKey),
      db().doc(docPaths.consent(uid)),
      walletRef(uid),
      db().doc(docPaths.entitlement(uid)),
      giftRef(uid),
    );
    if (!requestSnap || !consentSnap || !walletSnap || !entitlementSnap || !giftSnap) fail('unknown');
    const wallet = normalizeWallet(walletSnap.data());

    const decision = decideReplay(requestSnap.data(), 'createRender');
    if (decision.action === 'replay') {
      const stored = decision.record.response ?? {};
      if (typeof stored.renderId !== 'string' || typeof stored.reservedCredits !== 'number') fail('unknown');
      return {
        kind: 'replay',
        response: { renderId: stored.renderId, reservedCredits: stored.reservedCredits, balance: wallet.balance },
      };
    }
    if (decision.action === 'reject') fail(decision.code);

    if (!hasConsent(consentSnap.data())) fail('consent_required');
    if (plan.requiresPro && !isProActive(entitlementSnap.data(), now)) fail('pro_required');

    const renders = db().collection(docPaths.renders(uid));
    const active = await tx.get(
      renders.where('status', 'in', [...ACTIVE_RENDER_STATUSES]).limit(RENDER_LIMITS.maxActive),
    );
    const recent = await tx.get(renders.where('createdAt', '>=', now - RENDER_LIMITS.windowMs).count());
    if (decideRenderRateLimit({ active: active.size, recent: recent.data().count }) === 'rate_limited') {
      fail('rate_limited');
    }

    const planned = planRenderCharge(wallet, {
      purpose: plan.purpose,
      billingResolution: plan.billingResolution,
      useHdBoostToken: plan.useHdBoostToken,
      hdTokenUsable: isTokenUsable(giftSnap.data(), 'hdBoost', now),
    });
    if (!planned.ok) fail(planned.code);
    const charge = planned.charge;

    const next = writeWalletChange(tx, walletRef(uid), walletSnap, chargeChange(charge), now);
    writeLedger(tx, uid, { delta: -charge.credits, reason: 'render_reserve', refId: renderId }, now);
    if (charge.hdBoostTokens > 0) writeGiftRedemption(tx, uid, giftSnap, 'hdBoost', now);

    const finish = decideFinish({ purpose: plan.purpose, reservedCredits: charge.credits });
    const render: RenderDoc = {
      id: renderId,
      status: 'queued',
      purpose: plan.purpose,
      resolution: plan.renderResolution,
      lookId: plan.lookId,
      soundKind: plan.soundKind,
      songId: plan.songId,
      progress: 0,
      reservedCredits: charge.credits,
      chargedCredits: 0,
      seconds: null,
      imagePath: plan.imagePath,
      soundPath: plan.soundPath,
      captions: plan.captions,
      videoPath: null,
      watermarked: finish.watermarked,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
    };
    const priv: RenderPrivateDoc = {
      requestId: null,
      billingResolution: plan.billingResolution,
      charge,
      audioPath: plan.audioSourcePath,
      expectedSeconds: plan.expectedSeconds,
      transcription: plan.transcription,
      idempotencyKey: plan.idempotencyKey,
      outputVideoUrl: null,
      createdAt: now,
      submittedAt: null,
      completedAt: null,
      settledAt: null,
      refundedAt: null,
    };
    tx.create(renderRef(uid, renderId), render);
    tx.create(renderPrivateRef(uid, renderId), priv);
    tx.create(
      requestRef(uid, plan.idempotencyKey),
      newRequestRecord({
        kind: 'createRender',
        // The reservation lives on the render record; refunds follow the render.
        charge: NO_CHARGE,
        refId: renderId,
        response: { renderId, reservedCredits: charge.credits },
        now,
      }),
    );
    return { kind: 'reserved', response: { renderId, reservedCredits: charge.credits, balance: next.balance } };
  });
}

/**
 * Previews are cut to the preview length; user recordings are normalized to
 * MP3 and capped at 15 s. Library songs and our own voice/song files go as-is.
 */
async function providerAudioPath(uid: string, renderId: string, plan: RenderPlan): Promise<string> {
  const seconds = plan.trimToSeconds ?? (plan.soundKind === 'recording' ? MAX_PERFORMANCE_SECONDS : null);
  if (seconds === null) return plan.audioSourcePath;
  const target = storagePaths.renderAudio(uid, renderId);
  await withTempDir(async (dir) => {
    const source = join(dir, 'source');
    const output = join(dir, 'audio.mp3');
    await downloadObjectToFile(plan.audioSourcePath, source);
    await trimAudioToMp3(source, output, seconds);
    await uploadFile(output, target, 'audio/mpeg');
  });
  return target;
}

function audioRole(plan: RenderPlan): ObjectRole {
  if (plan.soundKind === 'song') return 'catalog_audio';
  return plan.soundKind === 'recording' ? 'uploaded_audio' : 'generated_audio';
}

export const createRender = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    secrets: [FAL_KEY, FAL_WEBHOOK_TOKEN_SALT],
    maxInstances: 20,
    timeoutSeconds: 120,
    memory: '1GiB',
  },
  handleCallable('createRender', async (request, uid): Promise<CreateRenderResponse> => {
    const plan = parseCreateRender(request.data, uid);
    await Promise.all([
      assertUsableObject(plan.imagePath, 'image'),
      assertUsableObject(plan.audioSourcePath, audioRole(plan)),
    ]);

    const started = await beginRender(uid, plan, randomUUID());
    if (started.kind === 'replay') return started.response;
    const { renderId } = started.response;

    const provider = mediaProvider(FAL_KEY.value());
    let submittedRequestId: string | null = null;
    try {
      const audioPath = await providerAudioPath(uid, renderId, plan);
      const [imageUrl, audioUrl] = await Promise.all([
        signedReadUrl(plan.imagePath, PROVIDER_QUEUE_URL_TTL_MS),
        signedReadUrl(audioPath, PROVIDER_QUEUE_URL_TTL_MS),
      ]);
      const token = createRenderToken(FAL_WEBHOOK_TOKEN_SALT.value(), uid, renderId);
      const { requestId } = await provider.submitLipSync({
        imageUrl,
        audioUrl,
        resolution: plan.renderResolution,
        transcription: plan.transcription,
        webhookUrl: buildFalWebhookUrl(falWebhookBaseUrl(), uid, renderId, token),
      });
      submittedRequestId = requestId;
      const outcome = await markRenderSubmitted(uid, renderId, plan.idempotencyKey, requestId);
      if (outcome === 'canceled') {
        await provider.cancelLipSync(requestId).catch(() => undefined);
      }
      log.info('render.submitted', { uid, renderId, kind: plan.purpose, credits: started.response.reservedCredits });
      return started.response;
    } catch (error) {
      const code = failureCodeOf(error);
      log.warn('render.submit_failed', { uid, renderId, code, errorName: errorName(error), httpStatus: httpStatusOf(error) });
      if (submittedRequestId) await provider.cancelLipSync(submittedRequestId).catch(() => undefined);
      await refundRender(uid, renderId, { fromStatuses: ['queued'], to: 'failed', errorCode: code });
      await markRequestFailed(uid, plan.idempotencyKey, code);
      return fail(code);
    }
  }),
);
