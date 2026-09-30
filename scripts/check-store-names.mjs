#!/usr/bin/env node
// Validates metadata/store-names.json against App Store limits (name/subtitle ≤ 30, keywords ≤ 100).
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../metadata/store-names.json', import.meta.url), 'utf8'));
let failed = false;
for (const [locale, entry] of Object.entries(data)) {
  if (locale.startsWith('_')) continue;
  const len = (s) => [...s].length;
  const words = (s) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const problems = [];
  if (!entry.name.startsWith('Kök')) problems.push('name must start with the brand "Kök"');
  if (len(entry.name) > 30) problems.push(`name ${len(entry.name)} > 30`);
  if (len(entry.subtitle) > 30) problems.push(`subtitle ${len(entry.subtitle)} > 30`);
  if (len(entry.keywords) > 100) problems.push(`keywords ${len(entry.keywords)} > 100`);
  if (/\s/.test(entry.keywords.replace(/[^\x00-\x7F]/g, ''))) problems.push('keywords contain spaces');
  const visible = new Set([...words(entry.name), ...words(entry.subtitle)]);
  const dupes = entry.keywords.split(',').filter((k) => visible.has(k.toLowerCase()));
  if (dupes.length) problems.push(`keywords repeat name/subtitle words: ${dupes.join(', ')}`);
  const kw = entry.keywords.split(',');
  if (new Set(kw).size !== kw.length) problems.push('duplicate keywords');
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${locale.padEnd(6)} name=${len(entry.name)} subtitle=${len(entry.subtitle)} keywords=${len(entry.keywords)}${problems.length ? ' → ' + problems.join('; ') : ''}`);
  if (problems.length) failed = true;
}
process.exit(failed ? 1 : 0);
