/**
 * On-device simulation of the Kök Cloud Functions (mock mode).
 *
 * It enforces the same rules the live functions enforce — consent, ownership of uploads,
 * input validation against the shared catalog, credit reservation / settlement / refunds,
 * the free onboarding preview (once per account), free-high tokens, idempotency, a per-hour
 * rate limit, one wheel spin per account — using the very same shared modules, so every
 * screen state (success, failure, insufficient credits, already claimed…) can be exercised
 * with no keys and no network. Nothing here is a real capability: a finished preview is the
 * user's own photo run through a labelled demo variation (see demoResult.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import {
  CALLABLES,
  type CancelPreviewRequest,
  type CohortStats,
  type CreatePreviewRequest,
  type CreatePreviewResponse,
  type DeletePreviewRequest,
  type ErrorCode,
  type GiftDoc,
  type JoinCohortRequest,
  PREVIEW_RETENTION_DAYS,
  type PreviewDoc,
  REPORT_REASONS,
  type RecordConsentRequest,
  type ReportPreviewRequest,
  type SpinGiftWheelResponse,
  type WalletDoc,
} from '@shared/api';
import {
  getStyle,
  isDensity,
  isGoal,
  isQuality,
  isStyleId,
  isValidRegionHint,
  JOURNEY_KINDS,
} from '@shared/catalog';
import { creditsForPack, PLAN_ALLOWANCE, previewCost } from '@shared/pricing';
import { packForProductId, type PlanId, planForProductId } from '@shared/products';
import { isIsoDate } from '@shared/timeline';
import { isValidIdempotencyKey } from '@shared/validation';
import { drawPrize, PRIZES, type PrizeId, prizeExpiry, segmentForPrize } from '@shared/wheel';

import { BackendError, type DeviceFields, type ProfileFields, type UploadKind } from '../types';

const STORAGE_KEY = 'kok.mock.server.v1';
const CONSENT_MIN_VERSION = 1;
/** Previews in flight at once. */
const MAX_ACTIVE_PREVIEWS = 3;
const HOUR_MS = 60 * 60 * 1000;
const RETENTION_MS = PREVIEW_RETENTION_DAYS * 24 * HOUR_MS;

/** Where a mock "file" really lives. */
export type MockFileRef = { kind: 'local'; uri: string } | { kind: 'result'; sourcePath: string };

/** Server-side bookkeeping the client-visible PreviewDoc does not carry. */
interface PreviewMeta {
  /** A `freeHigh` token paid for this preview (restored on failure). */
  usedToken: boolean;
}

interface MockState {
  version: 1;
  uid: string;
  consentVersion: number;
  wallet: WalletDoc;
  gift: GiftDoc | null;
  previews: PreviewDoc[];
  meta: Record<string, PreviewMeta>;
  pro: { active: boolean; productId: string | null; expiresAt: number | null };
  files: Record<string, MockFileRef>;
  requests: Record<string, CreatePreviewResponse>;
  /** Creation timestamps (ms) inside the rate-limit window. */
  createLog: number[];
  processedPurchases: string[];
  reports: { previewId: string; reason: string; at: number }[];
  cohort: JoinCohortRequest | null;
  profile: ProfileFields | null;
  devices: DeviceFields[];
}

/** Developer-screen switches. They only exist in mock mode. */
export interface MockDevFlags {
  /** Make the next preview fail mid-render (with an automatic refund). */
  failNextPreview: boolean;
  /** The code the failing preview reports. */
  failureCode: ErrorCode;
  /** Multiplier for every simulated latency (1 = normal, 0 = instant). */
  latency: number;
  /** Server kill switch: `false` makes createPreview answer `previews_disabled`. */
  generationEnabled: boolean;
  /** What `getCohort` answers (the live server never fabricates these). */
  cohortSameWeek: number;
  cohortSameGoal: number;
  /** Force the next wheel draw (QA of every prize screen); null draws honestly. */
  nextPrize: PrizeId | null;
  /** createPreview calls allowed per rolling hour. */
  hourlyLimit: number;
}

export const DEFAULT_MOCK_FLAGS: Readonly<MockDevFlags> = {
  failNextPreview: false,
  failureCode: 'provider_failed',
  latency: 1,
  generationEnabled: true,
  cohortSameWeek: 0,
  cohortSameGoal: 0,
  nextPrize: null,
  hourlyLimit: 10,
};

export interface MockProInfo {
  active: boolean;
  productId: string | null;
  expiresAt: number | null;
}

type Listener<T> = (value: T) => void;

function now(): number {
  return Date.now();
}

function uuid(): string {
  return Crypto.randomUUID();
}

/** Crypto-strength float in [0, 1). */
function secureRandom(): number {
  const bytes = Crypto.getRandomBytes(4);
  const value = ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  return (value >>> 0) / 4294967296;
}

function isTerminal(status: PreviewDoc['status']): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

/** Credits granted on purchase; annual grants its `initial` allowance, weekly ones follow by cron. */
export function initialAllowance(plan: PlanId): number {
  return plan === 'annual' ? PLAN_ALLOWANCE.annual.initial : PLAN_ALLOWANCE[plan].credits;
}

const PLAN_DURATION_MS: Record<PlanId, number> = {
  weekly: 7 * 24 * HOUR_MS,
  monthly: 30 * 24 * HOUR_MS,
  annual: 365 * 24 * HOUR_MS,
};

function initialState(): MockState {
  return {
    version: 1,
    uid: `mock-${uuid().slice(0, 8)}`,
    consentVersion: 0,
    wallet: { balance: 0, freeHighTokens: 0, previewUsed: false, updatedAt: now() },
    gift: null,
    previews: [],
    meta: {},
    pro: { active: false, productId: null, expiresAt: null },
    files: {},
    requests: {},
    createLog: [],
    processedPurchases: [],
    reports: [],
    cohort: null,
    profile: null,
    devices: [],
  };
}

function ownsUpload(path: unknown, uid: string): path is string {
  return typeof path === 'string' && new RegExp(`^uploads/${uid}/[A-Za-z0-9._-]+$`).test(path) && !path.includes('..');
}

class MockServer {
  private state: MockState = initialState();
  private loaded: Promise<void> | null = null;
  private previewListeners = new Set<Listener<PreviewDoc[]>>();
  private walletListeners = new Set<Listener<WalletDoc>>();
  private proListeners = new Set<Listener<MockProInfo>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly flags: MockDevFlags = { ...DEFAULT_MOCK_FLAGS };

  ready(): Promise<void> {
    if (!this.loaded) {
      this.loaded = (async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<MockState>;
            if (parsed.version === 1 && typeof parsed.uid === 'string') {
              this.state = { ...initialState(), ...parsed } as MockState;
            }
          }
        } catch {
          this.state = initialState();
        }
        this.resumePreviews();
        if (this.purgeExpired()) this.commit();
      })();
    }
    return this.loaded;
  }

  get uid(): string {
    return this.state.uid;
  }

  // ---------------------------------------------------------------- persistence + emit

  private persist(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)).catch(() => undefined);
    }, 120);
  }

  private sortedPreviews(): PreviewDoc[] {
    return [...this.state.previews].sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * The 30-day retention: a finished preview and its images disappear once `expiresAt` has
   * passed (the live `hourlyMaintenance` job does the same). Returns whether anything went.
   */
  purgeExpired(): boolean {
    const stamp = now();
    const expired = this.state.previews.filter((p) => isTerminal(p.status) && p.expiresAt <= stamp);
    if (expired.length === 0) return false;
    for (const preview of expired) {
      delete this.state.files[preview.photoPath];
      if (preview.resultPath) delete this.state.files[preview.resultPath];
      delete this.state.meta[preview.id];
    }
    const gone = new Set(expired.map((p) => p.id));
    this.state.previews = this.state.previews.filter((p) => !gone.has(p.id));
    return true;
  }

  private commit(): void {
    this.purgeExpired();
    this.persist();
    const previews = this.sortedPreviews();
    this.previewListeners.forEach((listener) => listener(previews));
    const wallet = { ...this.state.wallet };
    this.walletListeners.forEach((listener) => listener(wallet));
  }

  private emitPro(): void {
    const info = this.proInfo;
    this.proListeners.forEach((listener) => listener(info));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms * this.flags.latency)));
  }

  // ---------------------------------------------------------------- subscriptions

  watchPreviews(listener: Listener<PreviewDoc[]>): () => void {
    this.purgeExpired();
    this.previewListeners.add(listener);
    listener(this.sortedPreviews());
    return () => {
      this.previewListeners.delete(listener);
    };
  }

  watchWallet(listener: Listener<WalletDoc>): () => void {
    this.walletListeners.add(listener);
    listener({ ...this.state.wallet });
    return () => {
      this.walletListeners.delete(listener);
    };
  }

  /** Entitlement changes (purchase, dev toggle, reset) — feeds the mock store listener. */
  watchPro(listener: Listener<MockProInfo>): () => void {
    this.proListeners.add(listener);
    return () => {
      this.proListeners.delete(listener);
    };
  }

  getGift(): GiftDoc | null {
    return this.state.gift ? { ...this.state.gift } : null;
  }

  // ---------------------------------------------------------------- storage

  putLocalFile(_kind: UploadKind, localUri: string): string {
    const path = `uploads/${this.state.uid}/${uuid()}.jpg`;
    this.state.files[path] = { kind: 'local', uri: localUri };
    this.persist();
    return path;
  }

  resolveFile(path: string): MockFileRef | null {
    return this.state.files[path] ?? null;
  }

  // ---------------------------------------------------------------- profile / devices

  saveProfile(profile: ProfileFields): void {
    this.state.profile = profile;
    this.persist();
  }

  registerDevice(device: DeviceFields): void {
    this.state.devices = [...this.state.devices.filter((d) => d.deviceId !== device.deviceId), device];
    this.persist();
  }

  // ---------------------------------------------------------------- purchases (RevenueCat webhook stand-in)

  get proInfo(): MockProInfo {
    const { active, productId, expiresAt } = this.state.pro;
    const live = active && (expiresAt === null || expiresAt > now());
    return { active: live, productId: live ? productId : null, expiresAt: live ? expiresAt : null };
  }

  get isPro(): boolean {
    return this.proInfo.active;
  }

  /** Developer switch: force the entitlement without a purchase. */
  setEntitlement(active: boolean, productId: string | null, expiresAt: number | null = null): void {
    this.state.pro = { active, productId, expiresAt };
    this.persist();
    this.emitPro();
  }

  /**
   * Mirrors the server's RevenueCat webhook for one completed mock purchase, exactly once
   * per transaction: a plan grants `pro` plus its initial allowance, a pack grants its credits.
   */
  grantPurchase(transactionId: string, productId: string): void {
    if (this.state.processedPurchases.includes(transactionId)) return;
    this.state.processedPurchases.push(transactionId);
    const pack = packForProductId(productId);
    const plan = planForProductId(productId);
    if (pack) {
      this.addCredits(creditsForPack(pack) ?? 0);
    } else if (plan) {
      this.state.pro = { active: true, productId, expiresAt: now() + PLAN_DURATION_MS[plan] };
      this.addCredits(initialAllowance(plan));
      // The gift-discount annual product redeems the won prize.
      if (productId.toLowerCase().endsWith('.gift')) this.markGiftRedeemed();
    }
    this.commit();
    this.emitPro();
  }

  private addCredits(amount: number): void {
    this.state.wallet = { ...this.state.wallet, balance: this.state.wallet.balance + amount, updatedAt: now() };
  }

  // ---------------------------------------------------------------- dev tools

  async reset(): Promise<void> {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.state = initialState();
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.commit();
    this.emitPro();
  }

  /** Restores the developer switches to their defaults (tests and the developer screen). */
  resetFlags(): void {
    Object.assign(this.flags, DEFAULT_MOCK_FLAGS);
  }

  grantDevCredits(amount: number): void {
    this.addCredits(amount);
    this.commit();
  }

  grantDevFreeHigh(count = 1): void {
    this.state.wallet = {
      ...this.state.wallet,
      freeHighTokens: this.state.wallet.freeHighTokens + count,
      updatedAt: now(),
    };
    this.commit();
  }

  // ---------------------------------------------------------------- callables

  async handle(name: string, data: unknown): Promise<unknown> {
    await this.ready();
    if (this.purgeExpired()) this.commit();
    switch (name) {
      case CALLABLES.recordConsent:
        return this.recordConsent(data as RecordConsentRequest);
      case CALLABLES.createPreview:
        return this.createPreview(data as CreatePreviewRequest);
      case CALLABLES.cancelPreview:
        return this.cancelPreview(data as CancelPreviewRequest);
      case CALLABLES.deletePreview:
        return this.deletePreview(data as DeletePreviewRequest);
      case CALLABLES.reportPreview:
        return this.reportPreview(data as ReportPreviewRequest);
      case CALLABLES.spinGiftWheel:
        return this.spinGiftWheel();
      case CALLABLES.joinCohort:
        return this.joinCohort(data as JoinCohortRequest);
      case CALLABLES.getCohort:
        return this.getCohort();
      case CALLABLES.deleteAccount:
        await this.wait(400);
        await this.reset();
        return { deleted: true };
      default:
        throw new BackendError('not_found');
    }
  }

  private async recordConsent(request: RecordConsentRequest): Promise<{ ok: true }> {
    await this.wait(250);
    if (!request || !Number.isInteger(request.version) || request.version < CONSENT_MIN_VERSION) {
      throw new BackendError('invalid_input');
    }
    this.state.consentVersion = request.version;
    this.persist();
    return { ok: true };
  }

  /** Pure validation of a createPreview payload against the shared catalog. */
  private validateCreate(request: CreatePreviewRequest): void {
    const style = isStyleId(request.styleId) ? getStyle(request.styleId) : undefined;
    const valid =
      isGoal(request.goal) &&
      style !== undefined &&
      style.goal === request.goal &&
      isDensity(request.density) &&
      style.densities.includes(request.density) &&
      isQuality(request.quality) &&
      ownsUpload(request.photoPath, this.state.uid) &&
      this.state.files[request.photoPath] !== undefined &&
      (request.regionHint === undefined || isValidRegionHint(request.regionHint)) &&
      (request.useFreeHighToken === undefined || typeof request.useFreeHighToken === 'boolean') &&
      (request.onboarding === undefined || typeof request.onboarding === 'boolean');
    if (!valid) throw new BackendError('invalid_input');
    // The free onboarding preview is standard only, and a free-high token only pays for a
    // high preview outside onboarding.
    if (request.onboarding === true && request.quality !== 'standard') throw new BackendError('invalid_input');
    if (request.useFreeHighToken === true && (request.quality !== 'high' || request.onboarding === true)) {
      throw new BackendError('invalid_input');
    }
  }

  private async createPreview(request: CreatePreviewRequest): Promise<CreatePreviewResponse> {
    if (!this.flags.generationEnabled) throw new BackendError('previews_disabled');
    if (this.state.consentVersion < CONSENT_MIN_VERSION) throw new BackendError('consent_required');
    if (!request || !isValidIdempotencyKey(request.idempotencyKey)) throw new BackendError('invalid_input');
    const replayed = this.state.requests[request.idempotencyKey];
    if (replayed) return { ...replayed };
    this.validateCreate(request);

    // Rate limits before any money moves.
    const cutoff = now() - HOUR_MS;
    this.state.createLog = this.state.createLog.filter((at) => at > cutoff);
    const active = this.state.previews.filter((p) => !isTerminal(p.status)).length;
    if (active >= MAX_ACTIVE_PREVIEWS || this.state.createLog.length >= this.flags.hourlyLimit) {
      throw new BackendError('rate_limited');
    }

    const onboarding = request.onboarding === true;
    let reserved = 0;
    let usedToken = false;
    if (onboarding) {
      if (this.state.wallet.previewUsed) throw new BackendError('already_claimed');
      this.state.wallet = { ...this.state.wallet, previewUsed: true, updatedAt: now() };
    } else if (request.useFreeHighToken === true) {
      if (this.state.wallet.freeHighTokens < 1) throw new BackendError('invalid_input');
      usedToken = true;
      this.state.wallet = {
        ...this.state.wallet,
        freeHighTokens: this.state.wallet.freeHighTokens - 1,
        updatedAt: now(),
      };
    } else {
      reserved = previewCost(request.quality);
      if (this.state.wallet.balance < reserved) throw new BackendError('insufficient_credits');
      this.state.wallet = { ...this.state.wallet, balance: this.state.wallet.balance - reserved, updatedAt: now() };
    }

    const id = uuid();
    const stamp = now();
    const doc: PreviewDoc = {
      id,
      status: 'queued',
      goal: request.goal,
      styleId: request.styleId,
      density: request.density,
      quality: request.quality,
      progress: 0,
      reservedCredits: reserved,
      chargedCredits: 0,
      photoPath: request.photoPath,
      resultPath: null,
      watermarked: onboarding,
      onboarding,
      errorCode: null,
      createdAt: stamp,
      updatedAt: stamp,
      expiresAt: stamp + RETENTION_MS,
    };
    this.state.previews.push(doc);
    this.state.meta[id] = { usedToken };
    this.state.createLog.push(stamp);
    const response: CreatePreviewResponse = { previewId: id, reservedCredits: reserved, balance: this.state.wallet.balance };
    this.state.requests[request.idempotencyKey] = response;
    this.commit();

    const shouldFail = this.flags.failNextPreview;
    this.flags.failNextPreview = false;
    this.schedulePipeline(id, shouldFail ? this.flags.failureCode : null);
    await this.wait(350);
    return response;
  }

  private updatePreview(id: string, patch: Partial<PreviewDoc>): PreviewDoc | null {
    const index = this.state.previews.findIndex((p) => p.id === id);
    const current = this.state.previews[index];
    if (index < 0 || !current) return null;
    const next = { ...current, ...patch, updatedAt: now() };
    this.state.previews[index] = next;
    return next;
  }

  /** Gives back everything a non-succeeded preview took: credits, token, the free claim. */
  private refund(preview: PreviewDoc): void {
    const meta = this.state.meta[preview.id];
    this.state.wallet = {
      ...this.state.wallet,
      balance: this.state.wallet.balance + preview.reservedCredits,
      freeHighTokens: this.state.wallet.freeHighTokens + (meta?.usedToken ? 1 : 0),
      previewUsed: preview.onboarding ? false : this.state.wallet.previewUsed,
      updatedAt: now(),
    };
    if (meta) meta.usedToken = false;
  }

  private clearTimers(id: string): void {
    this.timers.forEach((timer, key) => {
      if (key.startsWith(`${id}:`)) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    });
  }

  /** queued → processing (progress) → finalizing → succeeded in about 4 s, or failed + refund. */
  private schedulePipeline(id: string, failWith: ErrorCode | null): void {
    const ticks = 6;
    const step = (label: string, at: number, fn: () => void) => {
      const key = `${id}:${label}`;
      this.timers.set(
        key,
        setTimeout(() => {
          this.timers.delete(key);
          fn();
        }, at * this.flags.latency),
      );
    };
    const current = (): PreviewDoc | undefined => this.state.previews.find((p) => p.id === id);

    step('start', 500, () => {
      if (current()?.status !== 'queued') return;
      this.updatePreview(id, { status: 'processing', progress: 0.1 });
      this.commit();
    });
    for (let i = 1; i <= ticks; i += 1) {
      step(`tick${i}`, 500 + i * 450, () => {
        const preview = current();
        if (!preview || preview.status !== 'processing') return;
        if (failWith && i === Math.ceil(ticks / 2)) {
          this.refund(preview);
          this.updatePreview(id, { status: 'failed', errorCode: failWith });
          this.commit();
          this.clearTimers(id);
          return;
        }
        this.updatePreview(id, { progress: Math.min(0.9, 0.1 + (i / ticks) * 0.8) });
        this.commit();
      });
    }
    step('finalizing', 500 + (ticks + 1) * 450, () => {
      if (current()?.status !== 'processing') return;
      this.updatePreview(id, { status: 'finalizing', progress: 0.95 });
      this.commit();
    });
    step('done', 4000, () => {
      const preview = current();
      if (!preview || preview.status !== 'finalizing') return;
      const resultPath = `results/${this.state.uid}/${id}.jpg`;
      this.state.files[resultPath] = { kind: 'result', sourcePath: preview.photoPath };
      this.updatePreview(id, {
        status: 'succeeded',
        progress: 1,
        chargedCredits: preview.reservedCredits,
        resultPath,
      });
      this.commit();
    });
  }

  /** An app restart interrupted the simulation: finish it honestly as a timeout with a refund. */
  private resumePreviews(): void {
    let changed = false;
    for (const preview of this.state.previews) {
      if (isTerminal(preview.status)) continue;
      this.refund(preview);
      preview.status = 'failed';
      preview.errorCode = 'timeout';
      preview.updatedAt = now();
      changed = true;
    }
    if (changed) this.commit();
  }

  private async cancelPreview(request: CancelPreviewRequest): Promise<{ canceled: boolean }> {
    await this.wait(300);
    const preview = this.state.previews.find((p) => p.id === request?.previewId);
    if (!preview) throw new BackendError('not_found');
    if (preview.status !== 'queued' && preview.status !== 'processing') return { canceled: false };
    this.clearTimers(preview.id);
    this.refund(preview);
    this.updatePreview(preview.id, { status: 'canceled' });
    this.commit();
    return { canceled: true };
  }

  private async deletePreview(request: DeletePreviewRequest): Promise<{ deleted: true }> {
    await this.wait(300);
    const preview = this.state.previews.find((p) => p.id === request?.previewId);
    if (!preview) throw new BackendError('not_found');
    if (!isTerminal(preview.status)) throw new BackendError('invalid_input');
    this.state.previews = this.state.previews.filter((p) => p.id !== preview.id);
    if (preview.resultPath) delete this.state.files[preview.resultPath];
    delete this.state.meta[preview.id];
    this.commit();
    return { deleted: true };
  }

  private async reportPreview(request: ReportPreviewRequest): Promise<{ reported: true }> {
    await this.wait(400);
    if (!request || !(REPORT_REASONS as readonly string[]).includes(request.reason)) {
      throw new BackendError('invalid_input');
    }
    if (!this.state.previews.some((p) => p.id === request.previewId)) throw new BackendError('not_found');
    this.state.reports.push({ previewId: request.previewId, reason: request.reason, at: now() });
    this.persist();
    return { reported: true };
  }

  private async spinGiftWheel(): Promise<SpinGiftWheelResponse> {
    await this.wait(700);
    if (this.state.gift) throw new BackendError('already_claimed');
    const prizeId = this.flags.nextPrize ?? drawPrize(secureRandom);
    this.flags.nextPrize = null;
    const segmentIndex = segmentForPrize(prizeId, secureRandom);
    const spunAt = now();
    const expiresAt = prizeExpiry(new Date(spunAt)).getTime();
    const prize = PRIZES[prizeId];
    let grantedCredits = 0;
    if (prize.kind === 'credits' && prize.credits) {
      grantedCredits = prize.credits;
      this.addCredits(prize.credits);
    }
    if (prize.kind === 'token' && prize.token === 'freeHigh') {
      this.state.wallet = {
        ...this.state.wallet,
        freeHighTokens: this.state.wallet.freeHighTokens + 1,
        updatedAt: now(),
      };
    }
    this.state.gift = {
      prizeId,
      segmentIndex,
      spunAt,
      expiresAt,
      // Credits and tokens are granted on the spot; the discount stays open until it is bought.
      redeemedAt: prize.kind === 'offering' ? null : spunAt,
    };
    this.commit();
    return {
      prizeId,
      segmentIndex,
      expiresAt: new Date(expiresAt).toISOString(),
      grantedCredits,
      balance: this.state.wallet.balance,
    };
  }

  /** `true` while a won `gift_discount` can still be bought (mock stand-in for the offering override). */
  get giftOfferActive(): boolean {
    const gift = this.state.gift;
    return !!gift && PRIZES[gift.prizeId].kind === 'offering' && gift.redeemedAt === null && gift.expiresAt > now();
  }

  markGiftRedeemed(): void {
    if (this.state.gift && this.state.gift.redeemedAt === null) {
      this.state.gift = { ...this.state.gift, redeemedAt: now() };
      this.persist();
    }
  }

  private async joinCohort(request: JoinCohortRequest): Promise<{ joined: true }> {
    await this.wait(300);
    if (
      !request ||
      !isIsoDate(request.procedureDate) ||
      !isGoal(request.goal) ||
      !(JOURNEY_KINDS as readonly string[]).includes(request.kind)
    ) {
      throw new BackendError('invalid_input');
    }
    // Only these three fields ever leave the device; nothing else is stored.
    this.state.cohort = { procedureDate: request.procedureDate, goal: request.goal, kind: request.kind };
    this.persist();
    return { joined: true };
  }

  private async getCohort(): Promise<CohortStats> {
    await this.wait(300);
    return { sameWeek: this.flags.cohortSameWeek, sameGoal: this.flags.cohortSameGoal };
  }
}

export const mockServer = new MockServer();
