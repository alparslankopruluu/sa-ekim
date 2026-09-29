# App Store Growth Operations

*Read this before Custom Product Pages, Product Page Optimization, App Store growth
creative, In-App Events, tags, or any product-page experiment. Last verified:
2026-08-09.*

This is the canonical App Store growth contract. `store-listing.md` owns the default
listing, `store-assets` builds release-candidate assets, `app-store-connect.md` owns ASC
transport, and this playbook owns audience variants, experiments, and readback.

## Apple truth contract

All metadata and creative must represent features available in the exact uploaded build.
Use real app UI and fictional, anonymized, or consented data. Every surface must be
suitable for a 4+ audience even if the app's age rating is higher. Do not place prices,
discounts, URLs, other-platform logos, Apple awards/recognition marks, unverifiable claims,
or implied Apple endorsement in screenshots, previews, or growth creative. Localize the
claim, visible UI, cultural context, and deep-link destination together.

The first two screenshots answer two different install questions: what outcome the app
creates, then how the user reaches it. The third proves the core loop in genuine UI.
Headers, search-result creative, previews, and event cards must preserve that same product-
page narrative rather than becoming disconnected ads.

Sources: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/),
[asset best practices](https://developer.apple.com/app-store/asset-best-practices/), and
[product pages](https://developer.apple.com/app-store/product-page/).

## Icon contract

Prefer Icon Composer only after confirming the installed macOS, Xcode, and Icon Composer
versions support the target. Validate Default, Dark, and Mono appearances, transparent
layer behavior, small-size legibility, and the Xcode asset integration in a real build.
Never pre-round the icon. If the toolchain is unavailable or integration cannot be proven,
keep the deterministic fallback: one opaque 1024x1024 sRGB marketing icon without alpha,
text, device imagery, or tiny detail.

Source: [Icon Composer](https://developer.apple.com/icon-composer/).

## Custom Product Pages (CPP)

- Maximum plan size: 70 pages per app.
- One distinct audience intent and keyword/creative combination per page; do not clone the
  default page with cosmetic changes.
- On iOS 18 and later, use a verified deep link into the matching experience when useful,
  with a safe fallback for older OS versions and unavailable content.
- CPPs may be surfaced for assigned App Store search keywords as well as through their URL
  and Apple Ads. Do not describe them as URL-only.
- Instrument page ID -> install/open -> activation -> purchase/retention so the page can be
  measured beyond conversion alone.

Source: [Custom Product Pages](https://developer.apple.com/app-store/custom-product-pages/).

## Product Page Optimization (PPO)

Run PPO only when the app is Ready for Distribution. Use control plus no more than three
treatments, change one variable, and pre-register the primary metric, traffic allocation,
minimum sample, duration, and stop/rollback conditions. Icon variants must ship in the
binary. Read results back before a decision; a winner is never applied automatically.

Source: [Product Page Optimization](https://developer.apple.com/app-store/product-page-optimization/).

## 2026 creative surfaces

Prepare Asset Library exports, product-page header, search-result creative, and preview-
tool manifests now, but treat them as local preview artifacts while Apple labels them as
coming in a future fall release. Upload/apply stays disabled until the installed `asc`
proves the exact command and schema through live `capabilities`, `schema`, or `help`.

Apple Figma templates stay external. Record the official URL, selected local absolute
path, SHA-256, export manifest, dimensions, locales, and version/build. Deduplicate inputs
by hash and never commit or vendor Apple's `.fig` file.

Source: [What's new for apps](https://developer.apple.com/app-store/whats-new/).

## Blueprint and experiment record

Every new-app/factory-run blueprint records:

1. one-sentence product-page narrative;
2. distinct benefits for screenshots one and two;
3. launch and extended locales;
4. CPP audience, intent/keyword, creative, deep link, and analytics mapping;
5. PPO hypothesis, variable, metric, sample, duration, and stop condition;
6. a credible In-App Event opportunity or explicit `not applicable` reason;
7. header/search-result creative concept and preview-only status.

Persist live experiments in `docs/growth-plan.md`. Generated artifacts and readbacks live
under ignored `.factory/app-store-growth/` with an immutable manifest.

## Build metadata readback

A release/growth report identifies exact version and build, Processing/Failed/Complete
state, and every Complete-state warning. It records per-device variant download/install
sizes, flags any 200 MB cellular-download concern, verifies minimum OS and device
requirements, and reports dSYM availability. Do not infer this from Xcode build success;
read the uploaded build metadata from App Store Connect.

Source: [View builds and metadata](https://developer.apple.com/help/app-store-connect/manage-builds/view-builds-and-metadata).

## Automation boundary

Planning, local preparation, validation, and read-only measurement are safe. Creating or
updating CPPs, starting/stopping PPO, uploading creative, publishing an event, assigning
tags, changing availability, spending on Apple Ads, or submitting for review requires a
fresh exact approval and post-write readback. `asc` is the iOS store transport authority.
