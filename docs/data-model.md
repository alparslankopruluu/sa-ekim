# Data model — Firestore

*Living doc. Every collection, its access rules in one line, and its indexes. Update with EVERY schema/rules/index change, then deploy (`docs/playbooks/firebase.md`).*

## Collections

| Collection | Doc shape (key fields) | Client access | Written by |
|---|---|---|---|
| `users/{uid}` | profile, settings | own-doc read/write | client |
| `users/{uid}/entitlement_mirror` | status, expiresAt | own-doc read | Cloud Functions (RC webhook) only |
<!-- Model B only: | `users/{uid}/wallet` | credits, updatedAt | own-doc read | Cloud Functions only | -->

## Security rules summary

- Root: deny-by-default (`match /{document=**} { allow read, write: if false; }`)
- `users/{uid}`: `request.auth.uid == uid`
- Server-only collections: no client write rules exist at all

## Indexes

| Collection | Fields | Why |
|---|---|---|

## Cloud Functions

| Function | Trigger | Purpose |
|---|---|---|
| `revenuecatWebhook` | HTTPS | mirror entitlements / grant credits (verifies Authorization header) |
| `requestAdminAccess` | callable | compare verified Google email with `ADMIN_EMAILS`; grant `admin` custom claim (App Check enforced) |
| `adminOverview` | callable | return non-PII aggregate operational health to admin claims only |

Admin authorization lives in custom claims and server secrets, not a client-writable Firestore collection. Adding app-specific moderation/content/credit admin collections still requires an explicit schema/rules decision.
