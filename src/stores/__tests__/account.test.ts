import type { PreviewDoc } from '@shared/api';

import { renderHook } from '@testing-library/react-native';

import { findPreview, useAccount, useRecentPreviews } from '../account';

function doc(id: string, status: PreviewDoc['status']): PreviewDoc {
  return {
    id,
    status,
    goal: 'hairline',
    styleId: 'hairline_soft',
    density: 'natural',
    quality: 'standard',
    progress: status === 'succeeded' ? 1 : 0,
    reservedCredits: 1,
    chargedCredits: status === 'succeeded' ? 1 : 0,
    photoPath: `uploads/u/${id}.jpg`,
    resultPath: status === 'succeeded' ? `results/u/${id}.jpg` : null,
    watermarked: false,
    onboarding: false,
    errorCode: null,
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 2,
  };
}

beforeEach(() => useAccount.getState().reset());

describe('account store', () => {
  it('marks previews ready and finds them by id', () => {
    useAccount.getState().setPreviews([doc('a', 'succeeded'), doc('b', 'processing')]);
    expect(useAccount.getState().previewsState).toBe('ready');
    expect(findPreview('b')?.status).toBe('processing');
    expect(findPreview(undefined)).toBeUndefined();
  });

  it('lists only succeeded previews, capped, with a stable reference', async () => {
    useAccount.getState().setPreviews([doc('a', 'succeeded'), doc('b', 'failed'), doc('c', 'succeeded')]);
    const { result, rerender } = await renderHook(() => useRecentPreviews(1));
    const first = result.current;
    expect(first.map((p: PreviewDoc) => p.id)).toEqual(['a']);
    await rerender({});
    expect(result.current).toBe(first);
  });

  it('resets the wallet and previews', () => {
    useAccount.getState().setWallet({ balance: 9, freeHighTokens: 1, previewUsed: true, updatedAt: 1 });
    useAccount.getState().reset();
    expect(useAccount.getState().wallet.balance).toBe(0);
    expect(useAccount.getState().walletLoaded).toBe(false);
  });
});
