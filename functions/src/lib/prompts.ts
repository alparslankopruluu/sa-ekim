/**
 * Preview prompts. SERVER-ONLY: the app knows style ids, never the wording (shared/catalog.ts).
 *
 * Shape (from the Simetra evidence, docs/prompt-architecture.md + decisions.md):
 *   PRIMARY CHANGE / PRESERVE / AVOID per style → region scope line → visible-result clause →
 *   restrained intensity line → a SHORT identity guard → a neutrality line.
 *
 * Rules that came out of that evidence and are pinned by tests:
 *  - the identity guard stays short (<= 400 chars): long guards suppressed the edit entirely;
 *  - intensity is an anatomical "delta budget", never a generic "make it more different";
 *  - the hair-colour rule is explicit (models drift toward darker, denser, younger hair);
 *  - the wording never mentions surgery, procedures, grafts, staging scales, diagnosis or medical
 *    judgement, and never promises an outcome — it describes a picture, nothing more.
 */
import { type Density, type Goal, getStyle, type StyleId } from '../shared/catalog.js';

/** Bump when any wording changes; stored on the server-only preview record for later comparison. */
export const PROMPT_VERSION = 'kok-1.0.0';

/** The area word used in the "edit only the … area" line. */
export const AREA_BY_GOAL: Record<Goal, string> = {
  hairline: 'hairline',
  crown: 'crown',
  part: 'parting',
  brows: 'eyebrows',
  beard: 'beard',
};

/**
 * Deliberately compact (Simetra: shortening the guard restored a visible edit; length, not order,
 * was the suspect). Includes the hair-colour-preservation rule. Do NOT let this grow past 400 chars.
 */
export const IDENTITY_GUARD =
  'Keep it unmistakably the same person and the same photograph: same face, skin texture, moles, ' +
  'expression, pose, lighting, clothing and background. Do not beautify, retouch, smooth skin or ' +
  'change apparent age. Keep the existing hair colour, texture and growth direction; do not ' +
  'recolour or restyle hair.';

export const VISIBLE_RESULT_CLAUSE =
  'The requested change must be clearly perceptible when toggling before and after at the same ' +
  'scale; do not create visibility through skin, tone, contrast, lighting or unrelated-feature changes.';

/** Neutral framing: an illustration of a picture, not a prediction, assessment or judgement. */
export const NEUTRALITY_LINE =
  'This is a neutral visual illustration, not a prediction or an assessment. Produce one edited ' +
  'photo, with no labels, text or collage.';

export const DENSITY_INTENSITY: Record<Density, string> = {
  natural:
    'INTENSITY: Use a small, restrained delta on the allowed area only. The change should still be ' +
    'clearly perceptible when toggling before and after, while keeping the original character.',
  fuller:
    'INTENSITY: Use a clear but restrained delta with noticeably fuller coverage. Secondary changes ' +
    'are allowed only where needed to blend naturally.',
  full:
    'INTENSITY: Use a pronounced but plausible delta with dense coverage. Never alter skin, lighting ' +
    'or unrelated features to exaggerate the result.',
};

interface StyleBlock {
  primary: string;
  preserve: string;
  avoid: string;
}

const STYLE_BLOCKS: Record<StyleId, StyleBlock> = {
  hairline_soft: {
    primary:
      'Soften the frontal hairline into a gently rounded, natural edge by adding fine, irregular single hairs along it, at its current height.',
    preserve: 'Hairline position, forehead, temples, hair colour, texture and growth direction.',
    avoid: 'A straight, sharp or lowered line, thick clumps, or a hairpiece look.',
  },
  hairline_temples: {
    primary:
      'Fill in the temple corners with fine natural hair so both temples sit in a balanced, softly angled shape.',
    preserve: 'Centre hairline height, forehead, hair colour and texture.',
    avoid: 'Closed-up or unnaturally low temples, perfectly symmetrical corners, visible blocks of hair.',
  },
  hairline_lower: {
    primary:
      'Lower the central hairline slightly with fine, irregular hairs of the same colour, keeping a natural forehead height.',
    preserve: 'Temples, forehead shape, hair colour, texture and growth direction.',
    avoid: 'Lowering it more than a little, a flat straight line, a heavy fringe.',
  },
  hairline_density: {
    primary:
      'Increase the density of the hair in the frontal zone behind the hairline so less scalp shows through it.',
    preserve: 'Hairline position and outline, hair colour, texture, length and parting.',
    avoid: 'Uniform thick coverage, a different hairstyle or length, a changed hairline outline.',
  },
  crown_light: {
    primary: 'Add light, natural coverage over the thin area at the crown so less scalp shows.',
    preserve: 'Hair colour, length, style, parting and the natural swirl direction.',
    avoid: 'Hard edges, patchy clumps, changing any hair outside the crown.',
  },
  crown_medium: {
    primary: 'Add clearly denser, evenly blended coverage across the crown, following the natural swirl.',
    preserve: 'Hair colour, length, style, parting and swirl direction.',
    avoid: 'Visible boundaries between old and new hair, changes outside the crown.',
  },
  crown_full: {
    primary: 'Give the crown full, dense coverage that follows the natural swirl direction.',
    preserve: 'Hair colour, length, style and the surrounding hair exactly as they are.',
    avoid: 'A flat helmet-like or wig-like look, unnaturally thick strands, changes outside the crown.',
  },
  part_light: {
    primary: 'Slightly reduce the scalp visible along the parting by adding fine hairs beside the line.',
    preserve: 'Parting position and direction, hair colour, length and style.',
    avoid: 'Closing the parting completely, hard edges, a different hairstyle.',
  },
  part_medium: {
    primary: 'Make the hair along the parting clearly denser so noticeably less scalp shows through.',
    preserve: 'Parting position and direction, hair colour, length and style.',
    avoid: 'A moved or hidden parting, uniform thickness, visible boundaries.',
  },
  part_full: {
    primary: 'Give the hair along the parting full, dense coverage so the line looks naturally full.',
    preserve: 'Parting position and direction, hair colour, length and style.',
    avoid: 'A heavy or wig-like look, a moved parting, changes to hair away from the parting.',
  },
  brows_natural: {
    primary:
      'Fill the sparse gaps in the eyebrows with fine natural hairs, following the existing brow line and shape.',
    preserve: 'Eye shape, brow position, brow colour and overall brow proportion to the face.',
    avoid: 'Drawn or pencilled brows, a sharp block shape, a changed arch.',
  },
  brows_fuller: {
    primary:
      'Make the eyebrows visibly fuller with dense, natural, individually visible hairs that follow their existing direction.',
    preserve: 'Eye shape, brow position, brow colour and the existing arch.',
    avoid: 'Drawn or pencilled brows, overly thick or dark brows, a changed brow position.',
  },
  brows_arched: {
    primary:
      'Give the eyebrows a soft natural arch by filling the upper and tail area with fine hairs, keeping their current position.',
    preserve: 'Eye shape, brow position, brow colour and thickness.',
    avoid: 'A sharp or surprised arch, drawn brows, changes to the eyes or eyelids.',
  },
  beard_patch: {
    primary:
      'Fill the patchy gaps in the beard on the cheeks and jawline with facial hair of the same colour and direction so coverage looks even.',
    preserve: 'Beard outline and length, hair colour, skin tone and jawline shape.',
    avoid: 'A perfectly uniform painted beard, a changed jawline, a different beard style.',
  },
  beard_full: {
    primary:
      'Give the beard full, dense coverage along the cheeks, jawline and chin, following its existing outline.',
    preserve: 'Beard outline, hair colour, skin tone and jawline shape.',
    avoid: 'A longer or restyled beard, an unnaturally uniform look, changes to the lips or skin.',
  },
  beard_moustache: {
    primary:
      'Fill the moustache area with dense natural hair of the same colour, following its existing shape.',
    preserve: 'Moustache outline, hair colour, lips, skin tone and the rest of the beard.',
    avoid: 'A restyled moustache, a painted look, changes to the lips or teeth.',
  },
};

/** One style's `PRIMARY CHANGE / PRESERVE / AVOID` block. */
export function styleBlock(styleId: StyleId): string {
  const block = STYLE_BLOCKS[styleId];
  return `PRIMARY CHANGE: ${block.primary} PRESERVE: ${block.preserve} AVOID: ${block.avoid}`;
}

/** The "edit only the … area" scope line for a goal. */
export function scopeLine(goal: Goal): string {
  return `Edit only the ${AREA_BY_GOAL[goal]} area.`;
}

/**
 * The exact prompt sent to the provider. The style must belong to the goal and offer the density —
 * the request validator already guarantees it; this throws if a caller bypasses that.
 */
export function buildEditPrompt(input: { goal: Goal; styleId: StyleId; density: Density }): string {
  const style = getStyle(input.styleId);
  if (!style || style.goal !== input.goal || !style.densities.includes(input.density)) {
    throw new Error('prompt: style, goal and density do not match');
  }
  return [
    styleBlock(input.styleId),
    scopeLine(input.goal),
    VISIBLE_RESULT_CLAUSE,
    DENSITY_INTENSITY[input.density],
    IDENTITY_GUARD,
    NEUTRALITY_LINE,
  ].join(' ');
}
