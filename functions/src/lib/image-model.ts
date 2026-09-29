/**
 * Which fal queue endpoint the paid path calls, selectable at runtime via `config/runtime`
 * (`imageModelQueueURL`) so a model can be swapped without an app release or a Functions deploy.
 *
 * SECURITY: FAL_KEY is sent to this URL in an Authorization header, so a config value must never be
 * able to redirect it to another host — that would be credential exfiltration by anyone who can
 * write the config document. `parseQueueURL` therefore pins the host to fal's queue host and rejects
 * credentials, port, query and fragment. A value that fails any check falls back to the verified
 * default: a bad config entry must not take the paid path down.
 */
import { DEFAULT_IMAGE_QUEUE_URL } from '../config.js';

/** The only host FAL_KEY may ever be sent to for queue calls. */
export const FAL_QUEUE_HOST = 'queue.fal.run';

export interface ImageModel {
  /** `openai/gpt-image-2/edit` style path. */
  modelId: string;
  queueURL: string;
}

/** Accepts only `https://queue.fal.run/<model path>` (no credentials, port, query or fragment). */
export function parseQueueURL(value: unknown): ImageModel | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' || url.host !== FAL_QUEUE_HOST) return undefined;
  if (url.username !== '' || url.password !== '' || url.port !== '') return undefined;
  if (url.search !== '' || url.hash !== '') return undefined;
  const modelId = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (modelId === '' || modelId.includes('..') || !/^[A-Za-z0-9._/-]+$/.test(modelId)) return undefined;
  return { modelId, queueURL: `https://${FAL_QUEUE_HOST}/${modelId}` };
}

export const DEFAULT_IMAGE_MODEL: ImageModel = parseQueueURL(DEFAULT_IMAGE_QUEUE_URL) as ImageModel;

export function resolveImageModel(configured: unknown): ImageModel {
  return parseQueueURL(configured) ?? DEFAULT_IMAGE_MODEL;
}

/** Cancel/status URLs fal hands back are only followed on the queue host. */
export function isAllowedQueueUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1024) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && url.host === FAL_QUEUE_HOST && !url.username && !url.password && !url.port;
}
