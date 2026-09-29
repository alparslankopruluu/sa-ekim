import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AREA_BY_GOAL,
  buildEditPrompt,
  DENSITY_INTENSITY,
  IDENTITY_GUARD,
  NEUTRALITY_LINE,
  PROMPT_VERSION,
  scopeLine,
  styleBlock,
  VISIBLE_RESULT_CLAUSE,
} from '../src/lib/prompts.js';
import { GOALS, STYLES } from '../src/shared/catalog.js';

/** Words that would describe surgery, a diagnosis, a staging scale or an outcome promise. */
const FORBIDDEN = [
  /surg/i,
  /transplant/i,
  /graft/i,
  /follic/i,
  /operat/i,
  /procedure/i,
  /clinic/i,
  /patient/i,
  /diagnos/i,
  /medical/i,
  /norwood/i,
  /ludwig/i,
  /\bbald/i,
  /alopecia/i,
  /guarantee/i,
  /promise/i,
  /will look/i,
  /your (future|result)/i,
  /permanent/i,
  /cure/i,
  /treat/i,
];

function allPrompts(): string[] {
  const out: string[] = [];
  for (const style of STYLES) {
    for (const density of style.densities) out.push(buildEditPrompt({ goal: style.goal, styleId: style.id, density }));
  }
  return out;
}

test('every style has a PRIMARY CHANGE / PRESERVE / AVOID block, in that order', () => {
  for (const style of STYLES) {
    const block = styleBlock(style.id);
    const primary = block.indexOf('PRIMARY CHANGE:');
    const preserve = block.indexOf(' PRESERVE:');
    const avoid = block.indexOf(' AVOID:');
    assert.ok(primary === 0 && preserve > primary && avoid > preserve, style.id);
  }
});

test('the identity guard stays short (Simetra evidence: long guards suppress the edit)', () => {
  assert.ok(IDENTITY_GUARD.length <= 400, `guard is ${IDENTITY_GUARD.length} chars`);
  assert.match(IDENTITY_GUARD, /same person/);
  // The hair-colour-preservation rule lives in the guard.
  assert.match(IDENTITY_GUARD, /hair colour/);
  assert.match(IDENTITY_GUARD, /do not recolour/);
});

test('a prompt stays compact: no prompt exceeds 1,400 characters', () => {
  for (const prompt of allPrompts()) assert.ok(prompt.length <= 1400, `${prompt.length} chars`);
});

test('every prompt carries the scope line, visible-result clause, intensity line, guard and neutrality line', () => {
  for (const style of STYLES) {
    for (const density of style.densities) {
      const prompt = buildEditPrompt({ goal: style.goal, styleId: style.id, density });
      assert.ok(prompt.startsWith(styleBlock(style.id)));
      assert.ok(prompt.includes(scopeLine(style.goal)));
      assert.ok(prompt.includes(VISIBLE_RESULT_CLAUSE));
      assert.ok(prompt.includes(DENSITY_INTENSITY[density]));
      assert.ok(prompt.includes(IDENTITY_GUARD));
      assert.ok(prompt.endsWith(NEUTRALITY_LINE));
    }
  }
});

test('the scope line names the region of the goal', () => {
  assert.deepEqual(AREA_BY_GOAL, { hairline: 'hairline', crown: 'crown', part: 'parting', brows: 'eyebrows', beard: 'beard' });
  for (const goal of GOALS) assert.equal(scopeLine(goal), `Edit only the ${AREA_BY_GOAL[goal]} area.`);
  const brows = buildEditPrompt({ goal: 'brows', styleId: 'brows_natural', density: 'natural' });
  assert.match(brows, /Edit only the eyebrows area\./);
});

test('intensity lines are restrained deltas and differ per density', () => {
  const lines = Object.values(DENSITY_INTENSITY);
  assert.equal(new Set(lines).size, 3);
  for (const line of lines) assert.match(line, /^INTENSITY: /);
  assert.match(DENSITY_INTENSITY.natural, /small, restrained delta/);
  assert.match(DENSITY_INTENSITY.fuller, /clear but restrained delta/);
  assert.match(DENSITY_INTENSITY.full, /pronounced but plausible/);
});

test('no prompt mentions surgery, procedures, grafts, staging scales, diagnosis or outcome promises', () => {
  for (const prompt of allPrompts()) {
    for (const pattern of FORBIDDEN) assert.doesNotMatch(prompt, pattern, `${pattern} in: ${prompt}`);
  }
});

test('the neutrality line frames the image as an illustration, not a prediction', () => {
  assert.match(NEUTRALITY_LINE, /not a prediction or an assessment/);
  assert.match(NEUTRALITY_LINE, /no labels, text or collage/);
});

test('style blocks are all distinct, so variants differ', () => {
  assert.equal(new Set(STYLES.map((s) => styleBlock(s.id))).size, STYLES.length);
});

test('a style outside its goal or an unsupported density is rejected', () => {
  assert.throws(() => buildEditPrompt({ goal: 'crown', styleId: 'hairline_soft', density: 'natural' }));
  assert.throws(() => buildEditPrompt({ goal: 'hairline', styleId: 'hairline_soft', density: 'full' }));
});

test('the prompt version is stamped for later comparison', () => {
  assert.match(PROMPT_VERSION, /^kok-\d+\.\d+\.\d+$/);
});
