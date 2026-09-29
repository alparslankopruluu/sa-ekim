# Security Checklist

*Read this when: writing auth, networking, storage, purchase, or secrets-adjacent code — and at every `/ship` run. App-specific threats/data live in `docs/security-model.md`.*

## What is a secret

Anything that costs money or grants access if extracted: AI provider keys, RevenueCat SECRET key, service-account JSON, webhook auth tokens.
Public-by-design (still centralized in config, never scattered): Firebase client config (`GoogleService-Info.plist`), RevenueCat PUBLIC SDK key.

## Hard rules

- **S1 — Paid API proxy:** ALL paid third-party API calls (AI providers etc.) go through a Cloud Function (callable, auth + App Check enforced, per-user rate limit). The client NEVER holds an AI key. No "temporary" exceptions — temporary keys ship in bundles and live forever in git history.
- **S2 — Expo env:** `EXPO_PUBLIC_*` is compiled INTO the JS bundle = public by definition — never a secret there. `.env*` gitignored (only `.env.example` committed). Build-time secrets → EAS environment variables/secrets. Runtime toggles → Remote Config.
- **S3 — SwiftUI env:** gitignored `Secrets.xcconfig` (+ committed `Secrets.example.xcconfig`) surfaced via Info.plist. Everything in the bundle is extractable — the public-by-design rule applies to whatever ships.
- **S4 — Enforcement:** gitleaks (or equivalent) pre-commit scan. Claude MUST refuse to write a literal key into source and wire env plumbing instead. Suspected leak → **rotate immediately**; deleting the commit is not remediation.
- **S5 — Factory state:** `.factory/run-state.json`, evidence summaries, status UI, prompts, and logs contain identifiers/status only—never API keys, `.p8` contents, cookies, service-account JSON, authorization headers, or raw provider responses that may echo them. `factoryctl` redacts common secret patterns before atomic writes.
- **S6 — Operator auth:** ASC uses Keychain, RevenueCat uses MCP OAuth (Keychain-backed API key only as fallback), Firebase/Wrangler use their own authenticated CLIs. The native status window is read-only and has no credential input or network client.
- **S7 — Authorization and abuse:** every user-owned resource has server/rules ownership checks plus cross-UID IDOR negative tests. Login/reset and paid AI/email/upload paths have bounded per-user and privacy-safe IP/device abuse controls; limits are enforced server-side.
- **S8 — Uploads and web boundary:** user uploads enforce size, allowed MIME verified from content where feasible, extension, executable-content, owner, retention, and public-access policy. Credentialed CORS uses an exact origin allowlist—never `*`. Web/admin responses prove Content-Security-Policy (CSP, including `frame-ancestors`), HSTS, `X-Content-Type-Options: nosniff`, and Referrer-Policy.
- **S9 — Safe errors:** client responses and operational evidence never expose stack traces, internal paths, provider payloads, PII, tokens, or authorization details. Map failures to typed, sanitized errors.

## Purchase truth

- Entitlements come ONLY from RevenueCat `CustomerInfo` or the server mirror written by the RC webhook. A client-set `isPro` flag anywhere is a forbidden pattern.
- Webhook endpoint verifies the Authorization header before touching Firestore.
- Refunds/expirations flow from RC `EXPIRATION`/`CANCELLATION` events — never from client state.

## Release gates (run at `/ship`)

1. `git diff <last-release-tag> -- firestore.rules` — review every change; re-run rules emulator tests; confirm no world-readable/writable collection; confirm server-only collections still have zero client-write rules.
2. Secret scan over the repo (gitleaks / grep for key patterns) — clean.
3. App Check enforcement ON in prod (Firestore, Functions, Storage) and the current TestFlight build verified against it.
4. Sandbox purchase events visible in RC dashboard; webhook mirror updating.
5. If the app supports account creation, confirm in-app account deletion exists, actually
   deletes data (`docs/playbooks/firebase.md` step 6), AND is **discoverable under a
   clearly Account-labeled section** — not filed only under "Privacy"/"Data" with wording
   that doesn't read as account deletion. A real 2026-08 rejection (5.1.1(v)) hit an app
   that HAD a working deletion flow the reviewer never found because it lived under
   "Privacy" as "Delete my photos & data" instead of under "Account". Existence without
   discoverability is still a rejection.
6. Run `asc validate` and `asc review doctor`; reconcile each result with `docs/checklists/app-review-rejections.md` before any submission.
7. Confirm `/admin` Functions require both App Check and `admin` custom claim; base admin output contains no raw users/PII. Confirm the R2 Worker exposes only GET/HEAD and no client has R2 write credentials.
8. Secret-scan `.factory/` evidence before sharing logs even though it is gitignored; verify event history is capped and redacted.
9. Diff the real SDK, data, endpoint, permission, retention/deletion, privacy-label, and
   manifest surface against `docs/security-model.md`; unresolved drift blocks release.
10. Run cross-UID IDOR, auth-abuse, costly-endpoint rate-limit, and applicable upload
    negative tests; attach sanitized evidence to `release.validate`.
11. Verify credentialed CORS and deployed web/admin security headers against the exact
    production origins. A configured file without response-level readback is insufficient.
12. Run dependency vulnerability checks and a secret scan over the working tree **and git
    history**. A suspected exposed credential is rotated first; deleting or rewriting the
    commit alone is not remediation.
13. Exercise representative failures and confirm responses/logs contain no stack trace,
    provider detail, PII, or secret. Reconcile dependencies, permissions, and privacy
    manifests with the current build.

## Apple privacy compliance

- `PrivacyInfo.xcprivacy`: declare required-reason APIs (UserDefaults, file timestamps, boot time, disk space) for the app; third-party SDKs ship their own signed manifests — re-verify after every dependency bump. **Expo RN:** prebuild aggregates library manifests; declare app-level reasons in app config. [verify current aggregation behavior when implementing]
- ASC App Privacy labels match reality: Firebase Analytics + Crashlytics + RevenueCat ⇒ identifiers, usage data, diagnostics, purchases. Update labels when adding any SDK.
- **Privacy Policy content, not just the manifest:** the policy text itself must state data retention/deletion timelines and how a user revokes consent or requests deletion (5.1.1(i)) — a compliant `PrivacyInfo.xcprivacy` does not satisfy this.
- **Third-party AI disclosure:** if any user content or data is sent to a third-party AI provider (the S1 proxy pattern above), disclose this in the Privacy Policy and gate it on explicit user consent — separate from and in addition to ATT (5.1.2(i)).
- **ATT:** required ONLY when tracking across companies (ad attribution SDKs, IDFA, data brokers). Kit default: no ad SDKs → no ATT prompt → do NOT add `NSUserTrackingUsageDescription` "just in case" (unused permission strings invite review questions). If paid UA with attribution arrives later: purpose string + prime-then-prompt (`docs/playbooks/onboarding.md`) + labels updated to "Data Used to Track You".

*Source: App Store Review Guidelines (5.1.1, 5.1.2).*

## Data storage

- Mark caches and any re-creatable/downloadable files as excluded from iCloud backup — never let temp/cache data eat the user's iCloud quota. **SwiftUI:** set `isExcludedFromBackupKey` (`NSURLIsExcludedFromBackupKey`) via `URLResourceValues` on the file URL. **Expo RN:** write such files under `FileSystem.cacheDirectory` (auto-excluded), not `documentDirectory`; use a native/config-plugin call if a library forces `documentDirectory`.

*Source: developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup.*
