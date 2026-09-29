/**
 * On-device simulation of the Belto Cloud Functions (mock mode).
 *
 * It enforces the same rules as the real server — consent, ownership, credit
 * reservation/settlement/refunds, one free preview, one wheel spin, idempotency —
 * using the very same shared modules, so every screen state (success, failure,
 * insufficient credits, pro-only…) can be exercised with no keys and no network.
 * Nothing here is shipped as a real capability: renders produce a labelled demo
 * performance, not a lip-synced video.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import {
  CALLABLES,
  type CancelRenderRequest,
  type ComposeSongRequest,
  type ComposeSongResponse,
  type CreatePosterRequest,
  type CreatePosterResponse,
  type CreateRenderRequest,
  type CreateRenderResponse,
  type GiftDoc,
  type RecordConsentRequest,
  type RenderDoc,
  type SpinGiftWheelResponse,
  type SynthesizeVoiceRequest,
  type SynthesizeVoiceResponse,
  type WalletDoc,
} from '@shared/api';
import { findLook, findSong, findVoice, GENRES, OCCASIONS, SONGS } from '@shared/catalog';
import { personalLyrics, seedFrom } from '@shared/lyrics';
import {
  clampSeconds,
  creditsForPack,
  MAX_PERFORMANCE_SECONDS,
  PLAN_ALLOWANCE,
  PREVIEW,
  RESOLUTION_INFO,
  RESOLUTIONS,
  renderCost,
  type Resolution,
  STEP_COSTS,
} from '@shared/pricing';
import { packForProductId, planForProductId } from '@shared/products';
import {
  checkCaptions,
  checkSongName,
  checkVoiceText,
  isIdempotencyKey,
  isOwnedPath,
} from '@shared/validation';
import { drawPrize, PRIZES, prizeExpiry, segmentForPrize } from '@shared/wheel';

import { BackendError, type DeviceFields, type ProfileFields } from '../types';

const STORAGE_KEY = 'belto.mock.server.v1';
const CONSENT_MIN_VERSION = 1;

/** Where a mock "file" really lives. */
export type MockFileRef =
  | { kind: 'local'; uri: string }
  | { kind: 'song'; songId: string };

export interface MockPerformance {
  imagePath: string;
  lookId: string;
  sound: MockFileRef;
  captions: string[];
  songId: string | null;
  /** Resolution the credits are billed at (an HD boost renders 1080p at the 768p price). */
  billedResolution: Resolution;
}

interface MockState {
  version: 1;
  uid: string;
  consentVersion: number;
  wallet: WalletDoc;
  gift: GiftDoc | null;
  renders: RenderDoc[];
  pro: { active: boolean; productId: string | null };
  files: Record<string, MockFileRef>;
  requests: Record<string, unknown>;
  performances: Record<string, MockPerformance>;
  processedPurchases: string[];
  profile: ProfileFields | null;
  devices: DeviceFields[];
}

export interface MockDevFlags {
  failNextRender: boolean;
  /** Multiplier for every simulated latency (1 = normal). */
  latency: number;
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

function initialState(): MockState {
  return {
    version: 1,
    uid: `mock-${uuid().slice(0, 8)}`,
    consentVersion: 0,
    wallet: { balance: 0, freePosterTokens: 0, hdBoostTokens: 0, previewUsed: false, updatedAt: now() },
    gift: null,
    renders: [],
    pro: { active: false, productId: null },
    files: {},
    requests: {},
    performances: {},
    processedPurchases: [],
    profile: null,
    devices: [],
  };
}

class MockServer {
  private state: MockState = initialState();
  private loaded: Promise<void> | null = null;
  private renderListeners = new Set<Listener<RenderDoc[]>>();
  private walletListeners = new Set<Listener<WalletDoc>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly flags: MockDevFlags = { failNextRender: false, latency: 1 };

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
        this.resumeRenders();
      })();
    }
    return this.loaded;
  }

  get uid(): string {
    return this.state.uid;
  }

  // ---------------------------------------------------------------- persistence

  private persist(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)).catch(() => undefined);
    }, 120);
  }

  private emitRenders(): void {
    const sorted = [...this.state.renders].sort((a, b) => b.createdAt - a.createdAt);
    this.renderListeners.forEach((listener) => listener(sorted));
  }

  private emitWallet(): void {
    const wallet = { ...this.state.wallet };
    this.walletListeners.forEach((listener) => listener(wallet));
  }

  private commit(): void {
    this.persist();
    this.emitRenders();
    this.emitWallet();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms * this.flags.latency)));
  }

  // ---------------------------------------------------------------- subscriptions

  watchRenders(listener: Listener<RenderDoc[]>): () => void {
    this.renderListeners.add(listener);
    listener([...this.state.renders].sort((a, b) => b.createdAt - a.createdAt));
    return () => {
      this.renderListeners.delete(listener);
    };
  }

  watchWallet(listener: Listener<WalletDoc>): () => void {
    this.walletListeners.add(listener);
    listener({ ...this.state.wallet });
    return () => {
      this.walletListeners.delete(listener);
    };
  }

  getGift(): GiftDoc | null {
    return this.state.gift ? { ...this.state.gift } : null;
  }

  getPerformance(renderId: string): MockPerformance | null {
    return this.state.performances[renderId] ?? null;
  }

  // ---------------------------------------------------------------- storage

  putLocalFile(kind: 'photo' | 'audio', localUri: string): string {
    const extension = kind === 'photo' ? 'jpg' : 'm4a';
    const path = `uploads/${this.state.uid}/${uuid()}.${extension}`;
    this.state.files[path] = { kind: 'local', uri: localUri };
    this.persist();
    return path;
  }

  resolveFile(path: string): MockFileRef | null {
    return this.state.files[path] ?? null;
  }

  // ---------------------------------------------------------------- profile/devices

  saveProfile(profile: ProfileFields): void {
    this.state.profile = profile;
    this.persist();
  }

  registerDevice(device: DeviceFields): void {
    this.state.devices = [...this.state.devices.filter((d) => d.deviceId !== device.deviceId), device];
    this.persist();
  }

  // ---------------------------------------------------------------- purchases (RevenueCat webhook stand-in)

  setEntitlement(active: boolean, productId: string | null): void {
    this.state.pro = { active, productId };
    this.persist();
  }

  get isPro(): boolean {
    return this.state.pro.active;
  }

  /** Mirrors the server's RevenueCat webhook grants for a completed mock purchase. */
  grantPurchase(transactionId: string, productId: string): void {
    if (this.state.processedPurchases.includes(transactionId)) return;
    this.state.processedPurchases.push(transactionId);
    const pack = packForProductId(productId);
    const plan = planForProductId(productId);
    if (pack) {
      this.addCredits(creditsForPack(pack) ?? 0);
    } else if (plan) {
      this.state.pro = { active: true, productId };
      this.addCredits(PLAN_ALLOWANCE[plan].credits);
    }
    this.commit();
  }

  private addCredits(amount: number): void {
    this.state.wallet = { ...this.state.wallet, balance: this.state.wallet.balance + amount, updatedAt: now() };
  }

  // ---------------------------------------------------------------- dev tools

  async reset(): Promise<void> {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.state = initialState();
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.commit();
  }

  grantDevCredits(amount: number): void {
    this.addCredits(amount);
    this.commit();
  }

  // ---------------------------------------------------------------- callables

  async handle(name: string, data: unknown): Promise<unknown> {
    await this.ready();
    switch (name) {
      case CALLABLES.recordConsent:
        return this.recordConsent(data as RecordConsentRequest);
      case CALLABLES.createPoster:
        return this.createPoster(data as CreatePosterRequest);
      case CALLABLES.synthesizeVoice:
        return this.synthesizeVoice(data as SynthesizeVoiceRequest);
      case CALLABLES.composeSong:
        return this.composeSong(data as ComposeSongRequest);
      case CALLABLES.createRender:
        return this.createRender(data as CreateRenderRequest);
      case CALLABLES.cancelRender:
        return this.cancelRender(data as CancelRenderRequest);
      case CALLABLES.spinGiftWheel:
        return this.spinGiftWheel();
      case CALLABLES.deleteRender:
        return this.deleteRender((data as { renderId?: unknown }).renderId);
      case CALLABLES.reportRender:
        await this.wait(400);
        if (!this.state.renders.some((r) => r.id === (data as { renderId?: unknown }).renderId)) {
          throw new BackendError('not_found');
        }
        return { reported: true };
      case CALLABLES.deleteAccount:
        await this.reset();
        return { deleted: true };
      default:
        throw new BackendError('not_found');
    }
  }

  private requireConsent(): void {
    if (this.state.consentVersion < CONSENT_MIN_VERSION) throw new BackendError('consent_required');
  }

  private replay<T>(key: string): T | null {
    return (this.state.requests[key] as T | undefined) ?? null;
  }

  private remember(key: string, response: unknown): void {
    this.state.requests[key] = response;
  }

  private charge(amount: number): void {
    if (this.state.wallet.balance < amount) throw new BackendError('insufficient_credits');
    this.state.wallet = { ...this.state.wallet, balance: this.state.wallet.balance - amount, updatedAt: now() };
  }

  private async recordConsent(request: RecordConsentRequest): Promise<{ ok: true }> {
    await this.wait(250);
    if (!Number.isInteger(request.version) || request.version < CONSENT_MIN_VERSION) {
      throw new BackendError('invalid_input');
    }
    this.state.consentVersion = request.version;
    this.persist();
    return { ok: true };
  }

  private async createPoster(request: CreatePosterRequest): Promise<CreatePosterResponse> {
    this.requireConsent();
    if (!isIdempotencyKey(request.idempotencyKey)) throw new BackendError('invalid_input');
    const replayed = this.replay<CreatePosterResponse>(request.idempotencyKey);
    if (replayed) return replayed;
    const look = findLook(request.lookId);
    const source = this.state.files[request.photoPath];
    if (!look || !look.prompt || !isOwnedPath(request.photoPath, this.state.uid) || !source) {
      throw new BackendError('invalid_input');
    }
    if (look.proOnly && !this.state.pro.active) throw new BackendError('pro_required');

    const useToken = request.useFreePosterToken === true && this.state.wallet.freePosterTokens > 0;
    if (useToken) {
      this.state.wallet = {
        ...this.state.wallet,
        freePosterTokens: this.state.wallet.freePosterTokens - 1,
        updatedAt: now(),
      };
    } else {
      this.charge(STEP_COSTS.poster);
    }
    this.commit();
    await this.wait(2400);

    // The mock "restyle" keeps the photo; the app draws the look's poster frame around it.
    const posterPath = `posters/${this.state.uid}/${uuid()}.png`;
    this.state.files[posterPath] = source;
    const response: CreatePosterResponse = {
      posterPath,
      posterUrl: source.kind === 'local' ? source.uri : '',
      balance: this.state.wallet.balance,
    };
    this.remember(request.idempotencyKey, response);
    this.commit();
    return response;
  }

  private async synthesizeVoice(request: SynthesizeVoiceRequest): Promise<SynthesizeVoiceResponse> {
    this.requireConsent();
    if (!isIdempotencyKey(request.idempotencyKey)) throw new BackendError('invalid_input');
    const replayed = this.replay<SynthesizeVoiceResponse>(request.idempotencyKey);
    if (replayed) return replayed;
    const verdict = checkVoiceText(request.text);
    if (verdict === 'blocked') throw new BackendError('content_blocked');
    if (verdict !== 'ok' || !findVoice(request.voiceId)) throw new BackendError('invalid_input');
    this.charge(STEP_COSTS.voiceLine);
    this.commit();
    await this.wait(1500);

    // No speech synthesis offline: the demo voice is a catalog placeholder melody.
    const storagePath = `voices/${this.state.uid}/${uuid()}.wav`;
    const placeholder = SONGS[Math.abs(seedFrom(request.voiceId)) % SONGS.length] ?? SONGS[0];
    this.state.files[storagePath] = { kind: 'song', songId: placeholder?.id ?? 'monday-mood' };
    const seconds = clampSeconds(request.text.trim().length / 14);
    const response: SynthesizeVoiceResponse = {
      storagePath,
      audioUrl: `belto-asset://song/${placeholder?.id ?? 'monday-mood'}`,
      seconds,
      balance: this.state.wallet.balance,
    };
    this.remember(request.idempotencyKey, response);
    this.commit();
    return response;
  }

  private async composeSong(request: ComposeSongRequest): Promise<ComposeSongResponse> {
    this.requireConsent();
    if (!isIdempotencyKey(request.idempotencyKey)) throw new BackendError('invalid_input');
    const replayed = this.replay<ComposeSongResponse>(request.idempotencyKey);
    if (replayed) return replayed;
    const verdict = checkSongName(request.name);
    if (verdict === 'blocked') throw new BackendError('content_blocked');
    if (
      verdict !== 'ok' ||
      !(OCCASIONS as readonly string[]).includes(request.occasion) ||
      !(GENRES as readonly string[]).includes(request.genre)
    ) {
      throw new BackendError('invalid_input');
    }
    if (!this.state.pro.active) throw new BackendError('pro_required');
    this.charge(STEP_COSTS.personalSong);
    this.commit();
    await this.wait(3200);

    const base = SONGS.find((s) => s.genre === request.genre) ?? SONGS[0];
    const songId = base?.id ?? 'main-character';
    const storagePath = `songs/${this.state.uid}/${uuid()}.wav`;
    this.state.files[storagePath] = { kind: 'song', songId };
    const response: ComposeSongResponse = {
      storagePath,
      audioUrl: `belto-asset://song/${songId}`,
      seconds: base?.seconds ?? 12,
      lyrics: personalLyrics(request.occasion, request.name, seedFrom(request.idempotencyKey)),
      balance: this.state.wallet.balance,
    };
    this.remember(request.idempotencyKey, response);
    this.commit();
    return response;
  }

  private async createRender(request: CreateRenderRequest): Promise<CreateRenderResponse> {
    this.requireConsent();
    if (!isIdempotencyKey(request.idempotencyKey)) throw new BackendError('invalid_input');
    const replayed = this.replay<CreateRenderResponse>(request.idempotencyKey);
    if (replayed) return replayed;

    const uid = this.state.uid;
    const image = this.state.files[request.imagePath];
    if (!image || !isOwnedPath(request.imagePath, uid) || !(RESOLUTIONS as readonly string[]).includes(request.resolution)) {
      throw new BackendError('invalid_input');
    }

    let sound: MockFileRef;
    let seconds: number;
    let captions: string[] = [];
    let songId: string | null = null;
    let soundPath: string | null = null;
    if (request.sound.kind === 'song') {
      const song = findSong(request.sound.songId);
      if (!song) throw new BackendError('invalid_input');
      sound = { kind: 'song', songId: song.id };
      seconds = song.seconds;
      captions = [...song.lyrics];
      songId = song.id;
    } else {
      const file = this.state.files[request.sound.storagePath];
      if (!file || !isOwnedPath(request.sound.storagePath, uid)) throw new BackendError('invalid_input');
      sound = file;
      seconds = clampSeconds(request.sound.seconds);
      soundPath = request.sound.storagePath;
      if (request.sound.kind !== 'recording' && request.captions && checkCaptions(request.captions)) {
        captions = request.captions;
      }
    }

    const active = this.state.renders.filter((r) => !isTerminal(r.status)).length;
    if (active >= 3) throw new BackendError('rate_limited');

    let resolution = request.resolution;
    let billedResolution: Resolution = request.resolution;
    let reserved = 0;
    let watermarked = false;
    if (request.purpose === 'preview') {
      if (this.state.wallet.previewUsed) throw new BackendError('already_claimed');
      resolution = PREVIEW.resolution;
      billedResolution = PREVIEW.resolution;
      seconds = Math.min(seconds, PREVIEW.seconds);
      watermarked = true;
      this.state.wallet = { ...this.state.wallet, previewUsed: true, updatedAt: now() };
    } else {
      const useBoost =
        request.useHdBoostToken === true && resolution === '768p' && this.state.wallet.hdBoostTokens > 0;
      if (RESOLUTION_INFO[resolution].proOnly && !this.state.pro.active) throw new BackendError('pro_required');
      billedResolution = useBoost ? '768p' : resolution;
      reserved = renderCost(billedResolution, MAX_PERFORMANCE_SECONDS);
      this.charge(reserved);
      if (useBoost) {
        resolution = '1080p';
        this.state.wallet = {
          ...this.state.wallet,
          hdBoostTokens: this.state.wallet.hdBoostTokens - 1,
          updatedAt: now(),
        };
      }
      watermarked = !this.state.pro.active;
    }

    const renderId = uuid();
    const doc: RenderDoc = {
      id: renderId,
      status: 'queued',
      purpose: request.purpose,
      resolution,
      lookId: request.lookId,
      soundKind: request.sound.kind,
      songId,
      progress: 0,
      reservedCredits: reserved,
      chargedCredits: 0,
      seconds: null,
      imagePath: request.imagePath,
      soundPath,
      captions,
      videoPath: null,
      watermarked,
      errorCode: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.state.renders.push(doc);
    this.state.performances[renderId] = {
      imagePath: request.imagePath,
      lookId: request.lookId,
      sound,
      captions,
      songId,
      billedResolution,
    };
    const response: CreateRenderResponse = { renderId, reservedCredits: reserved, balance: this.state.wallet.balance };
    this.remember(request.idempotencyKey, response);
    this.commit();

    const shouldFail = this.flags.failNextRender;
    this.flags.failNextRender = false;
    this.scheduleRender(renderId, seconds, shouldFail, request.purpose === 'preview' ? 0.6 : 1);
    await this.wait(400);
    return response;
  }

  private updateRender(renderId: string, patch: Partial<RenderDoc>): RenderDoc | null {
    const index = this.state.renders.findIndex((r) => r.id === renderId);
    const current = this.state.renders[index];
    if (index < 0 || !current) return null;
    const next = { ...current, ...patch, updatedAt: now() };
    this.state.renders[index] = next;
    return next;
  }

  private scheduleRender(renderId: string, seconds: number, fail: boolean, speed: number): void {
    const step = (at: number, fn: () => void) => {
      const timer = setTimeout(() => {
        this.timers.delete(`${renderId}:${at}`);
        fn();
      }, at * speed * this.flags.latency);
      this.timers.set(`${renderId}:${at}`, timer);
    };

    step(900, () => {
      this.updateRender(renderId, { status: 'processing', progress: 0.08 });
      this.commit();
    });
    const ticks = 9;
    for (let i = 1; i <= ticks; i += 1) {
      step(900 + i * 850, () => {
        const render = this.state.renders.find((r) => r.id === renderId);
        if (!render || render.status !== 'processing') return;
        if (fail && i === Math.ceil(ticks / 2)) {
          this.state.wallet = {
            ...this.state.wallet,
            balance: this.state.wallet.balance + render.reservedCredits,
            updatedAt: now(),
          };
          this.updateRender(renderId, { status: 'failed', errorCode: 'provider_failed', progress: render.progress });
          this.commit();
          return;
        }
        this.updateRender(renderId, { progress: Math.min(0.92, 0.08 + (i / ticks) * 0.84) });
        this.commit();
      });
    }
    step(900 + (ticks + 1) * 850, () => {
      const render = this.state.renders.find((r) => r.id === renderId);
      if (!render || render.status !== 'processing') return;
      this.updateRender(renderId, { status: 'finalizing', progress: 0.96 });
      this.commit();
    });
    step(900 + (ticks + 2) * 850 + 700, () => {
      const render = this.state.renders.find((r) => r.id === renderId);
      if (!render || render.status !== 'finalizing') return;
      const actual = clampSeconds(seconds);
      const billed = this.state.performances[renderId]?.billedResolution ?? render.resolution;
      const charged = render.purpose === 'preview' ? 0 : renderCost(billed, actual);
      const refund = Math.max(0, render.reservedCredits - charged);
      this.state.wallet = { ...this.state.wallet, balance: this.state.wallet.balance + refund, updatedAt: now() };
      this.updateRender(renderId, {
        status: 'succeeded',
        progress: 1,
        seconds: actual,
        chargedCredits: charged,
        videoPath: `mock://render/${renderId}`,
      });
      this.commit();
    });
  }

  private resumeRenders(): void {
    let changed = false;
    for (const render of this.state.renders) {
      if (isTerminal(render.status)) continue;
      // An app restart interrupted the simulation: finish it honestly as a failure + refund.
      this.state.wallet = {
        ...this.state.wallet,
        balance: this.state.wallet.balance + render.reservedCredits,
        updatedAt: now(),
      };
      render.status = 'failed';
      render.errorCode = 'timeout';
      render.updatedAt = now();
      changed = true;
    }
    if (changed) this.commit();
  }

  private async cancelRender(request: CancelRenderRequest): Promise<{ canceled: boolean }> {
    await this.wait(300);
    const render = this.state.renders.find((r) => r.id === request.renderId);
    if (!render) throw new BackendError('not_found');
    if (render.status !== 'queued' && render.status !== 'processing') return { canceled: false };
    this.timers.forEach((timer, key) => {
      if (key.startsWith(`${render.id}:`)) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
    });
    this.state.wallet = {
      ...this.state.wallet,
      balance: this.state.wallet.balance + render.reservedCredits,
      updatedAt: now(),
    };
    this.updateRender(render.id, { status: 'canceled' });
    this.commit();
    return { canceled: true };
  }

  private async spinGiftWheel(): Promise<SpinGiftWheelResponse> {
    await this.wait(700);
    if (this.state.gift) throw new BackendError('already_claimed');
    const prizeId = drawPrize(secureRandom);
    const segmentIndex = segmentForPrize(prizeId, secureRandom);
    const spunAt = now();
    const expiresAt = prizeExpiry(new Date(spunAt)).getTime();
    const prize = PRIZES[prizeId];
    let grantedCredits = 0;
    if (prize.kind === 'credits' && prize.credits) {
      grantedCredits = prize.credits;
      this.addCredits(prize.credits);
    }
    if (prize.kind === 'token' && prize.token === 'freePoster') {
      this.state.wallet = { ...this.state.wallet, freePosterTokens: this.state.wallet.freePosterTokens + 1 };
    }
    if (prize.kind === 'token' && prize.token === 'hdBoost') {
      this.state.wallet = { ...this.state.wallet, hdBoostTokens: this.state.wallet.hdBoostTokens + 1 };
    }
    this.state.gift = {
      prizeId,
      segmentIndex,
      spunAt,
      expiresAt,
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

  private async deleteRender(renderId: unknown): Promise<{ deleted: true }> {
    await this.wait(300);
    const render = this.state.renders.find((r) => r.id === renderId);
    if (!render) throw new BackendError('not_found');
    if (!isTerminal(render.status)) throw new BackendError('invalid_input');
    this.state.renders = this.state.renders.filter((r) => r.id !== render.id);
    delete this.state.performances[render.id];
    this.commit();
    return { deleted: true };
  }

  markGiftRedeemed(): void {
    if (this.state.gift && this.state.gift.redeemedAt === null) {
      this.state.gift = { ...this.state.gift, redeemedAt: now() };
      this.persist();
    }
  }
}

function isTerminal(status: RenderDoc['status']): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

export const mockServer = new MockServer();
