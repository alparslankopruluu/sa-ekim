/** Firestore-backed loader for `config/runtime` (kill switch + model endpoint), cached 60 s. */
import { db } from './admin.js';
import { docPaths } from './paths.js';
import { getRuntimeConfig, type RuntimeConfig } from './runtime-config.js';

export async function currentRuntimeConfig(): Promise<RuntimeConfig> {
  return getRuntimeConfig(async () => (await db().doc(docPaths.runtimeConfig()).get()).data());
}
