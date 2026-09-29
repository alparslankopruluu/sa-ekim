# Localization

*Read this when: adding/changing user-facing strings, adding a locale, or localizing store metadata.*

## Default locale set (ship all 9 from day one — not staged)

| Locale | Why | Script/direction |
|---|---|---|
| en (US) | development source of truth | Latin |
| tr | strong download volume, low keyword competition | Latin |
| ar | large combined market — RTL, correct from day one, not deferred | Arabic, RTL |
| ja | one of the highest-paying markets | CJK |
| zh-Hans | largest population reach; zh-Hant is included by the extended profile | CJK |
| ru | large market, weak local keyword competition | Cyrillic |
| es (ES) | broad reach; `es-MX` is a separate ASC storefront variant if LatAm matters | Latin |
| pt-BR | Brazil ≫ `pt-PT` by volume | Latin |
| de | top-paying market | Latin |

**Rule:** every project ships UI **and** store listing for all 9 from the start. `/factory-run --locales extended` selects the 22-locale profile in `docs/locales.json`: the launch 9 plus `fr`, `it`, `ko`, `zh-Hant`, `id`, `vi`, `th`, `hi`, `nl`, `pl`, `sv`, `da`, `nb`. The manifest, not ad-hoc directory names, owns BCP-47 ↔ ASC locale mapping.

## RTL (Arabic) — day-one requirement, not deferred

- **SwiftUI:** use `leading`/`trailing` (never `left`/`right`) in every layout — RTL mirroring is then automatic. Preview with `.environment(\.layoutDirection, .rightToLeft)` before shipping any new screen.
- **Expo RN:** enable RTL support via `I18nManager` at startup; use `flexDirection`/logical `start`/`end` properties, never hardcoded `left`/`right`; verify any third-party component actually respects it (some don't — check before relying on one for a hot path).
- Screenshots and onboarding illustrations get mirrored layouts for `ar` (`docs/playbooks/store-listing.md`).

## SwiftUI mechanics

- **String Catalogs** (`Localizable.xcstrings`, single source): `Text("key")` / `String(localized:)` auto-extract at build; per-key translation state tracked.
- Plurals: "Vary by Plural" in the catalog with `%lld` — every count-bearing string gets variants (Slavic locales — `ru` — need few/many; Arabic needs zero/one/two/few/many/other).
- Dates/numbers: `FormatStyle` (`.formatted()`) — never string interpolation.
- `InfoPlist.xcstrings` for permission strings (`NS*UsageDescription`) — MUST be localized (review + conversion).
- `Text(verbatim:)` only for intentionally unlocalized strings.

## Expo RN mechanics

- Stack: `i18next` + `react-i18next` + `expo-localization` (`getLocales()[0].languageTag` initial; react to changes).
- Files: `src/translations/<lang>.json`, namespaced keys (`onboarding.step1.title`). EN is the schema.
- CI key-parity check: a `lint:translations` script asserting every locale has exactly EN's key set — runs in the lint gate.
- Plurals: `key_one` / `key_other` (+ `_few`/`_many`/`_two`/`_zero` where the language needs them — `ar` needs the full set, `ru` needs few/many, `zh`/`ja` have none); `{{count}}` interpolation; `Intl` via Hermes for dates/numbers.
- Set the `locales` field in app config (→ `CFBundleLocalizations`) so the store page lists supported languages.

## AI translation workflow (enforced rules)

1. **Never hardcode user-facing strings — no exceptions.** RN: ESLint `i18next/no-literal-string`. SwiftUI: every literal must exist in the catalog with translations before release (post-change gate). This is CLAUDE.md forbidden pattern #1.
2. **Localize with context:** process a complete screen/flow or store field set from product
   truth, user intent, tone, UI constraints, and the exact locale/region. Never translate
   isolated strings or cascade one translated locale into another.
3. **Human spot-check gate:** before the first release, check the ~20 highest-visibility strings per locale, across all 9 — onboarding, paywall (legal terms extra care), permission prompts, store metadata. `ar` gets an additional RTL visual check on device.
4. **Store metadata is rewritten per market, not translated** — resolve the exact project
   locale matrix first, calibrate the source storefront once, then author every target locale
   independently. Apple keywords are a 100-byte field; Google Play has no separate keyword
   field. The model proposes search-term hypotheses; named ASO data validates them. Full
   contract: `.agents/skills/source-command-store-assets/references/metadata-localization.md`.
5. Screenshot captions localized for all 9; `ar` gets mirrored screenshot layouts.
6. Product-page purpose, privacy meaning, visible UI, previews, CPP deep-link destination,
   event creative, and cultural context are localized as one claim—not translated in
   isolation. Every store creative still passes the 4+ audience truth gate in
   `docs/playbooks/app-store-growth.md`.

## ASC locale gotchas

- Separate locales: `es-ES` vs `es-MX`; `pt-BR` vs `pt-PT`; `zh-Hans` vs `zh-Hant` — each maps to specific storefront groups.
- Metadata uses the current schema produced by `asc metadata init --dir ./metadata`; `/store-assets` writes, validates, dry-runs, and uploads it with `asc`.
- Any locale beyond the default 9 ⇒ storefront price review (`docs/playbooks/paywall.md`).

## Locale rollout table (living — update per the Doc Update Table)

| Locale | Store listing | UI | Screenshots | Since |
|---|---|---|---|---|
| en-US | | | | |
| tr | | | | |
| ar | | | | |
| ja | | | | |
| zh-Hans | | | | |
| ru | | | | |
| es-ES | | | | |
| pt-BR | | | | |
| de | | | | |

Extended rows are generated from `docs/locales.json` when that profile is approved; do not duplicate the manifest here.

## Automation split

| Agent automates | Human does |
|---|---|
| Full localization passes for the exact approved project profile, key-parity checks, catalog/JSON upkeep, RTL layout verification, canonical store metadata, per-field counts, caption localization | Approves source tone/claims; spot-checks top-20 strings per locale; native-speaker review where available (especially `ar`/`ja`/`zh`/`ru`) |
