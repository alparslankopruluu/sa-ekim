/**
 * Remote Config keys and their bundled defaults. Cold start never waits for a
 * fetch (docs/playbooks/firebase.md): these values are active immediately.
 */
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
  /** Delay before the paywall close button appears (soft-hard paywall). */
  paywall_close_delay_ms: 2500,
  ff_personal_song: true,
  ff_onboarding_preview: true,
  ff_review_prompt: true,
  ff_trial_toggle: true,
} as const;

export type RemoteKey = keyof typeof REMOTE_DEFAULTS;
