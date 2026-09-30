# Kök

The hair-transplant companion: a realistic preview before the operation, then a 12–18-month
same-angle photo journey that tells you which phase you are in and what is normal this week.
Expo SDK 57 · React Native 0.86 · TypeScript · Firebase · RevenueCat · fal.ai (via Functions).
Ships in 20 languages (Türkiye first, then the Arab world and the USA). Apple system design (light/dark).

- What/why: [PRODUCT.md](PRODUCT.md) · design: [docs/superpowers/specs/2026-09-29-kok-design.md](docs/superpowers/specs/2026-09-29-kok-design.md)
- Agent/contributor rules: [AGENTS.md](AGENTS.md) · toolchain: [docs/stack.md](docs/stack.md) · plan: [docs/mvp-plan.md](docs/mvp-plan.md)

## Run it (no keys needed)

```bash
npm install
npm run web                      # or: npx expo start  (dev client) — mock backend is the default
npm run verify                   # typecheck + lint + translation parity + tests
```

`EXPO_PUBLIC_BACKEND_MODE` = `mock` (default) · `emulator` (Firebase Local Emulator Suite) · `live`.
Live needs `GoogleService-Info.plist` / `google-services.json` (gitignored) and the Functions
secrets listed in `docs/data-model.md`. Nothing here deploys, submits or spends by itself.

## Current capabilities

See [docs/features.md](docs/features.md) and [docs/mvp-plan.md](docs/mvp-plan.md). Store/billing/backend setup that needs the owner's accounts: [docs/release/phase-c-store-setup.md](docs/release/phase-c-store-setup.md).

```bash
cd functions && npm ci && npm test          # 116 backend tests (no network)
```
