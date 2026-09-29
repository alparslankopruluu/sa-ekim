#!/usr/bin/env node
/**
 * Translation parity check.
 * - Layout: src/translations/<locale>/<namespace>.json (a file's name is its top-level key);
 *   src/translations/native/<locale>.json holds iOS InfoPlist / Android strings.
 * - Every locale in src/translations/locales.json has exactly the namespaces and keys of `en` (plural suffixes normalized:
 *   a base with `_one/_other` in English may use any CLDR categories elsewhere,
 *   but must include `_other`).
 * - Every `{{placeholder}}` in English appears in the translation.
 * - No empty strings.
 * Same checks for src/translations/native/*.json (InfoPlist / Android strings).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'translations');
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, path, out);
    else out.set(path, value);
  }
  return out;
}

function group(flat) {
  const groups = new Map();
  for (const [key, value] of flat) {
    const base = key.replace(PLURAL, '');
    const suffix = key === base ? null : key.slice(base.length + 1);
    if (!groups.has(base)) groups.set(base, { plural: false, values: [], suffixes: new Set() });
    const g = groups.get(base);
    if (suffix) {
      g.plural = true;
      g.suffixes.add(suffix);
    }
    g.values.push(value);
  }
  return groups;
}

const placeholders = (s) => new Set(String(s).match(/{{\s*[\w.]+\s*}}/g)?.map((p) => p.replace(/\s/g, '')) ?? []);

const locales = JSON.parse(readFileSync(join(root, 'locales.json'), 'utf8'));
const strict = !process.argv.includes('--allow-missing');

/** Loads a locale directory into one object keyed by namespace. */
function loadLocale(locale) {
  const dir = join(root, locale);
  const out = {};
  if (!existsSync(dir)) return null;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    out[file.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  }
  return out;
}

function compare(label, enFlat, data, errors) {
  const other = group(flatten(data));
  for (const [base, g] of enFlat) {
    const t = other.get(base);
    if (!t) {
      errors.push(`${label}: missing ${base}`);
      continue;
    }
    if (g.plural && !t.suffixes.has('other')) errors.push(`${label}: ${base} needs an _other plural form`);
    const want = new Set(g.values.flatMap((v) => [...placeholders(v)]));
    for (const value of t.values) {
      if (typeof value !== 'string' || value.trim() === '') errors.push(`${label}: empty value at ${base}`);
    }
    const have = new Set(t.values.flatMap((v) => [...placeholders(v)]));
    for (const p of want) {
      if (!have.has(p)) errors.push(`${label}: ${base} lost placeholder ${p}`);
    }
  }
  for (const base of other.keys()) {
    if (!enFlat.has(base)) errors.push(`${label}: unknown key ${base}`);
  }
}

const errors = [];
const en = loadLocale('en');
if (!en) {
  errors.push('en: missing directory src/translations/en');
} else {
  const enFlat = group(flatten(en));
  let checked = 0;
  for (const locale of locales.filter((l) => l !== 'en')) {
    let data;
    try {
      data = loadLocale(locale);
    } catch (error) {
      errors.push(`${locale}: invalid JSON (${error.message})`);
      continue;
    }
    if (!data) {
      if (strict) errors.push(`${locale}: missing directory`);
      continue;
    }
    checked += 1;
    compare(locale, enFlat, data, errors);
  }
  // Native strings (InfoPlist / Android): flat files native/<locale>.json, `en` is the schema.
  const nativeDir = join(root, 'native');
  if (existsSync(join(nativeDir, 'en.json'))) {
    const nativeEn = group(flatten(JSON.parse(readFileSync(join(nativeDir, 'en.json'), 'utf8'))));
    for (const locale of locales.filter((l) => l !== 'en')) {
      const file = join(nativeDir, `${locale}.json`);
      if (!existsSync(file)) {
        if (strict) errors.push(`native/${locale}.json: missing`);
        continue;
      }
      compare(`native/${locale}`, nativeEn, JSON.parse(readFileSync(file, 'utf8')), errors);
    }
  }
  if (!errors.length) process.stdout.write(`ok ${checked + 1} locales in src/translations${strict ? '' : ' (partial allowed)'}\n`);
}

if (errors.length) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exit(1);
}
