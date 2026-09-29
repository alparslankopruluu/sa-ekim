/**
 * Capture gate — pure math for the "hold the phone upright" rule (spec §4).
 *
 * It only reads the accelerometer's gravity vector. It never claims to detect a face, the
 * lighting or the framing: it answers one deterministic question — is the phone within the
 * tolerance of the pose this angle asks for?
 *
 *  - front / left / right: phone held upright (portrait), within ±7° on both axes.
 *  - top / crown: phone held flat with the screen up (back camera looks down at the head),
 *    within ±10° on both axes.
 *
 * Convention (after `normalizeGravity`, the iOS/CoreMotion one, in g): upright portrait is
 * y = -1, screen-up flat is z = -1, and a phone lying on its right edge has x = +1.
 * `pitch` > 0 means the top edge is raised (screen tilting up/back) and `roll` > 0 means the
 * right edge is lower.
 */
import { type Angle } from '@shared/catalog';

export interface Gravity {
  x: number;
  y: number;
  z: number;
}

export type GateMode = 'upright' | 'flat';

export const UPRIGHT_TOLERANCE_DEG = 7;
export const FLAT_TOLERANCE_DEG = 10;
/** Extra degrees an open gate tolerates before it closes again (stops flicker at the edge). */
export const HYSTERESIS_DEG = 2;
/** Low-pass factor for incoming samples (higher = more responsive, lower = steadier). */
export const SMOOTHING_ALPHA = 0.25;
/** The bubble reaches the edge of the level indicator at this multiple of the tolerance. */
const FULL_SCALE_TOLERANCES = 3;

const RAD_TO_DEG = 180 / Math.PI;

export function gateModeFor(angle: Angle): GateMode {
  return angle === 'top' || angle === 'crown' ? 'flat' : 'upright';
}

export function toleranceFor(angle: Angle): number {
  return gateModeFor(angle) === 'flat' ? FLAT_TOLERANCE_DEG : UPRIGHT_TOLERANCE_DEG;
}

/**
 * Which camera an angle uses. Face angles use the front camera so the user can see the
 * frame; top/crown are shot with the back camera held flat above the head (or by a helper),
 * because a front camera facing down cannot be watched.
 */
export function cameraFacingFor(angle: Angle): 'front' | 'back' {
  return gateModeFor(angle) === 'flat' ? 'back' : 'front';
}

/**
 * expo-sensors reports iOS readings as CoreMotion does and Android readings with the
 * opposite sign (reaction force). Flip Android so the rest of the code sees one convention.
 */
export function normalizeGravity(raw: Gravity, platform: string): Gravity {
  if (platform === 'android') return { x: -raw.x, y: -raw.y, z: -raw.z };
  return { x: raw.x, y: raw.y, z: raw.z };
}

/** A resting phone measures about 1 g. Zero (no sensor) or a hard shake is not a usable pose. */
export function isPlausibleReading(g: Gravity): boolean {
  if (![g.x, g.y, g.z].every(Number.isFinite)) return false;
  const magnitude = Math.hypot(g.x, g.y, g.z);
  return magnitude >= 0.7 && magnitude <= 1.3;
}

/** Exponential smoothing. The first sample passes through unchanged. */
export function smoothGravity(prev: Gravity | null, next: Gravity, alpha: number = SMOOTHING_ALPHA): Gravity {
  if (!prev) return { ...next };
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
    z: prev.z + (next.z - prev.z) * alpha,
  };
}

export interface Tilt {
  /** Degrees; > 0 = top edge raised. */
  pitch: number;
  /** Degrees; > 0 = right edge lower. */
  roll: number;
}

/**
 * Tilt away from the pose the angle asks for. `atan2` keeps the wrong hemisphere (upside
 * down, screen facing down) far outside any tolerance.
 */
export function tiltFor(angle: Angle, g: Gravity): Tilt {
  if (gateModeFor(angle) === 'flat') {
    return { pitch: Math.atan2(-g.y, -g.z) * RAD_TO_DEG, roll: Math.atan2(g.x, -g.z) * RAD_TO_DEG };
  }
  return { pitch: Math.atan2(-g.z, -g.y) * RAD_TO_DEG, roll: Math.atan2(g.x, -g.y) * RAD_TO_DEG };
}

function offDegrees(angle: Angle, g: Gravity): number {
  const { pitch, roll } = tiltFor(angle, g);
  return Math.max(Math.abs(pitch), Math.abs(roll));
}

/** `true` when the phone is within the tolerance for `angle` on both axes. */
export function isUpright(angle: Angle, g: Gravity): boolean {
  return offDegrees(angle, g) <= toleranceFor(angle);
}

/**
 * Gate state with hysteresis: it opens inside the tolerance and only closes once the phone
 * leaves the tolerance plus `HYSTERESIS_DEG`, so a hand wobbling on the edge does not flip it.
 */
export function nextGateState(prevOk: boolean, angle: Angle, g: Gravity): boolean {
  const off = offDegrees(angle, g);
  const tolerance = toleranceFor(angle);
  return prevOk ? off <= tolerance + HYSTERESIS_DEG : off <= tolerance;
}

export interface LevelIndicator {
  /** Bubble offset, -1..1 (left..right), to the high side like a spirit level. */
  x: number;
  /** Bubble offset, -1..1 (top..bottom). */
  y: number;
  /** Worst-axis tilt in degrees (for the readout and analytics-free debugging). */
  offDeg: number;
}

const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

export function levelIndicator(angle: Angle, g: Gravity): LevelIndicator {
  const { pitch, roll } = tiltFor(angle, g);
  const full = toleranceFor(angle) * FULL_SCALE_TOLERANCES;
  return {
    x: clampUnit(-roll / full) + 0,
    y: clampUnit(-pitch / full) + 0,
    offDeg: Math.max(Math.abs(pitch), Math.abs(roll)),
  };
}
