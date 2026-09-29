/**
 * AnalyticsService façade — the only way screens log events (docs/playbooks/analytics.md).
 * Event names/params are typed so the taxonomy in docs/playbooks/analytics.md stays true.
 */
import type { ErrorCode } from '@shared/api';

import { getBackend } from './backend';

export type PaywallSource =
  | 'onboarding'
  | 'locked_compare'
  | 'locked_band'
  | 'locked_photos'
  | 'locked_report'
  | 'locked_hd'
  | 'locked_guide'
  | 'insufficient_credits'
  | 'settings'
  | 'home_banner'
  | 'gift'
  | 'result_upgrade'
  | 'notification';

export type PreviewEntry = 'onboarding' | 'preview_tab' | 'home_card' | 'journey' | 'deeplink';

export type LockedFeature = 'compare' | 'band' | 'photos' | 'report' | 'hd' | 'guide' | 'cohort';

interface EventParams {
  onboarding_start: { variant: string };
  onboarding_complete: { duration_s: number; goal: string; stage: string };
  paywall_view: { source: PaywallSource; offering: string };
  paywall_dismiss: { source: PaywallSource; viewed_s: number };
  paywall_plan_select: { package: string };
  paywall_state: { state: 'failed' | 'empty'; reason: string };
  purchase: { package: string; kind: 'subscription' | 'credits'; is_renewal: boolean };
  purchase_failed: { package: string; reason: string };
  purchase_cancelled: { package: string };
  restore_result: { restored: boolean };
  gift_wheel_view: { source: string };
  gift_wheel_spin: { source: string };
  gift_wheel_reward: { prize: string };
  gift_redeem: { prize: string };
  feature_locked: { feature: LockedFeature };
  journey_setup: { kind: string; stage: string; has_date: boolean };
  day0_set: { goal: string; days_from_today: number };
  photo_captured: { angle: string; day: number; ghost: boolean; source: 'camera' | 'library' };
  capture_gate_blocked: { reason: 'tilt' | 'permission' };
  photo_deleted: { day: number };
  compare_open: { mode: 'wipe' | 'side_by_side'; locked: boolean };
  shed_logged: { count: number; day: number };
  phase_view: { phase: string; day: number };
  report_exported: { photos: number };
  cohort_joined: { goal: string };
  cohort_view: { visible: boolean };
  preview_start: { entry: PreviewEntry; goal: string };
  photo_selected: { source: 'library' | 'camera' | 'sample' | 'journey' };
  consent_accepted: { version: number };
  style_selected: { style: string; density: string };
  generate_tap: { quality: string; credits: number; onboarding: boolean };
  core_action_preview: { quality: string; style: string; goal: string; onboarding: boolean };
  core_action_failed: { reason: ErrorCode; retryable: boolean; stage: string };
  preview_cancel: { quality: string };
  result_view: { first: boolean; onboarding: boolean };
  preview_saved: { quality: string };
  preview_shared: { quality: string };
  notification_prime_view: { source: string };
  notification_permission: { granted: boolean; source: string };
  notification_open: { type: string };
  credits_store_view: { source: string };
  review_prompt: { trigger: string };
  reminder_set: { kind: string; count: number };
  content_reported: { reason: string };
  account_deleted: { had_pro: boolean };
  data_wiped: { photos: number };
}

export type AnalyticsEvent = keyof EventParams;

export function track<E extends AnalyticsEvent>(event: E, params: EventParams[E]): void {
  getBackend().analytics.logEvent(event, params);
}

/** Kit taxonomy: one `onboarding_step_<n>` event per screen with its name. */
export function trackOnboardingStep(index: number, stepName: string): void {
  getBackend().analytics.logEvent(`onboarding_step_${index}`, { step_name: stepName });
}

export function trackScreen(name: string): void {
  getBackend().analytics.logScreen(name);
}

export type UserProperty =
  | 'subscription_status'
  | 'onboarding_variant'
  | 'paywall_variant'
  | 'goal'
  | 'journey_stage'
  | 'backend_mode'
  /** Firebase console campaigns filter on these: offer opt-in and in-app language (incl. es-ES). */
  | 'offers_opt_in'
  | 'app_language';

export function setUserProperty(name: UserProperty, value: string | null): void {
  getBackend().analytics.setUserProperty(name, value);
}

export function identify(uid: string | null): void {
  getBackend().analytics.setUserId(uid);
}

/** Performance trace for cold start / core action (allowlisted attributes only). */
export function startTrace(name: 'app_start_to_onboarding' | 'core_action_submit' | 'paywall_offerings_load') {
  return getBackend().perf.startTrace(name);
}
