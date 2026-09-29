/**
 * Guide geometry for the capture screen. One source of truth for what the on-screen guide
 * (oval + thirds) looks like AND for the `regionHint` polygon sent with a preview photo, so
 * the server mask follows what the user was actually asked to frame.
 *
 * Coordinates are normalized (0..1, origin top-left) in the camera frame. The frame is a
 * fixed 3:4 (width:height) box — the shape of the sensor output — so a point in the guide
 * lands on the same relative spot in the captured photo. Normalized `ry` is relative to the
 * frame height, hence `ry / FRAME_ASPECT` is the radius in "frame widths".
 */
import type { Angle, Goal, RegionHint } from '@shared/catalog';

/** width / height of the capture frame. */
export const FRAME_ASPECT = 3 / 4;

export interface GuideOval {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Face oval (front/left/right) or the round scalp guide (top/crown). */
export function guideOval(angle: Angle): GuideOval {
  if (angle === 'top' || angle === 'crown') {
    // Round on screen: ry is rx scaled by the 3:4 aspect.
    return { cx: 0.5, cy: 0.5, rx: 0.36, ry: 0.36 * FRAME_ASPECT };
  }
  // A face is about 1.3x taller than wide.
  return { cx: 0.5, cy: 0.44, rx: 0.31, ry: 0.31 * 1.3 * FRAME_ASPECT };
}

/** The guide's brow line: 20% of the half-height above the oval's center. */
export function browLineY(oval: GuideOval): number {
  return oval.cy - 0.2 * oval.ry;
}

/** The guide's mouth line: 35% of the half-height below the oval's center. */
export function mouthLineY(oval: GuideOval): number {
  return oval.cy + 0.35 * oval.ry;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round = (value: number): number => Math.round(clamp01(value) * 1e4) / 1e4;

/** Points along an ellipse (scaled by `scale`) between two parameter angles, in radians. */
function arc(oval: GuideOval, scale: number, from: number, to: number, steps: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    points.push({
      x: round(oval.cx + scale * oval.rx * Math.cos(t)),
      y: round(oval.cy - scale * oval.ry * Math.sin(t)),
    });
  }
  return points;
}

/** Hair volume sits above the skull: the cap is drawn a little larger than the oval. */
const HAIR_SCALE = 1.15;

/**
 * Normalized polygon of the area an edit may change, derived from the guide:
 *  - top / crown: the scalp disc;
 *  - front and side angles, hairline/part: the cap above the brow line (forehead + hair);
 *  - brows: a band around the brow line; beard: the cap below the mouth line.
 * It is a hint for masking, not a detection: it assumes the user framed inside the guide.
 */
export function regionHintFor(angle: Angle, goal?: Goal): RegionHint {
  const oval = guideOval(angle);

  if (angle === 'top' || angle === 'crown') {
    return { points: arc(oval, 1, 0, Math.PI * 2, 12).slice(0, 12) };
  }

  if (goal === 'brows') {
    const brow = browLineY(oval);
    const halfWidth = oval.rx * 0.95;
    const top = brow - oval.ry * 0.18;
    const bottom = brow + oval.ry * 0.14;
    return {
      points: [
        { x: round(oval.cx - halfWidth), y: round(top) },
        { x: round(oval.cx + halfWidth), y: round(top) },
        { x: round(oval.cx + halfWidth), y: round(bottom) },
        { x: round(oval.cx - halfWidth), y: round(bottom) },
      ],
    };
  }

  if (goal === 'beard') {
    const mouth = mouthLineY(oval);
    const scale = 1.05;
    const t0 = Math.asin(Math.min(1, (mouth - oval.cy) / (scale * oval.ry)));
    // Lower cap: parameter runs from just below the mouth line around the chin.
    return { points: arc(oval, scale, -t0, -(Math.PI - t0), 8) };
  }

  const brow = browLineY(oval);
  const t0 = Math.asin((oval.cy - brow) / (HAIR_SCALE * oval.ry));
  return { points: arc(oval, HAIR_SCALE, t0, Math.PI - t0, 8) };
}

/** Largest 3:4 box that fits the available space. */
export function fitFrame(availableWidth: number, availableHeight: number): { width: number; height: number } {
  const w = Math.max(0, availableWidth);
  const h = Math.max(0, availableHeight);
  if (w === 0 || h === 0) return { width: 0, height: 0 };
  if (w / FRAME_ASPECT <= h) return { width: w, height: w / FRAME_ASPECT };
  return { width: h * FRAME_ASPECT, height: h };
}
