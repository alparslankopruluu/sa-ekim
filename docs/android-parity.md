# Android Parity — not started

*Canonical owner for iOS-to-Android behavior parity and platform exceptions. Product truth
stays in `PRODUCT.md` and `docs/product-map.md`; implementation detail stays in architecture.*

## Source baseline

- **Owned iOS source revision:** not recorded
- **Snapshot:** clean commit · explicitly approved dirty digest · unknown
- **Scope:** core · shipped · planned
- **Delivery boundary:** local · internal · production-ready
- **Android application ID:** not selected
- **Minimum / target SDK:** 26 / 36

## Parity contract

| ID | iOS evidence | User behavior to preserve | Android-native implementation | Required states | Analytics / data contract | Accessibility | Acceptance evidence | Status / exception |
|---|---|---|---|---|---|---|---|---|
| *(created by `/port-android`)* | — | — | — | — | — | — | — | pending |

Rules:

- Allowed row states are `pending · verified · exception`; use no implicit fourth state.
- `shipped` includes only behavior proven by iOS source, tests, build, and canonical docs.
- Preserve outcome, brand, content hierarchy, analytics names, entitlement, and backend
  contracts; use Material 3 and Android system behavior instead of pixel-copying SwiftUI.
- Every iOS-only API gets a supported Android substitute, a user-approved scope decision,
  or a visible blocker/exception. Never silently omit it.
- Mark `verified` only with a passing local test plus real emulator/device evidence. Planned
  rows cannot become shipped merely because they were ported.
- The android lane is evidence-light: `android task done` requires at least one recorded
  evidence entry (`android evidence add`) for the task, but no capsule or receipt.

## Platform integration parity

| Concern | iOS | Android | Evidence / status |
|---|---|---|---|
| Navigation/state | SwiftUI + Observation | Navigation 3 + ViewModel/StateFlow/UDF | pending |
| Identity/secure storage | Apple auth/Keychain as selected | Credential Manager/Keystore as selected | pending |
| Push | APNs/FCM | FCM notification/data routing | pending |
| Purchases | StoreKit via RevenueCat | Play Billing via RevenueCat; same `pro` entitlement/offering semantics | pending |
| Firebase | iOS dev/prod registrations | Android registrations in the same dev/prod projects | pending |
| Privacy/review | App privacy labels | Data Safety + permission inventory | pending |

## Release evidence

- **Parity:** pending `0` · verified `0` · exceptions `0` until contract generation
- **Quality:** not run
- **Performance:** not run
- **AAB:** not built
- **Play Internal Testing:** not uploaded
- **Production:** NOT SUBMITTED unless a separate approval and readback are recorded
