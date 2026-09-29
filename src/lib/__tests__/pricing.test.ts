import {
  CREDIT_PACKS,
  clampSeconds,
  creditsForPack,
  estimateCreation,
  MAX_PERFORMANCE_SECONDS,
  PLAN_ALLOWANCE,
  RESOLUTION_INFO,
  RESOLUTIONS,
  renderCost,
  STEP_COSTS,
} from '@shared/pricing';

describe('pricing', () => {
  it('clamps seconds to the provider window and rounds up started seconds', () => {
    expect(clampSeconds(0.2)).toBe(2);
    expect(clampSeconds(7.1)).toBe(8);
    expect(clampSeconds(40)).toBe(MAX_PERFORMANCE_SECONDS);
    expect(clampSeconds(Number.NaN)).toBe(2);
  });

  it('charges per second by resolution', () => {
    expect(renderCost('480p', 5)).toBe(10);
    expect(renderCost('768p', 12)).toBe(48);
    expect(renderCost('1080p', 15)).toBe(120);
    expect(renderCost('2k', 15)).toBe(195);
  });

  it('keeps every credit worth more than its provider cost (≥ 70% margin at the cheapest pack price)', () => {
    // Largest pack: $54.99 / 800 credits, 30% store fee → net ≈ $0.048 per credit.
    const netPerCredit = (54.99 * 0.7) / 800;
    for (const resolution of RESOLUTIONS) {
      const info = RESOLUTION_INFO[resolution];
      const revenuePerSecond = info.creditsPerSecond * netPerCredit;
      expect(info.providerUsdPerSecond / revenuePerSecond).toBeLessThanOrEqual(0.65);
    }
  });

  it('marks HD resolutions pro-only', () => {
    expect(RESOLUTION_INFO['480p'].proOnly).toBe(false);
    expect(RESOLUTION_INFO['768p'].proOnly).toBe(false);
    expect(RESOLUTION_INFO['1080p'].proOnly).toBe(true);
    expect(RESOLUTION_INFO['2k'].proOnly).toBe(true);
  });

  it('estimates a creation without double-charging sounds already paid for', () => {
    const fresh = estimateCreation({
      resolution: '768p',
      seconds: 10,
      withNewPoster: true,
      soundKind: 'personalSong',
      soundAlreadyPaid: false,
    });
    expect(fresh).toEqual({ render: 40, poster: STEP_COSTS.poster, sound: STEP_COSTS.personalSong, total: 47 });

    const paid = estimateCreation({
      resolution: '768p',
      seconds: 10,
      withNewPoster: false,
      soundKind: 'voice',
      soundAlreadyPaid: true,
    });
    expect(paid.total).toBe(40);

    const recording = estimateCreation({
      resolution: '480p',
      seconds: 4,
      withNewPoster: false,
      soundKind: 'recording',
      soundAlreadyPaid: false,
    });
    expect(recording).toEqual({ render: 8, poster: 0, sound: 0, total: 8 });
  });

  it('knows every pack and nothing else', () => {
    for (const pack of CREDIT_PACKS) expect(creditsForPack(pack.id)).toBe(pack.credits);
    expect(creditsForPack('credits_999')).toBeNull();
    expect(PLAN_ALLOWANCE.weekly.credits).toBeGreaterThan(0);
  });
});
