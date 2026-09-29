import { previewCost } from '@shared/pricing';

/** How many previews a credit amount buys (whole previews only). */
export function previewEquivalents(credits: number): { standard: number; high: number } {
  const safe = Number.isFinite(credits) && credits > 0 ? Math.floor(credits) : 0;
  return {
    standard: Math.floor(safe / previewCost('standard')),
    high: Math.floor(safe / previewCost('high')),
  };
}
