---
name: source-command-store-assets
description: Prepare release-candidate Apple App Store or Google Play metadata, market-native listing localization for every project-targeted locale, final icons, localized marketing screenshots, review galleries, validation, and approval-gated upload plans. Use when asked to rewrite or localize store listings, descriptions, subtitles, keywords, release notes, screenshots, store images, icons, feature graphics, metadata, ASO copy, or a store upload preview; queue final work instead of generating creative when the MVP is not release-candidate ready.
---

# Prepare release-candidate store assets

Accept `--platform=ios|android|both`, `--kind=screenshots|metadata|icons|all`,
`--locales=project|launch|extended|<csv>`, `--review=calibrate|sequential|batch`,
`--style=clean|stickers|protected-grade`, and `--resume`. Reject unknown or conflicting
flags. Explicit platform wins; otherwise detect
Xcode/workspace, native Android Gradle, or an established Expo project. Select `both` only
when both real deliverables exist. Default to `kind=all`, `locales=project`,
`review=calibrate`, and `style=clean`. For screenshots, use the approved project profile
only when its fonts, RTL,
captures, and renderer support are proven, otherwise stop with the exact coverage gap.

Read PRODUCT, shipped features, product map, MVP plan, localization, store listing, and
the selected platform playbook. Claims must map to shipped behavior and real evidence.
Read `docs/playbooks/app-store-growth.md` for Apple asset truth: no prices, discounts,
URLs, other-platform marks, Apple recognition marks, unverifiable claims, real-person
data, or content unsuitable for a 4+ audience.
Never advertise pending Android parity.

## Market-native metadata localization

For `kind=metadata|all`, read `references/metadata-localization.md` before drafting. Resolve
the exact locale matrix from the explicit flag, approved blueprint/run profile, PRODUCT
launch/store locales, and `docs/locales.json`, in that order. Never silently replace an
app-specific list with the kit's launch nine, skip a target locale, or claim a locale is
supported because store copy exists while the UI is not localized. Surface conflicts for a
product decision.

Rewrite each locale independently from the verified product facts and release evidence; do
not translate a previous locale or preserve English sentence structure. Calibrate the source
locale's positioning, claims, and tone once, then prepare every remaining target locale in
the same run unless `review=sequential` was requested. Keep canonical platform metadata as
the upload source and generate one Markdown review ledger with per-field counts, claim
evidence, keyword/search-term rationale, cultural notes, validation state, and approval
status. A draft, review ledger, or tone approval never authorizes upload.

## Release-candidate gate

Before metadata, final marketing icon, scaffold, capture, render, AI, or upload work, run:

```bash
python3 scripts/factoryctl.py capability list --stage release
```

The catalog's `milestone:creative-ready` signal makes `store-assets` ready only after
`mvp.acceptance` succeeded, or the memory bank says M1
and M2 are complete and the current milestone is M3. Build/test, UI/content freeze,
product-map/features parity, localization, and version/build identity must also have
current evidence. If unavailable, run only:

```bash
python3 scripts/factoryctl.py recommend todo store-assets --placement=after-milestone
```

Report the missing prerequisites and stop. Do not scaffold, install, capture, render,
invoke a provider, draft final creative, or upload. Bundle/signing/app records, sandbox
products, and a functional provisional icon may still exist earlier for development.

## Shared narrative

Create a five-panel default story, expanding only when evidence warrants it: user outcome,
core action, trust/proof, retention/share outcome, differentiator. One outcome per panel;
use a short two-line headline and optional one-line sub. The first three panels must carry
the install decision at store-thumbnail size. Update `docs/store-shotlist.md` with locale,
real app state, caption, capture command, claim evidence, accessibility note, and status.

## iOS: bundled HyperShots engine

Use `vendor/hypershots` inside this skill. It is the pinned upstream HyperShots runtime,
not a reimplementation. Read `vendor/hypershots/PARITY.json`, then load only the matching
reference: create, revise, translate+i18n, typography, capture, asset recipes,
edit-filter, store specs, or gotchas.

1. Run `bash vendor/hypershots/scripts/preflight.sh`. Chrome and Node are required;
   ImageMagick is required for the final contact sheet and protected grading. Never install
   a missing tool silently.
2. Scaffold `.shots` only after the release-candidate gate:
   `bash vendor/hypershots/scripts/scaffold.sh .shots`. Commit authoring sources; generated
   output remains ignored by `.shots/.gitignore`.
3. Capture real deterministic release-candidate UI with asc shots/AXe + simctl for SwiftUI
   or Maestro + simctl for Expo. A hand-built HTML app screen is preview-only and blocks
   upload. Reuse English captures only for genuinely language-neutral UI and record the
   exception.
4. Author bespoke panels using the immutable frame contract and required `data-i18n`,
   `data-fit`, and `data-protect` markers. Do not restyle device geometry or add a second
   status bar/Dynamic Island over real captures.
5. For `en,tr,ar,ja,zh-Hans,ru,es,pt-BR,de`, create complete strings files, run
   `translate-inject.mjs`, and require correct `lang`, Arabic `dir=rtl`, offline Noto
   coverage, no replacement glyph, no missing/unused key, and no fit failure.
6. For every profile and locale run render, visually inspect every PNG, repair, re-render,
   and run `validate.sh`. Then generate `make-review.mjs` and run
   `make-contact-sheet.sh` once per locale. Inspect at full size and roughly one-sixth
   thumbnail size. Separate iPad authoring is mandatory;
   never stretch iPhone panels.
7. Show the clean deterministic set first. `style=stickers` or `protected-grade` records
   intent only. Before any genmedia/fal.ai/GPT Image 2 upload or paid call, show the exact
   files, model/action, protected regions, and estimated cost, then obtain fresh approval.
   For protected grading, record that approval in the credential-free 0600
   `.shots/style-approval.json` receipt described by `references/edit-filter.md`. Sticker
   and background generation use the equivalent `.shots/provider-approval.json` contract
   in `references/asset-recipes.md`. The runtime verifies the clean-review hash, prompt
   hash, exact artifacts, provider, model chain, and estimated cost before `genmedia` can
   run.
   AI may change only original sticker/background/grade regions; never regenerate copy,
   device geometry, or real app UI. Clean renders remain intact.
8. Stage the approved selection under `screenshots/review/<asc-locale>/`. Use audited ASC
   metadata/localization/screenshot skills. `asc screenshots plan` is mandatory;
   `apply` needs immutable-batch approval and readback. Do not use Fastlane Deliver.

For iOS metadata, initialize the canonical ASC schema when absent, enforce current field
limits (including the 100-byte—not character—keyword field), research search terms per
locale rather than translating them literally, and dry-run the delta. For icons, present
three original directions. Use Icon Composer only after
proving the installed macOS/Xcode/tool versions, Default/Dark/Mono appearances,
small-size legibility, and Xcode integration. Otherwise export the approved opaque
1024×1024 sRGB fallback. Never pre-round. CPP/PPO/Asset Library/header/search growth
variants route to `source-command-app-store-growth`; the default listing stays here.

## Android

Keep the existing Android-native path: canonical Supply metadata, opaque 512×512 icon,
opaque 1024×500 feature graphic, and two to eight verified Compose/ADB or Expo/Maestro
screenshots. Do not reuse iPhone frames. Validate real parity, dimensions, alpha, locale,
claims, Data Safety draft, and installed Supply preview. Any Play mutation, Data Safety
submission, signing, or rollout remains separately approval-gated. HyperShots upstream
has no Google Play renderer, so its iOS frame engine is never presented as Android parity.
Google Play has no separate keyword field: use natural market-relevant language without
keyword blocks or repetition. Release notes describe actual changes and are not promotional.

## Completion

Require clean local packages, full visual review, technical validation, real capture
evidence, and approved transport plans for each selected platform. One platform cannot
hide another's failure. Only then mark `store-assets` done and refresh recommendations.
Never use competitor/unlicensed creative, invent proof, expose credentials, or silently
upload.
