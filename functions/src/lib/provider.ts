/**
 * fal.ai adapter behind a small typed interface, over plain `fetch` (injectable for tests — no test
 * ever reaches a real provider). The API key is passed in at call time from the secret, sent only to
 * the pinned fal hosts, and never logged.
 *
 * Flow: upload the (padded) selfie and mask to fal's CDN → submit a queue job with a per-preview
 * webhook URL → fal calls `falWebhook` when done. VERIFY endpoint fields against the live fal model
 * page before launch (`openai/gpt-image-2/edit` accepts `mask_url` and a custom `image_size`).
 */
import type { Quality } from '../shared/catalog.js';
import { classifyFailure, ProviderError } from './failures.js';
import { FAL_QUEUE_HOST, isAllowedQueueUrl, parseQueueURL } from './image-model.js';

/** fal CDN upload host (initiate → PUT). Pinned: the key is sent here too. */
export const FAL_STORAGE_INITIATE_URL = 'https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3';

export interface FalEditPayload {
  prompt: string;
  image_urls: string[];
  image_size: 'auto' | { width: number; height: number };
  quality: 'medium' | 'high';
  num_images: 1;
  output_format: 'jpeg' | 'png';
  /** Set only when a mask was built; never emitted as `undefined`. */
  mask_url?: string;
}

export function falQuality(quality: Quality): 'medium' | 'high' {
  return quality === 'high' ? 'high' : 'medium';
}

export function buildEditPayload(input: {
  prompt: string;
  imageUrl: string;
  quality: Quality;
  imageSize: 'auto' | { width: number; height: number };
  outputFormat: 'jpeg' | 'png';
  maskUrl?: string | null;
}): FalEditPayload {
  const payload: FalEditPayload = {
    prompt: input.prompt,
    image_urls: [input.imageUrl],
    image_size: input.imageSize,
    quality: falQuality(input.quality),
    num_images: 1,
    output_format: input.outputFormat,
  };
  if (typeof input.maskUrl === 'string' && input.maskUrl.length > 0) payload.mask_url = input.maskUrl;
  return payload;
}

/** `<queueURL>?fal_webhook=<encoded webhook URL>` — fal POSTs the result there. */
export function buildSubmitUrl(queueURL: string, webhookUrl: string): string {
  const model = parseQueueURL(queueURL);
  if (!model) throw new ProviderError('provider_failed');
  return `${model.queueURL}?fal_webhook=${encodeURIComponent(webhookUrl)}`;
}

export interface ImageProvider {
  /** Pushes bytes to fal's CDN and returns a URL fal can read. */
  uploadImage(bytes: Buffer, fileName: string, contentType: string): Promise<string>;
  submitEdit(input: { queueURL: string; payload: FalEditPayload; webhookUrl: string }): Promise<{ requestId: string; cancelUrl: string | null }>;
  /** Best effort; never throws. */
  cancel(cancelUrl: string): Promise<void>;
}

type FetchFn = typeof fetch;

async function boundedDetail(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 2000);
  } catch {
    return '';
  }
}

async function failFromResponse(response: Response): Promise<never> {
  throw new ProviderError(classifyFailure({ status: response.status, detail: await boundedDetail(response) }), response.status);
}

export function createFalProvider(apiKey: string, fetchImpl: FetchFn = fetch): ImageProvider {
  if (!apiKey) throw new ProviderError('provider_failed');
  const headers = { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' };
  return {
    async uploadImage(bytes, fileName, contentType) {
      const initiate = await fetchImpl(FAL_STORAGE_INITIATE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ file_name: fileName, content_type: contentType }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!initiate.ok) return failFromResponse(initiate);
      const body = (await initiate.json()) as { upload_url?: unknown; file_url?: unknown };
      if (typeof body.upload_url !== 'string' || typeof body.file_url !== 'string') throw new ProviderError('provider_failed');
      const put = await fetchImpl(body.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(60_000),
      });
      if (!put.ok) return failFromResponse(put);
      return body.file_url;
    },

    async submitEdit({ queueURL, payload, webhookUrl }) {
      const response = await fetchImpl(buildSubmitUrl(queueURL, webhookUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) return failFromResponse(response);
      const body = (await response.json()) as { request_id?: unknown; cancel_url?: unknown };
      if (typeof body.request_id !== 'string' || body.request_id.length === 0 || body.request_id.length > 200) {
        throw new ProviderError('provider_failed');
      }
      return { requestId: body.request_id, cancelUrl: isAllowedQueueUrl(body.cancel_url) ? body.cancel_url : null };
    },

    async cancel(cancelUrl) {
      if (!isAllowedQueueUrl(cancelUrl)) return;
      try {
        await fetchImpl(cancelUrl, { method: 'PUT', headers, signal: AbortSignal.timeout(10_000) });
      } catch {
        // A late webhook for a canceled preview is ignored anyway.
      }
    },
  };
}

type ProviderFactory = (apiKey: string) => ImageProvider;

let factory: ProviderFactory = (apiKey) => createFalProvider(apiKey);

export function imageProvider(apiKey: string): ImageProvider {
  return factory(apiKey);
}

/** Test/emulator seam: swap the provider implementation (returns a restore function). */
export function setImageProviderFactory(next: ProviderFactory): () => void {
  const previous = factory;
  factory = next;
  return () => {
    factory = previous;
  };
}

export { FAL_QUEUE_HOST };

/** First output image URL of a completed job's payload (`{ images: [{ url }] }`). */
export function firstImageUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const images = (data as { images?: unknown }).images;
  const first: unknown = Array.isArray(images) ? images[0] : null;
  const url = first && typeof first === 'object' ? (first as { url?: unknown }).url : null;
  return typeof url === 'string' ? url : null;
}
