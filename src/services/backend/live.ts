/**
 * Web (and type-level) fallback for the live backend. Native platforms resolve
 * `./live` to live.native.ts; the web build always runs the mock backend, so
 * Firebase native modules never enter the web bundle.
 */
import { createMockBackend } from './mock';
import type { Backend, BackendMode } from './types';

export function createLiveBackend(_mode: Exclude<BackendMode, 'mock'>): Backend {
  return createMockBackend();
}
