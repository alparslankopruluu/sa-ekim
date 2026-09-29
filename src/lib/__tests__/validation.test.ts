import { MAX_SHED_COUNT } from '@shared/catalog';
import {
  checkFreeText,
  containsBlockedTerm,
  isValidIdempotencyKey,
  MAX_CLINIC_NAME,
  MAX_NOTE_LENGTH,
  parseShedCount,
} from '@shared/validation';

describe('validation', () => {
  it('matches blocked terms as words only', () => {
    expect(containsBlockedTerm('Sussex is lovely')).toBe(false);
    expect(containsBlockedTerm('NUDE')).toBe(true);
    expect(containsBlockedTerm('a nazi b')).toBe(true);
  });

  it('bounds clinic names and notes', () => {
    expect(checkFreeText('Estetik Clinic', MAX_CLINIC_NAME)).toBe('ok');
    expect(checkFreeText('Ayşe Klinik', MAX_CLINIC_NAME)).toBe('ok');
    expect(checkFreeText('   ', MAX_CLINIC_NAME)).toBe('too_short');
    expect(checkFreeText('x'.repeat(MAX_CLINIC_NAME + 1), MAX_CLINIC_NAME)).toBe('too_long');
    expect(checkFreeText('x'.repeat(MAX_NOTE_LENGTH), MAX_NOTE_LENGTH)).toBe('ok');
    expect(checkFreeText('bad\u0007text', MAX_NOTE_LENGTH)).toBe('blocked');
    expect(checkFreeText('this is porn', MAX_NOTE_LENGTH)).toBe('blocked');
  });

  it('parses shed counts as whole numbers within range', () => {
    expect(parseShedCount('0')).toBe(0);
    expect(parseShedCount(' 42 ')).toBe(42);
    expect(parseShedCount(String(MAX_SHED_COUNT))).toBe(MAX_SHED_COUNT);
    expect(parseShedCount('1000')).toBeNull();
    expect(parseShedCount('-1')).toBeNull();
    expect(parseShedCount('4.5')).toBeNull();
    expect(parseShedCount('')).toBeNull();
    expect(parseShedCount('abc')).toBeNull();
  });

  it('accepts only bounded, path-free idempotency keys', () => {
    expect(isValidIdempotencyKey('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(isValidIdempotencyKey('retry-key_1')).toBe(true);
    expect(isValidIdempotencyKey('short')).toBe(false);
    expect(isValidIdempotencyKey('has/slash-key')).toBe(false);
    expect(isValidIdempotencyKey('x'.repeat(65))).toBe(false);
    expect(isValidIdempotencyKey(42)).toBe(false);
  });
});
