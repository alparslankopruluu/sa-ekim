import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays, dateWindow, SAME_GOAL_WINDOW_DAYS, weekBounds } from '../src/lib/cohort.js';

test('a calendar week runs Monday to Sunday', () => {
  // 2026-09-29 is a Tuesday.
  assert.deepEqual(weekBounds('2026-09-29'), { start: '2026-09-28', end: '2026-10-04' });
  assert.deepEqual(weekBounds('2026-09-28'), { start: '2026-09-28', end: '2026-10-04' }); // Monday itself
  assert.deepEqual(weekBounds('2026-10-04'), { start: '2026-09-28', end: '2026-10-04' }); // Sunday belongs to the same week
  assert.deepEqual(weekBounds('2026-10-05'), { start: '2026-10-05', end: '2026-10-11' }); // next Monday starts a new one
});

test('weeks cross month and year boundaries', () => {
  assert.deepEqual(weekBounds('2026-12-31'), { start: '2026-12-28', end: '2027-01-03' });
  assert.deepEqual(weekBounds('2024-03-01'), { start: '2024-02-26', end: '2024-03-03' }); // leap year
});

test('two dates share a week exactly when their bounds are equal', () => {
  assert.equal(weekBounds('2026-09-30').start, weekBounds('2026-10-02').start);
  assert.notEqual(weekBounds('2026-10-04').start, weekBounds('2026-10-05').start);
});

test('the same-goal window is plus/minus 14 days, inclusive', () => {
  assert.equal(SAME_GOAL_WINDOW_DAYS, 14);
  assert.deepEqual(dateWindow('2026-09-29', SAME_GOAL_WINDOW_DAYS), { start: '2026-09-15', end: '2026-10-13' });
  assert.deepEqual(dateWindow('2026-01-05', 14), { start: '2025-12-22', end: '2026-01-19' });
});

test('ISO strings order like dates, which is what the Firestore range query relies on', () => {
  const dates = ['2026-10-04', '2025-12-31', '2026-02-01', '2026-09-28'];
  assert.deepEqual([...dates].sort(), ['2025-12-31', '2026-02-01', '2026-09-28', '2026-10-04']);
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.throws(() => weekBounds('2026-13-01'));
});
