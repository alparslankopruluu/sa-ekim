/**
 * Storage and download helpers. Provider outputs are fetched only from an
 * https allowlist, with a byte cap and a timeout, and stored under the owner's
 * prefix; clients get short-lived signed URLs, never public objects.
 */
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import { bucket } from './admin.js';
import { isAllowedProviderUrl } from './media-policy.js';

export { isAllowedProviderUrl };

export class MediaError extends Error {
  constructor(readonly reason: 'blocked_url' | 'http' | 'too_large' | 'bad_type' | 'empty') {
    super(`media ${reason}`);
    this.name = 'MediaError';
  }
}

const MAX_REDIRECTS = 3;

/** GET that re-checks the allowlist on every redirect hop (no open redirects to other hosts). */
async function fetchAllowed(url: string, signal: AbortSignal): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isAllowedProviderUrl(current)) throw new MediaError('blocked_url');
    const response = await fetch(current, { signal, redirect: 'manual' });
    if (response.status < 300 || response.status > 399) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new MediaError('http');
    current = new URL(location, current).toString();
  }
  throw new MediaError('http');
}

function checkResponse(response: Response, maxBytes: number, typePattern: RegExp): string {
  if (!response.ok || !response.body) throw new MediaError('http');
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) throw new MediaError('too_large');
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!typePattern.test(contentType)) throw new MediaError('bad_type');
  return contentType;
}

function bodyStream(response: Response): Readable {
  return Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>);
}

function byteLimiter(maxBytes: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      seen += chunk.length;
      if (seen > maxBytes) callback(new MediaError('too_large'));
      else callback(null, chunk);
    },
  });
}

/** Downloads a provider output into memory (images, short audio). */
export async function fetchProviderMedia(
  url: string,
  options: { maxBytes: number; timeoutMs: number; typePattern: RegExp },
): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetchAllowed(url, AbortSignal.timeout(options.timeoutMs));
  const contentType = checkResponse(response, options.maxBytes, options.typePattern);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of bodyStream(response)) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += bytes.length;
    if (size > options.maxBytes) throw new MediaError('too_large');
    chunks.push(bytes);
  }
  if (size === 0) throw new MediaError('empty');
  return { buffer: Buffer.concat(chunks), contentType };
}

/** Streams a provider output to a local file (videos). */
export async function downloadProviderMediaToFile(
  url: string,
  destination: string,
  options: { maxBytes: number; timeoutMs: number; typePattern: RegExp },
): Promise<string> {
  const response = await fetchAllowed(url, AbortSignal.timeout(options.timeoutMs));
  const contentType = checkResponse(response, options.maxBytes, options.typePattern);
  await pipeline(bodyStream(response), byteLimiter(options.maxBytes), createWriteStream(destination));
  return contentType;
}

export interface ObjectInfo {
  exists: boolean;
  contentType: string;
  size: number;
  timeCreatedMs: number | null;
}

export async function statObject(path: string): Promise<ObjectInfo> {
  let metadata;
  try {
    [metadata] = await bucket().file(path).getMetadata();
  } catch (error) {
    const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
    if (code === 404) return { exists: false, contentType: '', size: 0, timeCreatedMs: null };
    throw error;
  }
  const created = typeof metadata.timeCreated === 'string' ? Date.parse(metadata.timeCreated) : NaN;
  return {
    exists: true,
    contentType: (metadata.contentType ?? '').toLowerCase(),
    size: Number(metadata.size ?? 0),
    timeCreatedMs: Number.isFinite(created) ? created : null,
  };
}

export async function signedReadUrl(path: string, ttlMs: number): Promise<string> {
  const [url] = await bucket()
    .file(path)
    .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + ttlMs });
  return url;
}

export async function saveBuffer(path: string, buffer: Buffer, contentType: string): Promise<void> {
  await bucket()
    .file(path)
    .save(buffer, { resumable: false, contentType, metadata: { cacheControl: 'private, max-age=3600' } });
}

export async function uploadFile(localPath: string, destination: string, contentType: string): Promise<void> {
  await bucket().upload(localPath, {
    destination,
    resumable: false,
    contentType,
    metadata: { cacheControl: 'private, max-age=3600' },
  });
}

export async function downloadObjectToFile(path: string, destination: string): Promise<void> {
  await bucket().file(path).download({ destination });
}

export async function deletePrefix(prefix: string): Promise<void> {
  await bucket().deleteFiles({ prefix, force: true });
}

/** Runs `work` inside a private temp directory that is always removed. */
export async function withTempDir<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'belto-'));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
