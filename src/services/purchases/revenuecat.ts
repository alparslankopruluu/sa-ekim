/** Web/type-level stub: the web preview always uses the mock store. */
import type { PurchasesAdapter } from './types';

export function hasRevenueCatKey(): boolean {
  return false;
}

export function createRevenueCatAdapter(): PurchasesAdapter | null {
  return null;
}
