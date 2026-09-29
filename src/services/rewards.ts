/**
 * Welcome-gift wheel. The server draws the prize; this module only calls it,
 * mirrors the result and schedules one honest reminder before expiry.
 */
import { CALLABLES, type SpinGiftWheelResponse } from '@shared/api';
import { PRIZES } from '@shared/wheel';

import { useAccount } from '@/stores/account';
import { useSession } from '@/stores/session';

import { track } from './analytics';
import { getBackend } from './backend';
import { mockServer } from './backend/mock/mockServer';
import { cancelGiftReminder, scheduleGiftReminder } from './notifications';

export async function refreshGift(): Promise<void> {
  const backend = getBackend();
  const uid = backend.auth.currentUid();
  if (!uid) return;
  try {
    useAccount.getState().setGift(await backend.data.getGift(uid));
  } catch {
    // Non-critical: the home card simply stays hidden until the next refresh.
  }
}

export async function spinGiftWheel(source: string): Promise<SpinGiftWheelResponse> {
  track('gift_wheel_spin', { source });
  const result = await getBackend().functions.call<Record<string, never>, SpinGiftWheelResponse>(
    CALLABLES.spinGiftWheel,
    {},
    20000,
  );
  track('gift_wheel_reward', { prize: result.prizeId });
  await refreshGift();
  const prize = PRIZES[result.prizeId];
  if (prize.kind === 'offering') {
    const id = await scheduleGiftReminder(Date.parse(result.expiresAt));
    useSession.getState().setGiftNotification(id);
  }
  return result;
}

/** Called after a gift offering purchase: no more reminder, gift marked used. */
export async function markGiftRedeemed(): Promise<void> {
  const gift = useAccount.getState().gift;
  if (!gift) return;
  track('gift_redeem', { prize: gift.prizeId });
  await cancelGiftReminder(useSession.getState().giftNotificationId);
  useSession.getState().setGiftNotification(null);
  if (getBackend().mode === 'mock') mockServer.markGiftRedeemed();
  useAccount.getState().setGift({ ...gift, redeemedAt: Date.now() });
}

export function isGiftActive(now = Date.now()): boolean {
  const gift = useAccount.getState().gift;
  return !!gift && gift.redeemedAt === null && gift.expiresAt > now;
}
