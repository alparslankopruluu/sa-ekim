/**
 * Remote Config keys and their bundled defaults. Cold start never waits for a fetch
 * (docs/playbooks/firebase.md): these values are active immediately.
 */
import { COHORT_MIN_VISIBLE } from '@shared/api';

export const REMOTE_DEFAULTS = {
  /** Forced-update gate: builds below this number see the update screen. */
  min_supported_build: 1,
  onboarding_variant: 'v1',
  paywall_variant: 'v1',
  /**
   * Where the welcome-gift wheel is offered: `home` (user-initiated card — default,
   * lowest App Review 5.6 risk), `onboarding_exit` (after the paywall closes), or `off`.
   */
  wheel_placement: 'home',
  /** Delay before the paywall close button appears (onboarding source only). */
  paywall_close_delay_ms: 2500,
  ff_review_prompt: true,
  /** Client mirror of the server kill switch: `false` hides "new preview" entry points. */
  previews_enabled: true,
  /** The cohort number is only shown at or above this many people (privacy floor). */
  cohort_min_visible: COHORT_MIN_VISIBLE,
  /** Pre-select the annual plan on the paywall. */
  ff_annual_default: true,
} as const;

export type RemoteKey = keyof typeof REMOTE_DEFAULTS;
