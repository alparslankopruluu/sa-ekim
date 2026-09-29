import {
  drawPrize,
  landingRotation,
  PRIZE_TTL_DAYS,
  PRIZES,
  type PrizeId,
  prizeExpiry,
  resolveWeights,
  segmentForPrize,
  WHEEL_SEGMENTS,
} from '@shared/wheel';

describe('gift wheel', () => {
  it('offers exactly the four launch prizes', () => {
    expect(Object.keys(PRIZES).sort()).toEqual(['credits10', 'credits5', 'discount40', 'freeHigh']);
  });

  it('every segment shows a real prize and every prize appears on the wheel', () => {
    for (const id of WHEEL_SEGMENTS) expect(PRIZES[id]).toBeDefined();
    for (const id of Object.keys(PRIZES) as PrizeId[]) expect(WHEEL_SEGMENTS).toContain(id);
  });

  it('draws by weight across the whole [0, 1) range', () => {
    expect(drawPrize(() => 0)).toBe('credits10');
    expect(drawPrize(() => 0.999999)).toBe('discount40');
    expect(drawPrize(() => 1.5)).toBe('discount40');
    expect(drawPrize(() => -1)).toBe('credits10');
  });

  it('honours remote weights and ignores invalid ones', () => {
    const only = { credits10: 0, credits5: 0, freeHigh: 5, discount40: 0 };
    expect(drawPrize(() => 0.5, only)).toBe('freeHigh');
    const weights = resolveWeights({ credits10: -3, credits5: Number.NaN });
    expect(weights.credits10).toBe(PRIZES.credits10.weight);
    expect(weights.credits5).toBe(PRIZES.credits5.weight);
    const none = { credits10: 0, credits5: 0, freeHigh: 0, discount40: 0 };
    expect(drawPrize(() => 0.5, none)).toBe('credits5');
  });

  it('lands on a segment that shows the drawn prize', () => {
    for (const id of Object.keys(PRIZES) as PrizeId[]) {
      for (const r of [0, 0.49, 0.99]) {
        expect(WHEEL_SEGMENTS[segmentForPrize(id, () => r)]).toBe(id);
      }
    }
  });

  it('puts the chosen segment under the top pointer', () => {
    const segment = 360 / WHEEL_SEGMENTS.length;
    WHEEL_SEGMENTS.forEach((_, index) => {
      const rotation = landingRotation(index, 5, 0);
      expect(rotation).toBeGreaterThan(5 * 360);
      expect((index * segment + segment / 2 + rotation) % 360).toBeCloseTo(0);
    });
    const jittered = landingRotation(0, 5, 9);
    expect(jittered - landingRotation(0, 5, 0)).toBeCloseTo(0.35 * segment);
  });

  it('expires prizes after the published TTL (3 days)', () => {
    expect(PRIZE_TTL_DAYS).toBe(3);
    const from = new Date('2026-01-01T00:00:00Z');
    expect(prizeExpiry(from).getTime() - from.getTime()).toBe(PRIZE_TTL_DAYS * 86_400_000);
  });

  it('grants exactly what each prize says', () => {
    for (const prize of Object.values(PRIZES)) {
      if (prize.kind === 'credits') expect(prize.credits).toBeGreaterThan(0);
      if (prize.kind === 'token') expect(prize.token).toBe('freeHigh');
      if (prize.kind === 'offering') expect(prize.offering).toBe('gift_discount');
    }
    expect(PRIZES.credits10.credits).toBeGreaterThan(PRIZES.credits5.credits ?? 0);
  });

  it('shows on the wheel what the default weights pay', () => {
    const total = Object.values(PRIZES).reduce((sum, p) => sum + p.weight, 0);
    for (const prize of Object.values(PRIZES)) {
      const share = WHEEL_SEGMENTS.filter((id) => id === prize.id).length / WHEEL_SEGMENTS.length;
      expect(share).toBeCloseTo(prize.weight / total, 5);
    }
  });
});
