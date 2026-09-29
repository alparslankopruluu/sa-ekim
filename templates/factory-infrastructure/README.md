# Factory infrastructure template

This template provides a Firebase Hosting web app, an aggregate-only admin view,
and a public read-only Cloudflare R2 asset Worker. It is intended to be copied by
`/factory-run`; it is not deployed from the kit root.

## Substitute before installing

Replace every placeholder listed in `template.json`. A generated app must leave no
`__APP_*__` or `__SUPPORT_EMAIL__` tokens behind.

Firebase web configuration and the App Check site key are public identifiers, but
keep them centralized in the generated app's local/build environment:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET        (optional)
VITE_FIREBASE_MESSAGING_SENDER_ID   (optional)
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID        (optional)
VITE_FIREBASE_FUNCTIONS_REGION      (defaults to us-central1)
VITE_FIREBASE_APPCHECK_SITE_KEY
VITE_USE_FIREBASE_EMULATORS         (local use only)
VITE_APPCHECK_DEBUG                 (local use only; never provide a token here)
```

Do not commit generated environment files or App Check debug tokens. Store the
admin allowlist in Secret Manager, never in the web bundle:

```bash
firebase functions:secrets:set ADMIN_EMAILS
```

The secret accepts comma- or newline-separated email addresses. The callable also
requires a verified Google sign-in and merges the `admin` claim into existing
custom claims. `getAdminOverview` returns counts only; it never returns user
documents, emails, UIDs, or a generic CRUD surface.

## Firebase setup and checks

Enable Google sign-in and register the web app for App Check with a score-based
reCAPTCHA Enterprise site key. Monitor valid-token metrics before enforcing App
Check for Hosting clients. Deploy only explicit targets:

```bash
npm --prefix web install
npm --prefix functions install
npm --prefix web run typecheck
npm --prefix web test
npm --prefix web run build
npm --prefix functions test
firebase deploy --only functions:requestAdminAccess,functions:getAdminOverview
firebase deploy --only hosting
```

For local Functions/Auth emulators, set `VITE_USE_FIREBASE_EMULATORS=true`. For
local App Check, set `VITE_APPCHECK_DEBUG=true`, register the SDK-generated debug
token in the Firebase console, and keep that token out of files and logs retained
by the project.

## R2 setup and checks

The Worker has separate `dev` and `prod` R2 bindings. It accepts only `GET` and
`HEAD`, performs no listing, and contains no write endpoint or client credential.

```bash
npm --prefix r2-worker install
npm --prefix r2-worker test
npm --prefix r2-worker run typecheck
npm --prefix r2-worker run build
npm --prefix r2-worker exec -- wrangler r2 bucket create __APP_SLUG__-dev-assets
npm --prefix r2-worker exec -- wrangler r2 bucket create __APP_SLUG__-prod-assets
npm --prefix r2-worker run dev
npm --prefix r2-worker run deploy:dev
# Production deployment remains an explicit human-approved operation:
npm --prefix r2-worker run deploy:prod
```

Upload assets with an operator-side Wrangler command or CI identity. Never add a
browser-accessible upload route to this Worker. Only keys under
`public/<release>/<locale>/<asset>` are served. The Worker rejects multi-range and
invalid byte-range requests with `416`; valid single ranges return `206`.
