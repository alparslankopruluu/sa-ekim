/** Public URL of the `falWebhook` function, handed to fal per preview. */
import { projectID } from 'firebase-functions/params';

import { REGION } from '../config.js';

/**
 * `FAL_WEBHOOK_URL` (functions `.env`, not a secret) overrides the default —
 * e.g. a tunnel while testing against the emulator.
 */
export function falWebhookBaseUrl(): string {
  const override = process.env.FAL_WEBHOOK_URL;
  if (override && /^https:\/\/[^\s]+$/.test(override)) return override;
  return `https://${REGION}-${projectID.value()}.cloudfunctions.net/falWebhook`;
}
