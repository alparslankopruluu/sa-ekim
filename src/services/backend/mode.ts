import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { BackendMode } from './types';

interface Extra {
  backendMode?: string;
  firebaseRegion?: string;
  legal?: { privacyUrl?: string | null; termsUrl?: string | null; supportEmail?: string | null };
}

export const appExtra: Extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function resolveMode(): BackendMode {
  // The web preview never loads native Firebase modules.
  if (Platform.OS === 'web') return 'mock';
  const mode = appExtra.backendMode;
  return mode === 'live' || mode === 'emulator' ? mode : 'mock';
}

export const backendMode: BackendMode = resolveMode();
export const isMockBackend = backendMode === 'mock';
export const firebaseRegion = appExtra.firebaseRegion ?? 'us-central1';
