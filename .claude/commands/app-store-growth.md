---
description: Plan or operate measurable App Store growth surfaces with explicit write gates
argument-hint: "[--surface=cpp|ppo|creative-assets|in-app-events|tags|all] [--mode=plan|prepare|apply|measure] [--locales=launch|extended|<csv>]"
---

Operate App Store growth for `$ARGUMENTS`.

Accept only:

- `--surface=cpp|ppo|creative-assets|in-app-events|tags|all`
- `--mode=plan|prepare|apply|measure`
- `--locales=launch|extended|<csv>`

Default to `surface=all`, `mode=plan`, and `locales=launch`. Reject unknown or
conflicting flags. When a request names several—but not all—surfaces, execute one scoped
surface invocation at a time under the same brief; never widen it to `all`. When it asks
for `plan` then `prepare`, finish and show the plan first, then make only the requested
local preparation writes. A bare “show me a prepare proposal” is not permission to write.
CSV locale values are BCP-47 product locales resolved through `docs/locales.json`, then
mapped to ASC locale identifiers; never guess region variants. Read `PRODUCT.md`,
`docs/growth-plan.md`, `docs/features.md`,
`docs/product-map.md`, `docs/playbooks/app-store-growth.md`, and the canonical ASC
metadata under `./metadata` before acting. If that canonical directory does not exist,
route baseline initialization through `/store-assets`. Use `/store-assets` for the
default listing, final icon, and
baseline screenshot set; this command owns growth variants and their measurement loop.

## Universal truth and readiness gate

Verify the exact version/build and shipped feature evidence first. Every claim and image
must match behavior present in that build, use fictional or consented account data, and be
suitable for ages 4+. Reject prices, discounts, URLs, other-platform marks, Apple awards
or recognition marks, unverifiable superlatives, and implied Apple endorsement. Localize
both words and visible UI where the audience requires it.
For health/fitness, body, finance, kids, UGC, or other flagged categories, also apply the
matching row in `docs/checklists/app-review-rejections.md`; never promise diagnosis,
guaranteed body change, rapid weight loss, or a result the exact build cannot substantiate.

Run read-only discovery before proposing a mutation:

```bash
asc capabilities
asc schema
asc help
python3 scripts/factoryctl.py recommend refresh
```

Use the locally installed `asc` syntax discovered from those commands; never invent a
flag. Save generated plans, readbacks, and an immutable input manifest under ignored
`.factory/app-store-growth/`. Record durable hypotheses and results in
`docs/growth-plan.md`, without copying credentials or raw customer data.

## Mode contract

- `plan`: research current state, define audience, hypothesis, metric, sample, duration,
  stop conditions, locales, asset delta, deep link, and analytics. Local files only.
- `prepare`: create validated local variants, manifests, and an exact dry-run/diff. Do not
  upload, start a test/event, or mutate App Store Connect.
- `apply`: show the exact immutable batch and request fresh approval immediately before
  each remote write. Apply only supported surfaces, then read back identifiers and state.
- `measure`: read results, compare against the predetermined decision rule, record the
  decision, and recommend keep/iterate/stop. Measurement does not silently apply a winner.

## Surface contracts

### Custom Product Pages

Support at most 70 pages. Each page needs a distinct audience intent and keyword/creative
combination, localized metadata/screenshots, an iOS 18+ deep link to matching in-app
content when applicable, and page-level acquisition/activation analytics. A CPP may be
discoverable from assigned App Store search keywords in addition to its URL and Apple Ads;
never preserve the old URL-only assumption. Validate that the deep link resolves in the
release build and has a safe fallback before `apply`.

### Product Page Optimization

Require the app to be Ready for Distribution. Change one variable per experiment and use
at most three treatments against control. Lock the primary metric, traffic allocation,
minimum sample, duration, and stop conditions before start. Derive sample from a recorded
baseline, minimum detectable effect, and confidence target; if traffic cannot support the
sample within the maximum duration, do not start PPO. Icon treatments must already
exist in the submitted binary. Treat Apple's confidence/readback as evidence, not a
guarantee; record the selected result and any follow-up test.

### Creative assets

Prepare Asset Library items, product-page header, search-result creative, and preview-tool
manifests locally. These 2026 surfaces remain preview-only while Apple marks them as a
future release. `apply` is prohibited until live `asc capabilities`, `asc schema`, or
`asc help` proves the exact operation exists. A website announcement or remembered syntax
is not proof.

When an Apple `.fig` template is supplied, hash every candidate and deduplicate identical
files. Never vendor Apple's source file into the kit or app repo. Store only the official
source URL, selected local path, SHA-256, export filenames, dimensions, locales, and build
identity in the project manifest.

### In-App Events and tags

Use only a real, time-bounded event or shipped discoverability concept. Confirm current
eligibility and field limits through Apple/ASC discovery, match the event deep link to the
release build, and separate editorial copy from unverified performance claims. Tags are a
discovery plan until the live tool and account expose a supported write path.

## Approval and authority boundaries

Read-only ASC discovery and result measurement are allowed. Creating/updating a CPP,
starting/stopping PPO, uploading a growth asset, publishing an In-App Event, assigning
tags, changing availability, spending on Apple Ads, or submitting for review requires a
fresh exact approval. `asc` remains the App Store transport authority; Expo/EAS may produce
the binary but never replaces ASC submission/readback. Never delete a page, treatment,
event, or asset automatically.

Finish with surface/state IDs, locales, immutable manifest hash, version/build, evidence,
remaining human actions, and the next measurement date. In `plan`, use explicit
`pending/not created` values instead of inventing IDs or hashes. Call a diff “exact” only
when live ASC discovery exposes the matching dry-run/schema; otherwise label it a local
prepared delta. Refresh factory recommendations.
