# Architecture — {{APP_NAME}}

*Living doc. Where code lives and why. Update when a new dependency, service, or pattern is introduced (+ one line in `docs/decisions.md`). Stack conventions live in `docs/stack.md` — this file is project-specific structure only.*

## Layers

<!-- Seeded by /new-app from docs/stack.md's canonical tree; kept current as the app grows. -->

```
{{FOLDER_TREE}}
```

Every factory app also records these standard surfaces in the concrete tree above:

```text
web/                  # Vite React public pages + claim-protected /admin
functions/            # Firebase callable/webhook/admin boundary
r2-worker/            # Cloudflare Worker; R2 GET/HEAD only
.asc/                 # deployment/workflow config; artifacts and auth config ignored
.factory/             # ignored local run + capability/TODO state; never canonical product memory
android/              # optional independent native Kotlin/Compose parity app
```

Product journeys/states live in `docs/product-map.md`; growth experiments in
`docs/growth-plan.md`; app-specific data/threat boundaries in `docs/security-model.md`.
These describe the architecture but do not duplicate its concrete folder/service map.
The versioned `docs/capabilities.json` catalog declares safe workflow metadata, while
`.factory/capability-state.json` remembers project-local stage, recommendations, and
`after_current_checkpoint | after_milestone | later` queue order without changing the
schema-1 factory run state. The native capability center may update only this file through
a locked atomic `0600` writer; it cannot invoke shell/provider work. An Android port uses independent schema-1
`.factory/android-state.json`; `docs/android-parity.md` owns platform deltas and evidence.

## Services

| Service | Responsibility | Talks to |
|---|---|---|
| PurchasesService | ALL RevenueCat calls (configure, logIn, offerings, purchase, restore) | RevenueCat SDK |
| AnalyticsService | event logging façade | Firebase Analytics |
| AdminOverview | aggregate operational health only | App Check + admin custom claim |
| PublicAssetWorker | public landing/store media reads | Cloudflare R2 (no public writes) |
| {{SERVICE}} | {{RESPONSIBILITY}} | {{DEPS}} |

## Deployment boundaries

- Mobile/private user data: Firebase Auth + Firestore/Storage; rules deny by default.
- Public/legal/admin web: Vite static build on Firebase Hosting; `/admin` requires verified Google identity + `admin` custom claim.
- Public marketing assets: R2 behind a GET/HEAD-only Worker. Uploads happen through authenticated Wrangler/operator tooling, never the client.
- App distribution: `asc` owns ASC metadata/signing/TestFlight. Android uses a validated
  minified AAB and approval-gated Fastlane Supply for Play Internal Testing; production Play
  rollout remains human-approved. EAS only builds Expo artifacts.
- Remote execution: only branch-scoped research/document tasks marked `cloud_safe` may
  run away from the Mac. The local root owns `.factory`, integration, evidence,
  approvals, and all provider/build/release operations.
- Store creative: M1/M2 acceptance gates the final metadata/icon/screenshot package.
  iOS authoring uses the pinned HyperShots runtime vendored inside the store-assets skill;
  ASC remains the only upload authority and Android keeps a separate native asset path.

## State management

{{STATE_APPROACH}}  <!-- e.g. zustand + react-query, or @Observable view models -->

Provider SDKs stay behind service façades. Core-flow dependency direction, typed
failures, retry/idempotency, migration, CI, and operational evidence must satisfy
`docs/checklists/engineering-quality.md`.

## Navigation map

{{NAV_MAP}}  <!-- routes/screens; keep as a simple indented list -->
