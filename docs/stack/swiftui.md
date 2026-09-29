# Stack: Native iOS (SwiftUI)

*Read this when: every session (via CLAUDE.md §0). Conventions, bans, and commands for this stack. Core-flow quality also follows engineering and native motion-quality checklists.*

Optional focused Swift skills and XcodeBuildMCP/Axiom boundaries live in
`docs/playbooks/ios-expert-tools.md`; they supplement, never replace, this stack contract.

## Conventions

- SwiftUI + Observation framework (`@Observable` view models). async/await only — no Combine in new code.
- Feature-first folders; services are protocol-backed for testability. DI via a lightweight container or `@Environment`.
- Protocols belong at provider/change boundaries; do not wrap every leaf type in a one-implementation abstraction.
- Persistence: Firestore for synced data; SwiftData/UserDefaults only for local-only state — decide per app, log in `docs/decisions.md`.
- Liquid Glass: `.glassEffect()`, `GlassEffectContainer`, `.glass`/`.glassProminent` button styles are the native APIs — use them for anything custom that needs the material; usage rules → `docs/playbooks/design.md`.
- Camera picker and share sheet still need UIKit interop via `UIViewControllerRepresentable` (`UIImagePickerController` / `UIActivityViewController`) — SwiftUI has no native equivalent for either.
- **Reuse rule:** before writing a new view/extension/util, check `Core/UI`, `Core/Extensions`, `Core/Utils`, and the current feature's own `Components/` for one that already does it. The moment a view/helper is needed by a 2nd feature, **promote** it into `Core/` — never fork a near-duplicate.
- **MVVM without overengineering:** one `@Observable` view model per nontrivial feature/screen; trivial views (pure layout, no state/async) get **no** view model. The view model owns presentation state + orchestration and calls protocol-backed services; no business logic in the view. Introduce a use-case/service boundary only where there is a real test or change reason — this reinforces the protocols-at-provider/change-boundaries rule above, it does not add a layer per feature. Prefer value types and derived state over duplicating model fields.
- **Swift concurrency correctness:** async/await only. Annotate UI-bound view models `@MainActor`; pass only `Sendable` types across `Task`/actor boundaries; session/service types shared across concurrency domains must be `Sendable` (immutable structs or actors) — never rely on `@unchecked Sendable` without a documented invariant. Do not capture non-`Sendable` `self` in detached tasks.

```
App/
├── App.swift                  # entry — light init only (see performance checklist)
├── Core/
│   ├── UI/                    # shared reusable views (2+ features) — buttons, cards, loaders, empty states
│   ├── Extensions/            # shared Swift extensions (Date+, String+, View+)
│   ├── Utils/                 # shared pure-function helpers, formatters
│   └── DesignTokens.swift
├── Services/                  # PurchasesService, AnalyticsService, AuthService, <Domain>Service
├── Features/
│   └── <Feature>/
│       ├── <Feature>View.swift
│       ├── <Feature>ViewModel.swift
│       └── Components/        # views used ONLY by this feature
├── Localizable.xcstrings      # single string source
├── InfoPlist.xcstrings
└── Secrets.example.xcconfig   # committed; real Secrets.xcconfig is gitignored
```

## Baseline SPM dependencies

Firebase (Analytics, Auth, Firestore, Crashlytics, RemoteConfig, AppCheck, Messaging) · RevenueCat + RevenueCatUI · Pow (delight effects — `docs/playbooks/design.md`; tokens live in `Core/DesignTokens.swift`). Messaging/APNs is configured in M0, but notification permission and sends remain off unless PRODUCT.md names a legitimate value moment. Anything else requires plan approval.

## Forbidden patterns (stack-specific)

```swift
// ❌ let user = auth.currentUser!            → ✅ guard let user = auth.currentUser else { … }
// ❌ try! decoder.decode(…)                  → ✅ do/catch with typed error handling
// ❌ Text("Start your free trial")           → ✅ Text("paywall.cta") // key in Localizable.xcstrings
// ❌ body with 100+ lines                    → ✅ decompose into subviews / computed sections
// ❌ AnyView(erasedView)                     → ✅ @ViewBuilder / generics
// ❌ business logic inside a View            → ✅ ViewModel or Service
// ❌ URLSession call in App.init             → ✅ .task after first frame
// ❌ Purchases.shared anywhere in a View     → ✅ everything via PurchasesService
// ❌ copy-pasting a near-duplicate view/util → ✅ reuse/extend the Core/ version, or promote yours into it
// ❌ view model on a pure-layout, stateless view → ✅ no VM; keep it a plain @ViewBuilder
// ❌ @unchecked Sendable to dodge a concurrency error → ✅ Sendable value/actor, or document the invariant
```

## Commands

```bash
xcodebuild -scheme {{SCHEME}} -destination 'platform=iOS Simulator,name={{SIM_NAME}}' build
xcodebuild -scheme {{SCHEME}} -destination 'platform=iOS Simulator,name={{SIM_NAME}}' test
swiftlint --strict
swiftformat --lint .
xcrun simctl io booted screenshot shot.png     # store screenshots: docs/playbooks/store-listing.md
asc builds next-build-number --app "$ASC_APP_ID" --version "$VERSION"
asc xcode archive --project "$PROJECT_PATH" --scheme "$SCHEME" --archive-path .asc/artifacts/App.xcarchive
asc xcode export --archive-path .asc/artifacts/App.xcarchive --ipa-path .asc/artifacts/App.ipa
asc publish testflight --app "$ASC_APP_ID" --ipa .asc/artifacts/App.ipa --group "$TESTFLIGHT_GROUP" --wait
```

## Testing

- XCTest for ViewModels and Services (protocol-mocked dependencies).
- The MVVM split above defines the test surface: nontrivial screens get one focused view-model test with protocol-mocked, `Sendable` services; pure layout views are covered by UI tests, not unit mocks.
- Exercise async paths with async tests. Never silence a strict-concurrency diagnostic (or add `@unchecked Sendable`) just to make a test compile.
- Purchases: StoreKit Configuration file (`Products.storekit`) attached to the scheme — full purchase flows on simulator with zero network.
- Money path gets a UI test: onboarding → paywall → (StoreKit-config) purchase.

## Store screenshots

After M1/M2 acceptance, asc shots/AXe + simctl captures real locale/device states → the
pinned HyperShots runtime bundled in `source-command-store-assets` authors, auto-fits,
renders, reviews, and validates deterministic panels → asc screenshot plan/approved
apply/readback. `scripts/compose-screenshots.sh` remains a fallback; Fastlane Snapshot is
capture-only and never the upload authority.
