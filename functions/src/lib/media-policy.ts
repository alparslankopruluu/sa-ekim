/** Pure media policy: where provider outputs may come from, and what users may upload. */
import { MAX_IMAGE_BYTES } from '../config.js';

/** Hosts fal serves generated media from. VERIFY against current fal docs. */
const PROVIDER_MEDIA_HOST_SUFFIXES = ['fal.media', 'fal.ai', 'fal.run', 'storage.googleapis.com'];

export function isAllowedProviderUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PROVIDER_MEDIA_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/**
 * Formats the server can decode. storage.rules also lets `.heic` through (the app converts to JPEG
 * before upload), but prebuilt sharp has no HEIC decoder, so a HEIC object is rejected before spend.
 */
export const IMAGE_TYPE_PATTERN = /^image\/(jpeg|png|webp)$/;

export function isAllowedImage(contentType: string, size: number): boolean {
  return IMAGE_TYPE_PATTERN.test(contentType) && size > 0 && size <= MAX_IMAGE_BYTES;
}
