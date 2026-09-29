/**
 * Server-side prompt construction. The client never sends free-form prompts:
 * it sends catalog ids and validated names/text, and these pure functions
 * build the provider inputs.
 */
import type { MinimaxSpeech28HdInput } from '@fal-ai/client/endpoints';

import type { Genre, LookDef, Occasion, SubjectKind } from '../shared/catalog.js';
import { clampSeconds } from '../shared/pricing.js';

/** Allowed `language_boost` values, taken from fal's typed schema (compile-time checked). */
export type SpeechLanguageBoost = NonNullable<MinimaxSpeech28HdInput['language_boost']>;

const SUBJECT_HINTS: Record<SubjectKind, string> = {
  person: 'The subject is a person.',
  pet: 'The subject is a pet animal; keep its species, breed and coat exactly.',
  drawing: 'The subject is a drawn character; keep its art style and character design.',
};

export function buildPosterPrompt(look: LookDef & { prompt: string }, subject: SubjectKind): string {
  return `${look.prompt} ${SUBJECT_HINTS[subject]}`;
}

const GENRE_STYLES: Record<Genre, string> = {
  pop: 'Bright modern pop with punchy drums and shimmering synths',
  kpop: 'Energetic K-pop dance track with glossy synths and tight percussion',
  rap: 'Confident hip-hop beat with deep 808 bass and crisp hi-hats',
  rock: 'Driving rock anthem with crunchy electric guitars and live drums',
  opera: 'Dramatic operatic aria with orchestral strings and a soaring classical vocal',
  lofi: 'Chill lo-fi groove with warm keys and a laid-back beat',
  country: 'Feel-good country tune with acoustic guitar and a stomping beat',
  love: 'Tender romantic ballad with soft piano and warm strings',
};

const OCCASION_MOODS: Record<Occasion, string> = {
  birthday: 'festive and celebratory',
  love: 'heartfelt and warm',
  friendship: 'warm and upbeat',
  pet: 'playful and cute',
  congrats: 'triumphant and joyful',
  funny: 'playful and comedic',
};

/** MiniMax Music `prompt`: a style description (10–300 characters). */
export function buildMusicStylePrompt(genre: Genre, occasion: Occasion): string {
  return `${GENRE_STYLES[genre]}, ${OCCASION_MOODS[occasion]}, catchy 12-second hook, clear lead vocal`;
}

/** MiniMax Music `lyrics_prompt`: newline-separated lines with a structure tag. */
export function buildLyricsPrompt(lines: readonly string[]): string {
  return ['[Verse]', ...lines].join('\n');
}

/** MiniMax Speech `language_boost` values keyed by BCP-47 primary language subtag. */
const LANGUAGE_BOOST: Record<string, SpeechLanguageBoost> = {
  en: 'English',
  tr: 'Turkish',
  ar: 'Arabic',
  ja: 'Japanese',
  zh: 'Chinese',
  yue: 'Chinese,Yue',
  ru: 'Russian',
  es: 'Spanish',
  pt: 'Portuguese',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  ko: 'Korean',
  nl: 'Dutch',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
  id: 'Indonesian',
  th: 'Thai',
  pl: 'Polish',
  ro: 'Romanian',
  el: 'Greek',
  cs: 'Czech',
  fi: 'Finnish',
  hi: 'Hindi',
  bg: 'Bulgarian',
  da: 'Danish',
  he: 'Hebrew',
  iw: 'Hebrew',
  ms: 'Malay',
  sk: 'Slovak',
  sv: 'Swedish',
  hr: 'Croatian',
  hu: 'Hungarian',
  nb: 'Norwegian',
  no: 'Norwegian',
  nn: 'Nynorsk',
  sl: 'Slovenian',
  ca: 'Catalan',
  af: 'Afrikaans',
};

export function speechLanguageBoost(language: string): SpeechLanguageBoost {
  const tag = language.toLowerCase();
  if (tag === 'zh-hk' || tag === 'zh-mo' || tag.startsWith('zh-hant-hk')) return 'Chinese,Yue';
  const primary = tag.split('-')[0] ?? '';
  return LANGUAGE_BOOST[primary] ?? 'auto';
}

/** Typical speaking rate at speed 1 (characters per second), for a duration estimate. */
const SPEECH_CHARS_PER_SECOND = 14;

/** Whole performance seconds (2..15) for a synthesized line. */
export function speechSeconds(text: string, providerDurationMs: number | null): number {
  if (providerDurationMs !== null && Number.isFinite(providerDurationMs) && providerDurationMs > 0) {
    return clampSeconds(providerDurationMs / 1000);
  }
  return clampSeconds(text.trim().length / SPEECH_CHARS_PER_SECOND);
}
