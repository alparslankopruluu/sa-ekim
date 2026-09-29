/**
 * Server-side check of the Storage object a request references (defense in depth behind
 * storage.rules): it must exist, have a decodable image type, and fit the size limit — before any
 * credit is reserved.
 */
import { fail } from './errors.js';
import { statObject } from './media.js';
import { isAllowedImage } from './media-policy.js';

export async function assertUsableImage(path: string): Promise<void> {
  const info = await statObject(path);
  if (!info.exists) fail('not_found');
  if (!isAllowedImage(info.contentType, info.size)) fail('invalid_input');
}
