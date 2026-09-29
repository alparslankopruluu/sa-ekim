# Paywall

*Read this when: touching the paywall, purchases, pricing, offerings, or anything RevenueCat.*

## Placement & type

- Kit default: **"soft-hard" paywall at onboarding end** — dismiss X appears after 2–3s, small and top-corner. Evidence: hard paywalls convert ~5× freemium (10.7% vs 2.1% install→paid, RevenueCat 2026).
- True hard (no dismiss) only when there is no sensible free experience. Freemium/soft only when the growth loop needs free users (social/UGC).
- Re-entry points after dismissal: locked feature taps, settings "Go Pro" row, contextual moments of need. All fire `paywall_view` with a `source` param.

## Price architecture

- Default paywall: **annual + weekly** on one screen, annual pre-selected, weekly as the price anchor ("$4.99/week vs $39.99/year — save 84%"). Compute the savings line from real price objects, never hardcode.
- Trials: start with **3–7 days free on annual**. Note from RevenueCat 2026 benchmarks: 17–32-day trials convert to paid at 42.5% median vs 25.5% for <4-day trials — longer trials are a high-value experiment once baseline is measured, not the day-1 default (they delay revenue and suit apps with recurring value).
- "Enable free trial" toggle on the paywall is a proven pattern (toggle off = cheaper no-trial price visible).
- Weekly-only variant suits impulse/AI-tool apps — decide at kickoff, log in `docs/decisions.md`.
- Lifetime only as a win-back/discount lever, never on the primary paywall.

## RevenueCat Paywalls over custom UI

- Default: **RevenueCat Paywalls** (remote-configured, editable without app release, built-in A/B via Experiments).
  - **Expo RN:** `react-native-purchases-ui` → `RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'pro' })` or embedded `<RevenueCatUI.Paywall options={{ offering }} onPurchaseCompleted={…} onRestoreCompleted={…} />`.
  - **SwiftUI:** SPM `RevenueCatUI` → `PaywallView(offering:)` or `.presentPaywallIfNeeded(requiredEntitlementIdentifier: "pro")`.
- Go custom only when the design needs interactions the paywall editor can't express; even then, drive products from Offerings so Experiments keep working.
  **Going custom means you inherit the FULL resilience contract yourself** (`docs/checklists/engineering-quality.md`) — RevenueCatUI's built-in `PaywallView`/`presentPaywallIfNeeded` already has loading/empty/failure handling; a hand-rolled paywall does not get that for free. A real 2026-08 rejection (2.1(b)) hit a custom paywall that silently discarded offerings-fetch errors (`try?`) and only ever showed a spinner — no timeout, no failed state, no retry — so a slow/failed fetch on the reviewer's device looked permanently broken. Any custom paywall MUST implement: a bounded timeout on the offerings fetch, a state distinct from "loading" for "failed or genuinely empty," and a retry action — before it ships.
- **Superwall/similar paywall-first no-code builders:** Superwall (YC-backed, ~$7.5M raised, RevenueCat itself is an investor) is a real, more paywall-specialized alternative — but adds a second MAU-billed vendor for a surface RC's own Paywall Builder (GA since Aug 2025) already covers, since RC is already required for purchases. Skip by default; reconsider only if RC's paywall editor genuinely can't hit a conversion target after real tuning. Smaller, unproven "Setgreet"-style paywall/onboarding builders (no funding/launch/community track record found) are a bigger vendor-risk bet than either — don't adopt one for a money-critical screen without real traction signals (funding, HN/PH launch, active community).

## Offers & win-back

- Exit-intent: RevenueCat's Paywall Builder ships a native **Exit Offers** feature (Dec 2025) — prefer it over hand-rolling a dismiss-triggered discount. Configure a one-time offer (40–50% off annual) from the `onb_discount` offering; still gate to once-per-user. Watch App Review 5.6 — a countdown-pressured or hard-to-dismiss exit offer reads as manipulative and risks rejection.
- Lapsed subscribers: win-back offers (ASC-configured, iOS 18+) / promotional offers targeted via RevenueCat. [verify current RN SDK surface when implementing]
- Offer codes for influencers and support goodwill.

## Price localization

- Set per-storefront prices with ASC price points; use lower tiers for TR, BR, IN, ID, MX.
- ALWAYS render `localizedPriceString` (and per-week breakdowns computed from the price object). Hardcoded prices are a forbidden pattern.
- Pair each new locale launch (`docs/playbooks/localization.md`) with a storefront price review.

## Compliance block (App Review 3.1.2 — rejection otherwise)

Every paywall MUST show: price + billing period + auto-renewal disclosure; trial length and post-trial price **adjacent to the CTA** ("3 days free, then $39.99/year"); a functional **Restore Purchases** button reachable pre-purchase; links to Privacy Policy AND Terms of Use (EULA) — in the binary and in App Store metadata.

Never gate a paid entitlement behind granting an unrelated permission (notifications, location, tracking) — the entitlement must unlock on purchase alone (5.1.1(ii)/5.1.2(i)).

## RevenueCat setup checklist

1. RC project per app; iOS app added with ASC API key.
2. Entitlement: `pro` (single). Offerings: `default` (+ `onb_discount`). Packages: `$rc_annual`, `$rc_weekly` standard identifiers.
3. Product IDs: `{{BUNDLE_ID}}.pro.annual`, `{{BUNDLE_ID}}.pro.weekly` (+ `{{BUNDLE_ID}}.credits.<n>` for Model B). Semantic, price-free — IDs are permanent.
4. Configure at app root before any UI: **Expo RN:** `Purchases.configure({ apiKey })`; **SwiftUI:** `Purchases.configure(withAPIKey:)` in `App.init`. Public SDK key only (see `docs/checklists/security.md`).
5. `Purchases.logIn(firebaseUid)` right after anonymous auth — RC app_user_id == Firebase UID (required for webhook→Firestore joins).
6. Entitlement check: `customerInfo.entitlements.active["pro"]`; subscribe to customer-info update listener. ALL of this lives in the single PurchasesService wrapper (forbidden pattern otherwise).
7. Prefetch offerings at onboarding start (`docs/playbooks/onboarding.md`).

## Testing ladder

1. **StoreKit Configuration file** (`Products.storekit` in the Xcode scheme): simulator purchases, no network/ASC. Expo: works via `expo run:ios`; note `expo prebuild` regenerates the project — re-attach via config plugin or documented script. [verify best current mechanism when implementing]
   Skipping this step and only testing the paywall against a live RevenueCat/StoreKit
   network call (no local config) means the offerings-load failure/timeout path — the exact
   scenario App Review hit in the 2.1(b) rejection above — never gets exercised locally
   before it ships. Set up the StoreKit config file even for a custom paywall.
2. **Sandbox:** ASC sandbox tester, set in Settings → App Store → Sandbox Account. Renewals accelerated (≈1 month → 5 min). Test EVERY package + Restore on fresh install.
3. **TestFlight:** production keys, sandbox billing; verify the remote paywall config renders.

## Automation split

| Claude automates | Human does |
|---|---|
| PurchasesService wrapper, paywall integration, funnel events, compliance block copy, StoreKit config file, sandbox test scripts, exit-intent offering logic | Creates ASC products/prices + RC dashboard config; runs sandbox purchases on device; approves price points; starts/stops Experiments |
