# Firebase

*Read this when: touching Firestore, rules, indexes, Functions, auth, Remote Config, or deploying anything Firebase.*

## Standard infrastructure vs core-feature backend

Factory mode deliberately provisions Firebase dev/prod, web/admin, Hosting, App Check, Remote Config and push scaffolding for every app. The backend-usage gate decides whether the **core feature** also uses synced Firestore/Storage/Functions. A local utility keeps domain data local and avoids unnecessary listeners/collections, but still uses the standard operational surface. AI apps, Model B credits, accounts/sync, and paid API proxies require the full mobile backend path. Log the usage boundary in `docs/decisions.md`.

## Projects & CLI

- Two projects per app: `{{APP_SLUG}}-dev` and `{{APP_SLUG}}-prod`. Local dev NEVER points at prod.
- `/factory-run` creates both with `firebase projects:create`, then creates iOS and web registrations with `firebase apps:create`. It reads back IDs before continuing and never retries a create blindly.
- `.firebaserc`:
  ```json
  { "projects": { "default": "{{APP_SLUG}}-dev", "dev": "{{APP_SLUG}}-dev", "prod": "{{APP_SLUG}}-prod" } }
  ```
- Init targets kept in repo: `firestore` (rules + indexes), `functions` (TypeScript), `storage`, `emulators`, `remoteconfig`, `hosting`.
- Every v2 factory app gets Firebase Hosting for the Vite public/admin site and FCM/APNs scaffolding. Blaze billing and provider-console key attachment remain visible human actions because they create financial/security authority.
- Deploys are ALWAYS scoped — bare `firebase deploy` requires human approval (permission layer enforces this):
  ```bash
  firebase deploy --only firestore:rules
  firebase deploy --only firestore:indexes
  firebase deploy --only functions:<name>
  firebase deploy --only storage
  firebase deploy --only remoteconfig
  # prod: firebase use prod && <scoped deploy> && firebase use dev
  ```

## Emulators

- `firebase emulators:start --only auth,firestore,functions,storage` — fixed ports in `firebase.json`.
- App connects via a single `useEmulators()` bootstrap gated on `__DEV__` / `DEBUG`. One switch, no scattered host checks.
- Seed data: `--export-on-exit ./emulator-data --import ./emulator-data`.

## Security baseline (non-negotiable)

- Rules are deny-by-default:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} { allow read, write: if false; }
      match /users/{uid} { allow read, write: if request.auth.uid == uid; }
      // server-only subtrees (wallet, entitlement_mirror): NO client write rules exist
    }
  }
  ```
- Rules unit-tested with `@firebase/rules-unit-testing` against the emulator; tests re-run before every release (`docs/checklists/security.md`).
- **App Check:** App Attest provider (+ debug provider for dev/simulator/CI). Enable **enforcement** on Firestore, callable Functions (`enforceAppCheck: true`), and Storage — but only AFTER a TestFlight build is verified passing (classic self-DoS otherwise).
- Rules are **not query filters** — if a query's potential result set could include a document the rules would deny, the *entire* query fails, not just that doc. Design list/feed queries so their scope always matches what the rules allow (e.g. filter by owner uid).
- `get()`/`exists()` inside rules cost a read even when denied, and are capped (10 per single-doc/query rule evaluation, 20 for batched/transactional ops) — avoid cross-document lookups in rules on hot paths; denormalize the one field you need (e.g. `ownerId`) onto the document instead.
- As soon as a second collection exists, factor ownership/auth checks into named rule helper functions (`isSignedIn()`, `isOwner(uid)`) instead of repeating `request.auth.uid == uid` inline.
- Validate data **shape**, not just ownership: `request.resource.data.keys().hasOnly([...])` plus field types — defense-in-depth against a compromised or buggy client, not optional polish.
- Never trust a client-supplied timestamp for anything security- or ordering-relevant — require `request.time` via `serverTimestamp()`.
- Offline persistence is on by default in the Swift SDK (100 MB cache) — raise `cacheSizeBytes` only if justified. A snapshot listener bills a read for the initial snapshot **and again per changed document per update** — prefer a one-shot `get()`/`getDocs()` for screens that don't need live updates.

*Source: firebase.google.com/docs/firestore/security/rules-structure, rules-conditions, rules-query; firebase.google.com/docs/firestore/query-data/enable-offline; firebase.google.com/docs/firestore/pricing.*

## Data modeling & query patterns

- Documents are capped at 1 MiB — any growing ledger/history/transaction list lives in a **subcollection**, never an array/map field on the parent doc (relevant to the Model B credit wallet).
- Any balance/counter field (credits, tallies) is written via `FieldValue.increment()` inside a transaction — never read-then-write (race condition); shard into a `shards` subcollection only if write velocity is genuinely high.
- Paginate every list/history/feed screen with `limit()` + a document-snapshot cursor (`startAfter`/`endBefore`) — never `offset()` (it still reads and bills the skipped documents).
- Use `count()`/`sum()`/`average()` aggregation queries for any tally — never download a full collection client-side just to count it.
- Ephemeral documents (rate-limit counters, temp sessions) get a **TTL policy** on their expiry field, exempted from indexing.

*Source: firebase.google.com/docs/firestore/manage-data/structure-data; query-data/query-cursors; query-data/aggregation-queries; ttl; solutions/counters.*

## Auth — anonymous-first

1. `signInAnonymously()` silently during onboarding → stable UID before the paywall.
2. `Purchases.logIn(uid)` immediately after (purchases survive account changes).
3. Offer **Sign in with Apple** later, at a data-worth-saving moment ("save your progress"), via `linkWithCredential` — UID, purchases, and data survive.
4. Handle the `credential-already-in-use` case: sign in to the existing account, then migrate/merge the anonymous user's data server-side, then delete the orphan.
5. If any third-party login is offered, Sign in with Apple must be one of them (App Review).
6. **Account deletion is mandatory, not optional:** if the app supports account creation at all (any non-anonymous sign-in), ship an in-app "Delete Account" action that deletes the Auth user and cascades to the user's Firestore docs + Storage prefix — App Review 5.1.1(v) rejects apps that only let you create an account, never delete one. Firebase requires a **recent sign-in** for this: `deleteUser()` fails with `requires-recent-login` unless the session is fresh, so catch that error and force `reauthenticateWithCredential` (the Apple credential) before retrying the delete.
7. Never hand-roll ID token refresh or session persistence — the Auth SDK does both transparently; only force a token refresh in the rare case custom claims just changed server-side.
8. **FirebaseUI is not used:** the flow above already gives more control than its prebuilt drop-in screens offer; revisit only if the app needs many more sign-in providers at once.

*Source: App Store Review Guidelines (5.1.1); firebase.google.com/docs/auth/ios/manage-users; firebase.google.com/docs/auth/ios/firebaseui.*

## Remote Config

- Standard keys: `min_supported_build` (forced-update gate), `paywall_variant`, `onboarding_variant`, `ff_<name>` feature flags, `ff_review_prompt`.
- Defaults bundled in-app — cold start NEVER blocks on fetch. Fetch interval: 12h prod, 0 dev.
- Forced update: on launch compare build number to `min_supported_build`; below → blocking screen with App Store link. Test the path before every release.
- Paywall/pricing experiments live in RevenueCat Experiments; everything else (onboarding copy/variant, priming copy, feature flags) runs through **Firebase A/B Testing** — create an experiment targeting the Remote Config parameter (e.g. `onboarding_variant`), pick the conversion metric (`onboarding_complete`, or a custom event), let Firebase declare a winner. Free, already in the stack — no separate no-code growth vendor (Superwall/Adapty onboarding builder/Setgreet-style tools) needed for copy-level iteration.

## Cloud Functions (gen 2, TypeScript, region close to users)

Use Functions when — and only when:
- Calling paid third-party APIs (AI providers): the proxy pattern from `docs/checklists/security.md`. Secrets via `defineSecret` / Secret Manager. `minInstances: 1` if cold start hurts the core loop; always set `maxInstances` to cap runaway cost.
- RevenueCat webhook (`revenuecatWebhook`): verify the Authorization header, mirror entitlements, grant credits (`docs/playbooks/monetization.md`).
- Credit spends / anything the client must not be trusted to compute.
- Scheduled jobs (`onSchedule`): cleanup, digests.
- Admin bootstrap (`requestAdminAccess`): callable + App Check; compares the verified Google email to the `ADMIN_EMAILS` server secret, then grants an `admin` custom claim. Base admin APIs expose aggregate operational health only, never raw user CRUD.

Client-only is fine for: own-document CRUD under valid rules, Analytics/RC calls, Remote Config reads, user-scoped Storage uploads.

Prefer callable (`onCall`) over raw HTTP for client calls — auth + App Check verified automatically.

## Automation split

| Claude automates | Human does |
|---|---|
| CLI project/app creation, rules + tests, Functions, Hosting, web/admin registration, emulators, Remote Config, FCM scaffolding, scoped dev deploys | Authenticates Firebase/Google, links Blaze billing, supplies APNs/provider-console authority, approves prod deploys and destructive operations |
