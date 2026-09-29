/**
 * Product catalog shared by the app (UI) and Functions (authority): what the user is
 * tracking (goal), how far along they are (stage), and the preview styles. Prompt text
 * for previews lives ONLY on the server (functions/src/lib/prompts.ts); the app knows ids.
 */

export const GOALS = ['hairline', 'crown', 'part', 'brows', 'beard'] as const;
export type Goal = (typeof GOALS)[number];

export function isGoal(value: unknown): value is Goal {
  return typeof value === 'string' && (GOALS as readonly string[]).includes(value);
}

/** Where the user is in the process; drives onboarding copy and which screens lead. */
export const STAGES = ['researching', 'planned', 'done'] as const;
export type Stage = (typeof STAGES)[number];

/** A hair transplant (any goal) or a PRP / mesotherapy course (session log, no procedure date). */
export const JOURNEY_KINDS = ['transplant', 'prp'] as const;
export type JourneyKind = (typeof JOURNEY_KINDS)[number];

/** Camera angles the capture screen can ask for. */
export const ANGLES = ['front', 'left', 'right', 'top', 'crown'] as const;
export type Angle = (typeof ANGLES)[number];

/** Which angles each goal asks for, in capture order. The first one is the primary angle. */
export const ANGLES_BY_GOAL: Record<Goal, readonly Angle[]> = {
  hairline: ['front', 'top', 'left', 'right'],
  crown: ['crown', 'top', 'front'],
  part: ['top', 'front'],
  brows: ['front'],
  beard: ['front', 'left', 'right'],
};

/** Months until the result is judged final: brows/hairline/beard 12, crown/part up to 18. */
export function maturationMonthsFor(goal: Goal): 12 | 18 {
  return goal === 'crown' || goal === 'part' ? 18 : 12;
}

/** Preview strength. Server prompts map each to a restrained, plausible delta. */
export const DENSITIES = ['natural', 'fuller', 'full'] as const;
export type Density = (typeof DENSITIES)[number];

export const QUALITY_TIERS = ['standard', 'high'] as const;
export type Quality = (typeof QUALITY_TIERS)[number];

export const STYLE_IDS = [
  // hairline
  'hairline_soft',
  'hairline_temples',
  'hairline_lower',
  'hairline_density',
  // crown
  'crown_light',
  'crown_medium',
  'crown_full',
  // part
  'part_light',
  'part_medium',
  'part_full',
  // brows
  'brows_natural',
  'brows_fuller',
  'brows_arched',
  // beard
  'beard_patch',
  'beard_full',
  'beard_moustache',
] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export interface StyleDef {
  id: StyleId;
  goal: Goal;
  /** Photo angle the style is meant for; the picker shows a non-blocking hint. */
  bestAngle: Angle;
  /** Palette key from theme/tokens `palettes` for the style card. */
  palette: 'copper' | 'sage' | 'gold' | 'rose' | 'ink';
  /** The style card is disabled for a density it cannot show honestly. */
  densities: readonly Density[];
}

export const STYLES: readonly StyleDef[] = [
  { id: 'hairline_soft', goal: 'hairline', bestAngle: 'front', palette: 'copper', densities: ['natural', 'fuller'] },
  { id: 'hairline_temples', goal: 'hairline', bestAngle: 'front', palette: 'gold', densities: ['natural', 'fuller'] },
  { id: 'hairline_lower', goal: 'hairline', bestAngle: 'front', palette: 'rose', densities: ['natural'] },
  { id: 'hairline_density', goal: 'hairline', bestAngle: 'front', palette: 'sage', densities: ['natural', 'fuller', 'full'] },
  { id: 'crown_light', goal: 'crown', bestAngle: 'crown', palette: 'sage', densities: ['natural'] },
  { id: 'crown_medium', goal: 'crown', bestAngle: 'crown', palette: 'copper', densities: ['fuller'] },
  { id: 'crown_full', goal: 'crown', bestAngle: 'crown', palette: 'gold', densities: ['full'] },
  { id: 'part_light', goal: 'part', bestAngle: 'top', palette: 'sage', densities: ['natural'] },
  { id: 'part_medium', goal: 'part', bestAngle: 'top', palette: 'copper', densities: ['fuller'] },
  { id: 'part_full', goal: 'part', bestAngle: 'top', palette: 'gold', densities: ['full'] },
  { id: 'brows_natural', goal: 'brows', bestAngle: 'front', palette: 'ink', densities: ['natural'] },
  { id: 'brows_fuller', goal: 'brows', bestAngle: 'front', palette: 'copper', densities: ['fuller'] },
  { id: 'brows_arched', goal: 'brows', bestAngle: 'front', palette: 'rose', densities: ['natural', 'fuller'] },
  { id: 'beard_patch', goal: 'beard', bestAngle: 'front', palette: 'sage', densities: ['natural', 'fuller'] },
  { id: 'beard_full', goal: 'beard', bestAngle: 'front', palette: 'copper', densities: ['fuller', 'full'] },
  { id: 'beard_moustache', goal: 'beard', bestAngle: 'front', palette: 'ink', densities: ['natural', 'fuller'] },
];

export function stylesForGoal(goal: Goal): StyleDef[] {
  return STYLES.filter((s) => s.goal === goal);
}

export function getStyle(id: string): StyleDef | undefined {
  return STYLES.find((s) => s.id === id);
}

export function isStyleId(value: unknown): value is StyleId {
  return typeof value === 'string' && (STYLE_IDS as readonly string[]).includes(value);
}

export function isDensity(value: unknown): value is Density {
  return typeof value === 'string' && (DENSITIES as readonly string[]).includes(value);
}

export function isQuality(value: unknown): value is Quality {
  return typeof value === 'string' && (QUALITY_TIERS as readonly string[]).includes(value);
}

/**
 * Normalized (0..1, origin top-left) polygon the app derives from the capture guide so the
 * server can mask the edit. Optional: a photo from the gallery has no guide.
 */
export interface RegionHint {
  points: { x: number; y: number }[];
}

export const REGION_HINT_MIN_POINTS = 3;
export const REGION_HINT_MAX_POINTS = 32;

export function isValidRegionHint(hint: unknown): hint is RegionHint {
  if (!hint || typeof hint !== 'object') return false;
  const points = (hint as { points?: unknown }).points;
  if (!Array.isArray(points)) return false;
  if (points.length < REGION_HINT_MIN_POINTS || points.length > REGION_HINT_MAX_POINTS) return false;
  return points.every((p) => {
    if (!p || typeof p !== 'object') return false;
    const { x, y } = p as { x?: unknown; y?: unknown };
    return typeof x === 'number' && typeof y === 'number' && x >= 0 && x <= 1 && y >= 0 && y <= 1;
  });
}

/** Shed log: hairs counted on a pillow/shower drain on one day. Capped to keep the chart honest. */
export const MAX_SHED_COUNT = 999;
