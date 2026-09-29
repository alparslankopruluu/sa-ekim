# Stack: React Native (Expo)

*Read this when: every session (via CLAUDE.md §0). Conventions, bans, and commands for this stack. Core-flow quality also follows engineering and native motion-quality checklists.*

## Conventions

- Current Expo SDK (56+ / RN 0.85 era; New Architecture only — legacy removed in SDK 55). TypeScript `strict: true`.
- `expo-router` file-based navigation. State: zustand (client) + `@tanstack/react-query` (server/Firestore) unless the app argues otherwise — log the choice in `docs/decisions.md`.
- Provider/change boundaries use strict typed service façades; do not create interfaces or generic layers without a test/change reason.
- **Dev builds, not Expo Go** — `react-native-purchases` and `@react-native-firebase/*` are config-plugin native modules (`expo-dev-client`).
- **No Liquid Glass equivalent:** RN screens won't pick up iOS's current system material — this is a real visual gap versus native apps, not something to chase pixel-for-pixel. `expo-blur` is a best-effort approximation for glass-like surfaces; log the platform gap in `docs/decisions.md` rather than over-engineering a workaround.
- **Reuse rule:** before writing a new component/hook/util, check `src/components`, `src/hooks`, `src/utils`, and the current route's own `_components/` for one that already does it. The moment something is needed by a 2nd route/feature, **promote** it into `src/` — never fork a near-duplicate.

```
app/                     # expo-router routes
├── _layout.tsx          # root — light init only (see performance checklist)
├── (onboarding)/
├── (main)/
│   └── <feature>/
│       └── _components/  # components used ONLY by this route (leading _ = not a route)
src/
├── components/          # shared, reusable components (2+ routes/features)
├── hooks/               # shared, reusable hooks
├── utils/                # shared pure-function helpers, formatters
├── services/            # purchases.ts, analytics.ts, auth.ts, <domain>.ts
├── stores/              # zustand
├── translations/        # en.json is the schema — see localization playbook
├── lib/                 # firebase.ts (incl. useEmulators())
.env.example             # committed; real .env* gitignored
```

## Baseline dependencies

`expo-dev-client` · `react-native-purchases` + `react-native-purchases-ui` · `@react-native-firebase/app|analytics|crashlytics|messaging` · `expo-image` · `expo-localization` + `i18next`/`react-i18next` · `react-native-reanimated` · `@shopify/flash-list` · `expo-store-review` · `nativewind` + `react-native-reusables` + `expo-haptics` (design foundation — `docs/playbooks/design.md`). Messaging is configured in M0, but permission and sends remain off unless PRODUCT.md names a legitimate value moment. Anything else: `npx expo-doctor` first + plan approval.

## Forbidden patterns (stack-specific)

```tsx
// ❌ <Text>Start your free trial</Text>       → ✅ <Text>{t('paywall.cta')}</Text>
// ❌ EXPO_PUBLIC_OPENAI_KEY=sk-…              → ✅ Cloud Function proxy (security checklist S1/S2)
// ❌ {items.map(…)} inside <ScrollView>       → ✅ <FlashList data={items} …/> (v2: no estimatedItemSize)
// ❌ Animated.timing(…) on the money path     → ✅ reanimated worklets on the UI thread
// ❌ console.log committed                    → ✅ remove; babel strips in release anyway
// ❌ (doc.data() as any)                      → ✅ typed converters for Firestore payloads
// ❌ Purchases.purchasePackage() in a screen  → ✅ everything via src/services/purchases.ts
// ❌ copy-pasting a near-duplicate component  → ✅ reuse/extend the src/components version, or promote yours
```

## Commands

```bash
npx expo start                     # dev server (dev build installed)
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start # SDK 54+ only, after approved expo-mcp setup
npx tsc --noEmit                   # typecheck
npm run lint                       # eslint incl. i18next/no-literal-string
npm run lint:translations          # locale key-parity
npx jest                           # unit tests
eas build -p ios --profile development|preview|production
eas update                         # OTA for JS-only fixes
asc publish testflight --app "$ASC_APP_ID" --ipa .asc/artifacts/App.ipa --group "$TESTFLIGHT_GROUP" --wait
```

## Agent tools

Use the official Expo skill/plugin and authenticated Expo MCP profile in
`docs/playbooks/expo-agent-tools.md`. Project-local `expo-mcp` is an approved development
dependency only for SDK 54+; older projects stop at an upgrade/TODO gate. MCP read access
does not authorize builds, workflow runs, cancellation, submission, review response, or
deletion. EAS produces binaries; `asc` remains iOS store transport.

## Testing

- jest + `@testing-library/react-native` for logic/components.
- Money path E2E: maestro flow — onboarding → paywall → sandbox purchase.
- Purchases locally: StoreKit config via `expo run:ios` (prebuild regenerates the project — re-attach the .storekit to the scheme; keep a script/config plugin). [verify current best mechanism when implementing]

## Store screenshots

After M1/M2 acceptance, Maestro navigates to real shot-list states per locale → simctl
capture → the pinned HyperShots runtime bundled in `source-command-store-assets` renders,
reviews, and validates deterministic iOS panels → asc screenshot plan/approved
apply/readback. Android keeps its native Play asset path. EAS builds the IPA; `asc`
distributes it.
