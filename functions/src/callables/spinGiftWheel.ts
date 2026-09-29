/**
 * One honest welcome-gift spin per account: the server draws (crypto random,
 * weights from `config/wheel` or the shared defaults) and grants exactly the
 * labelled prize in the same transaction that records the spin.
 */
import { randomBytes } from 'node:crypto';

import { onCall } from 'firebase-functions/v2/https';

import { REGION } from '../config.js';
import { db } from '../lib/admin.js';
import { handleCallable } from '../lib/callable.js';
import { fail } from '../lib/errors.js';
import { normalizeWallet } from '../lib/ledger.js';
import { log } from '../lib/log.js';
import { docPaths } from '../lib/paths.js';
import { creditChange, giftRef, walletRef, type WalletChange, writeLedger, writeWalletChange } from '../lib/wallet.js';
import type { GiftDoc, SpinGiftWheelResponse } from '../shared/api.js';
import { drawPrize, PRIZES, type PrizeDef, prizeExpiry, segmentForPrize, type WeightTable } from '../shared/wheel.js';

/** Uniform float in [0, 1) from 48 random bits. */
export function cryptoRandom(): number {
  return randomBytes(6).readUIntBE(0, 6) / 2 ** 48;
}

function prizeChange(prize: PrizeDef): WalletChange | null {
  if (prize.kind === 'credits') return creditChange(prize.credits ?? 0);
  if (prize.kind === 'token') {
    return {
      credits: 0,
      freePosterTokens: prize.token === 'freePoster' ? 1 : 0,
      hdBoostTokens: prize.token === 'hdBoost' ? 1 : 0,
    };
  }
  return null; // offering prizes unlock a RevenueCat offering in the app
}

export const spinGiftWheel = onCall(
  { region: REGION, enforceAppCheck: true, maxInstances: 10, timeoutSeconds: 30, memory: '256MiB' },
  handleCallable('spinGiftWheel', async (_request, uid): Promise<SpinGiftWheelResponse> => {
    const config = await db().doc(docPaths.wheelConfig()).get();
    const weights: unknown = config.get('weights');
    const overrides = weights && typeof weights === 'object' ? (weights as WeightTable) : null;
    // Drawn once, outside the transaction, so a transaction retry cannot re-roll.
    const prizeId = drawPrize(cryptoRandom, overrides);
    const segmentIndex = segmentForPrize(prizeId, cryptoRandom);
    const prize = PRIZES[prizeId];

    const response = await db().runTransaction(async (tx): Promise<SpinGiftWheelResponse> => {
      const now = Date.now();
      const [giftSnap, walletSnap] = await tx.getAll(giftRef(uid), walletRef(uid));
      if (!giftSnap || !walletSnap) fail('unknown');
      if (giftSnap.exists) fail('already_claimed');

      const change = prizeChange(prize);
      const wallet = change
        ? writeWalletChange(tx, walletRef(uid), walletSnap, change, now)
        : normalizeWallet(walletSnap.data());
      const grantedCredits = prize.kind === 'credits' ? (prize.credits ?? 0) : 0;
      writeLedger(tx, uid, { delta: grantedCredits, reason: 'wheel_prize', refId: prizeId }, now);

      const expiresAt = prizeExpiry(new Date(now)).getTime();
      const gift: GiftDoc = {
        prizeId,
        segmentIndex,
        spunAt: now,
        expiresAt,
        // Credits are granted on the spot; tokens/offerings are redeemed later.
        redeemedAt: prize.kind === 'credits' ? now : null,
      };
      tx.create(giftRef(uid), gift);
      return { prizeId, segmentIndex, expiresAt: new Date(expiresAt).toISOString(), grantedCredits, balance: wallet.balance };
    });
    log.info('wheel.spun', { uid, kind: prizeId, credits: response.grantedCredits });
    return response;
  }),
);
