/**
 * Runtime mirror of server state (wallet, previews, gift) and the entitlement.
 * Written only by services/session.ts subscriptions — screens read it.
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { GiftDoc, PreviewDoc, WalletDoc } from '@shared/api';

import { type EntitlementState, NO_ENTITLEMENT } from '@/services/purchases/types';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface AccountState {
  uid: string | null;
  backendState: LoadState;
  wallet: WalletDoc;
  walletLoaded: boolean;
  previews: PreviewDoc[];
  previewsState: LoadState;
  entitlement: EntitlementState;
  entitlementLoaded: boolean;
  gift: GiftDoc | null;

  setUid(uid: string | null): void;
  setBackendState(state: LoadState): void;
  setWallet(wallet: WalletDoc): void;
  setPreviews(previews: PreviewDoc[]): void;
  setPreviewsState(state: LoadState): void;
  setEntitlement(entitlement: EntitlementState): void;
  setGift(gift: GiftDoc | null): void;
  reset(): void;
}

const EMPTY_WALLET: WalletDoc = { balance: 0, freeHighTokens: 0, previewUsed: false, updatedAt: 0 };

export const useAccount = create<AccountState>()((set) => ({
  uid: null,
  backendState: 'idle',
  wallet: EMPTY_WALLET,
  walletLoaded: false,
  previews: [],
  previewsState: 'idle',
  entitlement: NO_ENTITLEMENT,
  entitlementLoaded: false,
  gift: null,
  setUid: (uid) => set({ uid }),
  setBackendState: (backendState) => set({ backendState }),
  setWallet: (wallet) => set({ wallet, walletLoaded: true }),
  setPreviews: (previews) => set({ previews, previewsState: 'ready' }),
  setPreviewsState: (previewsState) => set({ previewsState }),
  setEntitlement: (entitlement) => set({ entitlement, entitlementLoaded: true }),
  setGift: (gift) => set({ gift }),
  reset: () =>
    set({
      wallet: EMPTY_WALLET,
      walletLoaded: false,
      previews: [],
      previewsState: 'idle',
      entitlement: NO_ENTITLEMENT,
      gift: null,
    }),
}));

export function findPreview(id: string | undefined): PreviewDoc | undefined {
  if (!id) return undefined;
  return useAccount.getState().previews.find((p) => p.id === id);
}

/**
 * Latest succeeded previews. Derived selectors must be wrapped in useShallow: zustand v5
 * hands selectors to useSyncExternalStore, so returning a fresh array on every call loops
 * forever ("Maximum update depth exceeded").
 */
export function useRecentPreviews(limit = 6): PreviewDoc[] {
  return useAccount(useShallow((s) => s.previews.filter((p) => p.status === 'succeeded').slice(0, limit)));
}
