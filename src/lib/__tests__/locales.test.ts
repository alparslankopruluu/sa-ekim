import { isRtl, resolveLanguage, SUPPORTED_LANGUAGES } from '@/lib/locales';

describe('resolveLanguage', () => {
  it('maps device locales in preference order', () => {
    expect(resolveLanguage([{ languageCode: 'xx' }, { languageCode: 'de' }])).toBe('de');
    expect(resolveLanguage([{ languageTag: 'tr-TR' }])).toBe('tr');
    expect(resolveLanguage([{ languageCode: 'KO' }])).toBe('ko');
    expect(resolveLanguage([{ languageCode: 'fr' }])).toBe('fr');
    expect(resolveLanguage([{ languageCode: 'in' }])).toBe('id');
  });

  it('picks Traditional Chinese by script or region, Simplified otherwise', () => {
    expect(resolveLanguage([{ languageCode: 'zh', languageScriptCode: 'Hant' }])).toBe('zh-Hant');
    expect(resolveLanguage([{ languageCode: 'zh', regionCode: 'TW' }])).toBe('zh-Hant');
    expect(resolveLanguage([{ languageTag: 'zh-HK' }])).toBe('zh-Hant');
    expect(resolveLanguage([{ languageCode: 'zh', regionCode: 'CN' }])).toBe('zh-Hans');
  });

  it('maps Portuguese to pt-BR and Nordic neighbours to Swedish', () => {
    expect(resolveLanguage([{ languageCode: 'pt', regionCode: 'PT' }])).toBe('pt-BR');
    expect(resolveLanguage([{ languageCode: 'nb' }])).toBe('sv');
    expect(resolveLanguage([{ languageCode: 'da' }])).toBe('sv');
  });

  it('falls back to English', () => {
    expect(resolveLanguage([])).toBe('en');
    expect(resolveLanguage([{ languageCode: null, languageTag: null }, { languageCode: 'xx' }])).toBe('en');
  });

  it('ships exactly 20 languages and flags Arabic as the only right-to-left one', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(20);
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
    expect(isRtl('tr')).toBe(false);
  });
});
