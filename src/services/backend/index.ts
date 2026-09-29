import { createLiveBackend } from './live';
import { createMockBackend } from './mock';
import { backendMode } from './mode';
import type { Backend } from './types';

let instance: Backend | null = null;

/** The single backend for this process (mock / emulator / live — see mode.ts). */
export function getBackend(): Backend {
  if (!instance) {
    instance = backendMode === 'mock' ? createMockBackend() : createLiveBackend(backendMode);
  }
  return instance;
}

export { backendMode, isMockBackend } from './mode';
export { BackendError } from './types';
export type { Backend, BackendMode } from './types';
