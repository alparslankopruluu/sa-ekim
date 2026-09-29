import { ERROR_CODES } from '@shared/api';

import en from '@/translations/en/errors.json';
import tr from '@/translations/tr/errors.json';

import { errorCodeOf, errorMessageKey, isRetryableError } from '../errors';

const LOCALES: Record<string, Record<string, string>> = { en, tr };

describe('errorCodeOf', () => {
  it('passes valid codes through', () => {
    for (const code of ERROR_CODES) expect(errorCodeOf(code)).toBe(code);
  });

  it('reads `.code` from BackendError-like objects', () => {
    expect(errorCodeOf({ code: 'insufficient_credits' })).toBe('insufficient_credits');
    expect(errorCodeOf(Object.assign(new Error('x'), { code: 'offline' }))).toBe('offline');
  });

  it('falls back to unknown for anything else', () => {
    expect(errorCodeOf(null)).toBe('unknown');
    expect(errorCodeOf(undefined)).toBe('unknown');
    expect(errorCodeOf('nope')).toBe('unknown');
    expect(errorCodeOf({ code: 'functions/internal' })).toBe('unknown');
    expect(errorCodeOf(new Error('boom'))).toBe('unknown');
  });
});

describe('errorMessageKey', () => {
  it('maps a code to its errors.* key', () => {
    expect(errorMessageKey('timeout')).toBe('errors.timeout');
    expect(errorMessageKey(new Error('boom'))).toBe('errors.unknown');
  });
});

describe('isRetryableError', () => {
  it('follows the shared retryable set', () => {
    expect(isRetryableError({ code: 'offline' })).toBe(true);
    expect(isRetryableError({ code: 'content_blocked' })).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('errors translations', () => {
  it.each(['en', 'tr'])('%s has a non-empty message for every ErrorCode and nothing else', (locale) => {
    const messages = LOCALES[locale] ?? {};
    expect(Object.keys(messages).sort()).toEqual([...ERROR_CODES].sort());
    for (const code of ERROR_CODES) expect((messages[code] ?? '').trim().length).toBeGreaterThan(0);
  });
});
