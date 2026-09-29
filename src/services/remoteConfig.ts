import { getBackend } from './backend';
import { REMOTE_DEFAULTS, type RemoteKey } from './remoteDefaults';

let initialized = false;

/** Activates bundled defaults immediately; the live fetch happens in the background. */
export async function initRemoteConfig(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await getBackend().remoteConfig.init({ ...REMOTE_DEFAULTS });
}

type BooleanKeys = { [K in RemoteKey]: (typeof REMOTE_DEFAULTS)[K] extends boolean ? K : never }[RemoteKey];
type NumberKeys = { [K in RemoteKey]: (typeof REMOTE_DEFAULTS)[K] extends number ? K : never }[RemoteKey];
type StringKeys = { [K in RemoteKey]: (typeof REMOTE_DEFAULTS)[K] extends string ? K : never }[RemoteKey];

export function remoteFlag(key: BooleanKeys): boolean {
  return getBackend().remoteConfig.getBoolean(key);
}

export function remoteNumber(key: NumberKeys): number {
  const value = getBackend().remoteConfig.getNumber(key);
  return Number.isFinite(value) ? value : REMOTE_DEFAULTS[key];
}

export function remoteString(key: StringKeys): string {
  return getBackend().remoteConfig.getString(key) || REMOTE_DEFAULTS[key];
}

export type WheelPlacement = 'home' | 'onboarding_exit' | 'off';

export function wheelPlacement(): WheelPlacement {
  const value = remoteString('wheel_placement');
  return value === 'onboarding_exit' || value === 'off' ? value : 'home';
}
