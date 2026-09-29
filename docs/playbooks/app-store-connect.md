# App Store Connect Automation

*Read this when: factory setup/run touches Apple signing, catalog, metadata, screenshots, TestFlight, or review.*

`asc` is the primary App Store Connect interface. Fastlane is a screenshot capture
fallback only; Expo uses EAS only to create an IPA. Before relying on any command,
run `asc --help`, `asc <family> --help`, and `asc <family> <verb> --help`: built-in
help is the authoritative command and flag surface. Do not preserve a stale command
from this playbook when installed help differs.

## Install, auth, and discovery

- Supported factory range: `asc >=3.1.0,<4`. Install with Homebrew and verify with
  `asc version`; do not silently accept a lower or future major version.
- Install the official rorkai agent skills with `asc install-skills`; if installed
  help exposes a different skill verb, follow that help. Verify installed skills.
- Prefer Keychain auth: `asc auth login ... --network`. The human supplies the `.p8`
  path directly to the terminal. Never copy key contents into chat or repo files.
- Run `asc auth status --validate`, `asc auth doctor`, `asc telemetry disable`, and
  `asc apps list --output json`. Do not use `--bypass-keychain` on a developer Mac.
- Prefer explicit long flags and JSON for automation. Use IDs after resolving them,
  `--paginate` for complete reads, and `--dry-run` wherever current help supports it.

## Agent-skill routing

The audited factory subset is pinned to
`rorkai/app-store-connect-cli-skills@13861c2051189e08ac843b396c90dda004b916a8`
(MIT). Install it at **user scope** for Claude Code and Codex; never vendor external ASC
skills into generated projects. Before changing the pin, review upstream skill diffs and
confirm compatibility with the installed `asc >=3.1.0,<4` help.

Load only the smallest skill matching the current task:

| Factory surface | Skill(s) |
|---|---|
| Any ASC command/ID lookup | `asc-cli-usage`, then `asc-id-resolver` when names must become IDs |
| `asc.app` | `asc-signing-setup`; `asc-app-create-ui` only for the missing public app-create API |
| `mobile.build` / archive-export | `asc-xcode-build` |
| `asc.catalog` / `revenuecat.sync` | `asc-revenuecat-catalog-sync`; `asc-ppp-pricing` only for blueprint-approved prices |
| Subscription/group/IAP names | `asc-subscription-localization` |
| `localization.store` | `asc-metadata-sync`, then `asc-localize-metadata` for approved locales |
| `assets.screenshots` | `asc-shots-pipeline` |
| `release.validate` | `asc-submission-health` in preflight/readiness mode only |
| `testflight.internal` | `asc-testflight-orchestration`; `asc-build-lifecycle` for processing/readback only |

The kit's blueprint, `factoryctl` graph, locale manifest, evidence format, and safety
rules remain authoritative. External skill examples never authorize review submission,
resource deletion/expiry, certificate revocation, broad local cleanup, price changes,
external TestFlight, Apple Ads, or retries beyond this playbook.

Not loaded by default: `asc-apple-ads` (spend), `asc-wall-submit` (external promotion),
`asc-notarization` (macOS), `asc-workflow` (factoryctl owns orchestration),
`asc-release-flow` (review submission boundary), `asc-aso-audit` (Astro dependency),
`asc-whats-new-writer`, `asc-crash-triage`, and `asc-screenshot-resize`. They may be
evaluated later for a specific, approved task; they are not part of new-app/factory-run.

Guided `/new-app` uses only `asc-cli-usage`/`asc-id-resolver` during planning and
`asc-signing-setup`/`asc-app-create-ui` during approved M0 ASC preparation. Catalog,
metadata, screenshots, and TestFlight skills enter only when their guided milestone
actually reaches those surfaces. `/factory-run` uses the full task mapping above.

## App record: API first, visible UI only for the gap

1. Read bundle IDs and apps. Create the bundle ID/capabilities through public CLI
   commands only after blueprint approval.
2. If no app record exists, use the official `asc-app-create-ui` workflow in a
   **visible local browser** at `https://appstoreconnect.apple.com/apps`.
3. The user completes login and 2FA. Never export/store cookies or use a hidden browser.
4. Fill the approved platform, name, primary language, existing bundle ID, SKU, and
   access. The blueprint approval is the create confirmation for this integrated run.
5. Click Create once. Do not retry Create automatically. If selectors, validation, or
   navigation fail, capture a redacted screenshot and create a human action.
6. Verify with `asc apps list --bundle-id ... --output json`; only then store the app ID.

## Deterministic catalog and RevenueCat reconciliation

Canonical key: ASC `productId` equals RevenueCat `store_identifier`. Display names
are never identifiers. The approved baseline contains a subscription group plus
weekly and annual subscriptions unless PRODUCT.md specifies an approved alternative.

For every run:

1. **Audit:** list ASC groups/subscriptions/IAPs with pagination. Through RevenueCat
   MCP OAuth, list project, apps, products, entitlements, offerings, packages, and
   attachments. Prefer OAuth; fallback credentials may exist only in OS Keychain.
2. Build a diff keyed by product identifier and platform app. Reject type/app conflicts.
3. **Apply:** create only approved missing ASC resources; re-read canonical ASC IDs.
   Create missing RevenueCat products with identical `store_identifier`.
4. Ensure entitlement `pro`; offerings `default` and `onb_discount`; create the
   approved weekly/annual packages and attach each product. Never attach consumables
   to `pro` without an explicit product decision.
5. **Readback:** re-list both catalogs and attachments. Success requires zero missing,
   duplicate, wrong-app, wrong-type, or unattached approved identifiers.

Use current `asc subscriptions ... --help` before choosing create/setup, localization,
availability, pricing import, or price commands. For PPP pricing: snapshot current
summaries, dry-run the approved CSV, apply, then read back key territories. A price
change not present in the approved blueprint needs new approval.

### HTTP 409 policy

A 409 is a state conflict, not permission to issue another blind create:

1. Save the redacted error, resource/product ID, operation, and timestamp as evidence.
2. Re-read the catalog, localization, availability, price summary, and active/scheduled
   price records relevant to the operation.
3. If readback proves the requested state already exists exactly, mark it succeeded.
4. If the response/tool classifies a transient conflict, retry the same idempotent
   operation with exponential backoff at most three total retries (for example 2s,
   4s, 8s), re-reading state between attempts.
5. For duplicate, locked review state, overlapping schedule, identifier/type mismatch,
   or an unclassified conflict, do not retry. Create a `waiting_human` card containing
   the exact resource ID, current vs desired state, redacted error, and evidence path.

Never delete/recreate a catalog item to resolve 409.

## Localization and metadata

`docs/locales.json` owns UI BCP-47 -> ASC locale mapping. Launch contains nine
locales; extended contains 22. Do not substitute regionless ASC locales when the map
specifies a region (`ar-SA`, `de-DE`, `en-US`, `es-ES`, `fr-FR`, `nl-NL`).

For every selected locale:

- validate in-app key parity, interpolation, plural categories, and RTL before store work;
- write original localized name/subtitle/description/promo/release notes;
- build a locale-specific keyword matrix; never translate the English keyword list;
- keep app-info and version fields separate and validate ASC character/byte limits;
- localize subscription group and subscription display names; list first and create
  only missing locales; read back with pagination.

Prefer the current canonical metadata flow discovered through help. The expected shape
on asc 3.x is pull/validate, then plan or dry-run, approved apply (file-driven batch
mutations require the explicit `--confirm` form shown by installed help), and readback.
Blueprint approval covers the initial planned metadata apply, but the generated diff
must still match the blueprint and selected locales exactly.

## Signing, build, and internal TestFlight

Read certificates/profiles/bundle capabilities first. Reuse valid matching signing
assets; do not revoke or delete signing resources. For SwiftUI, use current
`asc xcode archive` and `asc xcode export` with an explicit project/workspace, scheme,
archive path, ExportOptions, and artifact path. For Expo, use `eas build` to obtain the
production IPA; never use `eas submit`.

Run installed help before publishing. The expected internal flow is:

```bash
asc validate --app "$APP_ID" --version "$VERSION" --platform IOS --output table
asc review doctor --app "$APP_ID"
asc publish testflight --app "$APP_ID" --ipa "$IPA" --group "$GROUP_ID" --wait
```

Resolve/create the approved internal group, add the approved tester email, upload,
wait for `VALID`, attach the processed build, add localized What to Test notes, then
read back build/group/tester membership. External TestFlight requires Beta App Review
and is not part of factory mode.

Build readback must report exact version/build, Processing/Failed/Complete state, every
warning even when Complete, per-device variant download/install sizes, any 200 MB
cellular concern, minimum OS/device requirements, and dSYM availability. Xcode/EAS
success does not replace App Store Connect processing evidence.

Internal TestFlight upload is covered by blueprint approval. The following are not:

- `asc review submit`;
- `asc publish appstore --submit`;
- external TestFlight submission;
- phased release activation;
- any unapproved price or availability mutation.

Run `docs/checklists/app-review-rejections.md` before declaring store-ready. App Privacy
may remain a web-session/manual surface; report advisory state honestly.

## Responding to a rejection that asks a specific question

When a rejection message asks for specific information (most commonly a Guideline 2.1
data-handling question — what's collected, retention, third-party sharing, exact privacy-
policy quotes), **write the full answer into the version's App Review Information Notes
field**, not only as a Resolution Center message reply:

```bash
asc review details-for-version --version-id "$VERSION_ID" --output json   # read current notes
asc review details-update --id "$DETAIL_ID" --notes "$FULL_ANSWER" --output json
```

A real 2026-08 case sent the answer only as a message reply on the original submission; the
next resubmission's reviewer worked from the version's Notes field (which still had only the
generic reviewer-journey text) and asked the identical questions again. The Notes field
persists with the version and is what a reviewer reads directly — a message reply alone does
not survive into the next review round. Always readback (`details-for-version`) to confirm
the update actually landed before considering the response sent. Sending the same answer as a
message reply too is fine as a belt-and-suspenders addition, but never as the only channel.

Quote exact text from the live Privacy Policy (fetch the real rendered page, never
paraphrase from memory) and name the exact section headings — Apple explicitly asks reviewers
to verify quotes match, and a paraphrase invites a second round of the same question.

## Screenshot pipeline

Default listing assets route through `/store-assets`; CPP/PPO/Asset Library/header/search-
result/event/tag operations route through `/app-store-growth`. Keep Apple's future 2026
creative surfaces local preview-only until installed `asc capabilities/schema/help`
proves an exact supported write path.

Capture real UI from deterministic states. SwiftUI prefers the current experimental
`asc screenshots` + AXe/simctl flow and falls back to Fastlane Snapshot. Expo uses
Maestro/simctl. The kit caption composer remains canonical. Discover framing devices
and commands through installed help; Koubou is a local deterministic framing helper,
not a source of synthetic UI.

Validate input and final files, generate review artifacts, run `asc screenshots plan`,
then apply the approved plan with the exact `--confirm` form shown by installed help. Never
upload screenshots that imply an absent feature, use another app's UI, contain secrets,
or mismatch locale/device family. Read remote screenshot counts after apply.

## Evidence and redaction

For each ASC mutation, preserve: dry-run/audit summary, approved blueprint digest,
command family (without secret flags/values), returned canonical IDs, and readback.
Redact emails except the configured tester display, issuer/key/team identifiers where
unnecessary, local private-key paths, cookies, and raw API debug output. Never enable
`ASC_DEBUG=api` unless diagnosing locally and the output is excluded from state/logs.

Primary sources: [App Store Connect CLI](https://github.com/rorkai/App-Store-Connect-CLI),
[official ASC agent skills](https://github.com/rorkai/app-store-connect-cli-skills).
