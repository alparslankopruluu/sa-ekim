import { personalLyrics, seedFrom } from '@shared/lyrics';
import { OCCASIONS } from '@shared/catalog';
import {
  checkCaptions,
  checkSongName,
  checkVoiceText,
  containsBlockedTerm,
  isIdempotencyKey,
  isOwnedPath,
  MAX_CAPTION_LINES,
  MAX_SONG_NAME,
  MAX_VOICE_TEXT,
  toCaptionLines,
} from '@shared/validation';

describe('validation', () => {
  it('checks voice text length and blocklist', () => {
    expect(checkVoiceText('hi')).toBe('too_short');
    expect(checkVoiceText('Happy birthday Ada!')).toBe('ok');
    expect(checkVoiceText('x'.repeat(MAX_VOICE_TEXT + 1))).toBe('too_long');
    expect(checkVoiceText('this is porn')).toBe('blocked');
  });

  it('matches blocked terms as words only', () => {
    expect(containsBlockedTerm('Sussex is lovely')).toBe(false);
    expect(containsBlockedTerm('NUDE')).toBe(true);
  });

  it('accepts names in any script but not prompts', () => {
    expect(checkSongName('Ayşe')).toBe('ok');
    expect(checkSongName('さくら')).toBe('ok');
    expect(checkSongName("D'Angelo-Mae Jr.")).toBe('ok');
    expect(checkSongName(' ')).toBe('too_short');
    expect(checkSongName('a'.repeat(MAX_SONG_NAME + 1))).toBe('too_long');
    expect(checkSongName('sing <x>; now')).toBe('blocked');
    expect(checkSongName('123')).toBe('blocked');
  });

  it('bounds caption lines', () => {
    expect(checkCaptions(['one', 'two'])).toBe(true);
    expect(checkCaptions('one')).toBe(false);
    expect(checkCaptions(Array.from({ length: MAX_CAPTION_LINES + 1 }, () => 'x'))).toBe(false);
    expect(checkCaptions(['   '])).toBe(false);
    expect(checkCaptions(['kys'])).toBe(false);
  });

  it('splits text into at most four short caption lines', () => {
    const lines = toCaptionLines('Happy birthday to the best friend in the whole world, you absolute legend, we love you forever and ever');
    expect(lines.length).toBeLessThanOrEqual(MAX_CAPTION_LINES);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(40);
    expect(toCaptionLines('   ')).toEqual([]);
  });

  it('only allows storage paths under the caller prefix', () => {
    expect(isOwnedPath('uploads/u1/a.jpg', 'u1')).toBe(true);
    expect(isOwnedPath('uploads/u2/a.jpg', 'u1')).toBe(false);
    expect(isOwnedPath('uploads/u1/../u2/a.jpg', 'u1')).toBe(false);
    expect(isOwnedPath('renders/u1/a.mp4', 'u1')).toBe(false);
    expect(isOwnedPath('uploads/u1/a/b.jpg', 'u1')).toBe(false);
  });

  it('accepts only UUID idempotency keys', () => {
    expect(isIdempotencyKey('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(isIdempotencyKey('retry-1')).toBe(false);
    expect(isIdempotencyKey(42)).toBe(false);
  });
});

describe('personal lyrics', () => {
  it('is deterministic per seed and always uses the name', () => {
    for (const occasion of OCCASIONS) {
      const seed = seedFrom(`key-${occasion}`);
      const a = personalLyrics(occasion, '  Luna  ', seed);
      expect(a).toEqual(personalLyrics(occasion, 'Luna', seed));
      expect(a.length).toBeGreaterThan(0);
      expect(a.join(' ')).toContain('Luna');
      expect(a.join(' ')).not.toContain('{name}');
    }
    expect(personalLyrics('birthday', 'Max', -7).length).toBeGreaterThan(0);
  });
});
