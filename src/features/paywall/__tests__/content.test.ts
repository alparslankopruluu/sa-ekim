import { isPaywallSource, PAYWALL_SOURCES, paywallContent, parseOfferingId, parsePaywallSource } from '../content';

describe('paywallContent', () => {
  it('covers every paywall source with four distinct benefits', () => {
    for (const source of PAYWALL_SOURCES) {
      const content = paywallContent(source, null);
      expect(content.source).toBe(source);
      expect(content.benefits).toHaveLength(4);
      expect(new Set(content.benefits).size).toBe(4);
    }
  });

  it('leads each locked source with the benefit it was opened for', () => {
    expect(paywallContent('locked_compare', null).benefits[0]).toBe('compare');
    expect(paywallContent('locked_band', null).benefits[0]).toBe('band');
    expect(paywallContent('locked_photos', null).benefits[0]).toBe('photos');
    expect(paywallContent('locked_report', null).benefits[0]).toBe('report');
    expect(paywallContent('locked_hd', null).benefits[0]).toBe('hd');
    expect(paywallContent('locked_guide', null).benefits[0]).toBe('guide');
    expect(paywallContent('insufficient_credits', null).benefits[0]).toBe('credits');
  });

  it('echoes the user goal in the headline of general entry points', () => {
    for (const source of ['onboarding', 'settings', 'home_banner', 'gift', 'notification'] as const) {
      expect(paywallContent(source, 'crown').headline).toEqual({ kind: 'goal', goal: 'crown' });
    }
    expect(paywallContent('onboarding', null).headline).toEqual({ kind: 'goal', goal: null });
  });

  it('uses a feature-specific headline for locked entry points', () => {
    expect(paywallContent('locked_compare', 'crown').headline).toEqual({ kind: 'source', source: 'locked_compare' });
    expect(paywallContent('result_upgrade', 'brows').headline).toEqual({ kind: 'source', source: 'result_upgrade' });
  });
});

describe('route param parsing', () => {
  it('accepts only known sources and defaults to settings', () => {
    expect(isPaywallSource('locked_band')).toBe(true);
    expect(isPaywallSource('nope')).toBe(false);
    expect(parsePaywallSource('gift')).toBe('gift');
    expect(parsePaywallSource(undefined)).toBe('settings');
    expect(parsePaywallSource('locked_resolution')).toBe('settings');
  });

  it('only the default and gift_discount offerings can be shown', () => {
    expect(parseOfferingId('gift_discount')).toBe('gift_discount');
    expect(parseOfferingId('credits')).toBe('default');
    expect(parseOfferingId('gift_trial')).toBe('default');
    expect(parseOfferingId(undefined)).toBe('default');
  });
});
