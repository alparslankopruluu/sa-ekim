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
  it('every segment shows a real prize and every prize appears on the wheel', () => {
    for (const id of WHEEL_SEGMENTS) expect(PRIZES[id]).toBeDefined();
    for (const id of Object.keys(PRIZES) as PrizeId[]) expect(WHEEL_SEGMENTS).toContain(id);
  });

  it('draws by weight across the whole [0, 1) range', () => {
    expect(drawPrize(() => 0)).toBe('credits40');
    expect(drawPrize(() => 0.999999)).toBe('trial7');
    expect(drawPrize(() => 1.5)).toBe('trial7');
    expect(drawPrize(() => -1)).toBe('credits40');
  });

  it('honours remote weights and ignores invalid ones', () => {
    const only = { credits40: 0, credits20: 0, freePoster: 0, hdBoost: 5, discount40: 0, trial7: 0 };
    expect(drawPrize(() => 0.5, only)).toBe('hdBoost');
    const weights = resolveWeights({ credits40: -3, credits20: Number.NaN });
    expect(weights.credits40).toBe(PRIZES.credits40.weight);
    expect(weights.credits20).toBe(PRIZES.credits20.weight);
    const none = { credits40: 0, credits20: 0, freePoster: 0, hdBoost: 0, discount40: 0, trial7: 0 };
    expect(drawPrize(() => 0.5, none)).toBe('credits20');
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
      // The segment centre plus the rotation ends at 0° (12 o'clock).
      expect((index * segment + segment / 2 + rotation) % 360).toBeCloseTo(0);
    });
    const jittered = landingRotation(0, 5, 9);
    expect(jittered - landingRotation(0, 5, 0)).toBeCloseTo(0.35 * segment);
  });

  it('expires prizes after the published TTL', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    expect(prizeExpiry(from).getTime() - from.getTime()).toBe(PRIZE_TTL_DAYS * 86_400_000);
  });
});
