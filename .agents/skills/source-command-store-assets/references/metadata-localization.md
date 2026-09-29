# Market-native store metadata localization

Use this reference only for App Store or Google Play listing copy. UI strings follow
`docs/playbooks/localization.md`; screenshot captions also follow the parent skill's capture
and renderer gates.

## 1. Freeze the truth and locale matrix

Read PRODUCT, shipped features, product map, current release diff/notes, monetization facts,
supported UI locales, and approved positioning. Build a claim ledger: every promised outcome
or feature points to shipped behavior in the exact release build. Mark assumptions and omit
unverified claims.

Resolve locales in this order:

1. explicit `--locales=<csv|project|launch|extended>`;
2. approved blueprint/run locale profile;
3. PRODUCT launch locales and supported listing locales;
4. `docs/locales.json` only to expand a named profile and map platform locale IDs.

Normalize and deduplicate BCP-47/platform IDs. If PRODUCT, UI support, blueprint, and store
targets disagree, show the matrix and stop for a product decision. Do not silently use the
kit's default nine. Completion means every resolved locale has a draft and validation state;
store copy alone does not prove in-app localization.

## 2. Calibrate once, write independently

Default `review=calibrate`:

1. Draft the source storefront (normally en-US) from product truth, not old prose.
2. Show positioning, tone, claim ledger, field counts, and search-term hypotheses for one
   calibration approval.
3. After approval, write every remaining locale independently from the same fact ledger and
   market brief. Never translate locale A into locale B or preserve English syntax.
4. Validate and present one review ledger covering the full matrix. Human spot-checks do not
   authorize upload.

Use `review=sequential` only when requested: prepare one locale, wait, then continue. Use
`review=batch` only when the approved blueprint already fixes positioning, claims, and tone.

For each locale, decide audience, region, formality, common native vocabulary/loanwords,
value emphasis, reading rhythm, and culturally risky phrasing. Natural copy must not claim
the app was locally developed. Avoid stereotypes. Treat keyword/search-volume claims as
hypotheses unless a named ASO data source supports them.

## 3. Rewrite contract

- Preserve brand spelling unless an approved localized brand name exists.
- Lead with the clearest verified outcome and surface valuable features early.
- Use short paragraphs and restrained bullets where the store supports plain text.
- Keep title, subtitle/short description, screenshots, and opening description distinct;
  do not repeat the same message.
- Write for conversion and natural discoverability, never keyword stuffing.
- Do not invent features, proof, awards, rankings, testimonials, prices, discounts,
  competitor relationships, or local origin.
- Keep every locale appropriate for a general audience and consistent with privacy,
  subscription, and support facts.
- Localize meaning, tone, search language, and examples together; never perform word-for-word
  translation or translate an unverified claim.

## 4. Current platform field contracts

Final tool/schema validation is authoritative because store rules can change.

### Apple App Store

| Field | Limit | Contract |
|---|---:|---|
| Name | 2–30 characters | Localized, truthful, no competitor/company names |
| Subtitle | 30 characters | Distinct benefit/search coverage; avoid name repetition |
| Promotional text | 170 characters | Current truthful hook; not a substitute for release notes |
| Description | 4,000 characters | Plain text; conversion-focused, no HTML |
| What's New | 4,000 characters | Exact shipped changes; unavailable for version 1 |
| Keywords | 100 UTF-8 bytes | Comma-separated, no spaces, no app/company names or duplicate coverage |

Count Apple keywords as bytes, not characters. Research terms per storefront; do not
translate the English keyword list. A data-free estimate is labeled `hypothesis`, never
fabricated as volume or difficulty evidence.

### Google Play

| Field | Limit | Contract |
|---|---:|---|
| App name | 30 characters | One localized name per language; accurate and accessible |
| Short description | 80 characters | Biggest distinct benefit; do not repeat it verbatim below |
| Full description | 4,000 characters | Succinct natural copy; no repetitive/irrelevant keyword blocks |
| Release notes | 500 Unicode characters | Actual changes only; not promotional and no action solicitation |

Google Play has no separate keyword field. Integrate market-relevant terms naturally. Avoid
ALL CAPS, emoji/special-character manipulation, price/ranking language, anonymous
testimonials, and misleading comparisons.

## 5. Canonical output and QA

Write uploadable copy only into the current canonical ASC metadata schema or Android Supply
metadata structure. Generate `metadata/review/localization-review.md` as a review artifact,
not a second source of truth. Include:

- resolved locale matrix and source mapping;
- each field plus measured character/byte count and limit;
- claim evidence references;
- search-term hypothesis/source and duplication notes;
- cultural/tone decisions and known uncertainty;
- native review, policy validation, schema/dry-run, and approval status.

Run platform schema validation and dry-run for every locale. Reject missing locales, fallback
English, stale release notes, count overflow, Apple keyword overflow/duplication, mismatched
brand names, unsupported UI-language claims, and any invented feature. Upload/apply remains a
separate immutable-batch approval followed by readback.
