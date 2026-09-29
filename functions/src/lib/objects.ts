/**
 * Server-side checks on Storage objects a request references (defense in
 * depth behind storage.rules): they must exist, have an allowed type, and fit
 * the size limits — before any credit is reserved.
 */
import { fail } from './errors.js';
import { log } from './log.js';
import { statObject } from './media.js';
import { isAllowedAudio, isAllowedImage } from './media-policy.js';

export type ObjectRole = 'image' | 'uploaded_audio' | 'generated_audio' | 'catalog_audio';

export async function assertUsableObject(path: string, role: ObjectRole): Promise<void> {
  const info = await statObject(path);
  if (!info.exists) {
    if (role === 'catalog_audio') log.error('catalog.audio_missing', { reason: path.split('/').pop() ?? '' });
    fail('not_found');
  }
  if (role === 'image' && !isAllowedImage(info.contentType, info.size)) fail('invalid_input');
  if (role === 'uploaded_audio' && !isAllowedAudio(info.contentType, info.size)) fail('invalid_input');
}
