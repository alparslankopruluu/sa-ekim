# Design — the top-tier UI bar

*Read this when: building or restyling any screen or component. Visual layer only — flow rules live in the referenced playbooks.*

Apple HIG reference index — which Apple page to consult when, plus the kit's platform decisions: `docs/playbooks/apple-hig.md`.

## Design principles (the lens for every decision below)

- **Purpose:** make something meaningful — focus on the few things that matter most, make those great.
- **Agency:** let people do things their own way — stay out of the way, keep actions reversible.
- **Responsibility:** act in people's best interest — earn trust via safety, privacy, transparency.
- **Familiarity:** build on what people already know — reuse established patterns consistently.
- **Flexibility:** adapt to diverse contexts — accessibility and varied inputs from day one, not bolted on.
- **Simplicity:** be clear and direct — include only what's necessary, establish clear hierarchy.
- **Craft:** care about every detail — quality sets the tone; iterate until it's right, not just shipped.
- **Delight:** make it human — know the emotion you want to evoke; never let decoration override purpose.

## Design direction (project-specific — filled by /new-app)

<!-- This block doubles as Stitch input (upload_design_md) and as the App Review 4.3
     template-spam mitigation (docs/checklists/release.md): every kit app must look distinct. -->

- **Personality:** {{ADJECTIVE_1}}, {{ADJECTIVE_2}}, {{ADJECTIVE_3}}
- **Reference apps:** {{REF_APP_1}}, {{REF_APP_2}} <!-- 2–3; add as needed -->
- **Tokens** (semantic, with dark variants): `bg`, `surface`, `primary`, `accent`, `danger` colors · type scale (display/title/body/caption) · spacing scale (4-based) · radius scale · motion personality (restrained/crisp/playful) + approved delight moments (rare only).
- **Token home:** Expo RN → `tailwind.config.ts` (NativeWind theme) · SwiftUI → `App/Core/DesignTokens.swift` (Color/Font/CGFloat extensions).
- **Out of scope by default:** Apple Wallet passes, Apple Pay checkout, Widgets, Siri Shortcuts/App Intents, Spotlight indexing, App Clips, Snippets — RevenueCat subscriptions cover monetization and a single core screen covers the MVP. Only build one of these if a future milestone explicitly adds it (log in `docs/decisions.md`); consult the relevant HIG page fresh at that point rather than a stale kit summary.

## Component foundation

- **Expo RN default:** NativeWind (styling) + react-native-reusables (headless components you own, styled from tokens). Tamagui is the documented alternative for strict-design-language/perf-critical apps — chosen at kickoff, logged in `docs/decisions.md`, never mixed.
- **SwiftUI:** native controls + token extensions; Pow (SPM) for delight effects (success sparkles, transitions).
- **Liquid Glass (current system material):** standard SwiftUI components (`Button`, `Toggle`, `NavigationStack`, `TabView`, `.toolbar`, `.sheet`) adopt it for free — never override toolbar/tab-bar/sheet backgrounds or the default scroll-edge-effect style; only add a custom edge effect over genuinely floating content, never stack two. Prefer `.glass`/`.glassProminent` button styles over hand-rolled glass; wrap a truly custom glass control in `GlassEffectContainer`, used sparingly.
- **App icons:** layered design (background + foreground, vector layers preferred), no transparency, avoid text except an essential mark. Use Icon Composer only after verifying the installed macOS/Xcode/tool path, Default/Dark/Mono appearances, small-size legibility, and Xcode integration. Otherwise use one opaque 1024×1024 sRGB marketing fallback. The system masks corners; never pre-round.
- **SF Symbols:** match weight/scale to adjacent text, outline in lists/toolbars, filled in tab bars — never for photorealistic content.
- **Rule (forbidden pattern):** no raw hex colors or magic spacing/font values in screens — tokens only.

*Source: developer.apple.com/design/human-interface-guidelines (app-icons, sf-symbols); WWDC25 "Meet Liquid Glass"; Adopting Liquid Glass; scroll-views.*

## Color

- Semantic/dynamic colors only — never hardcode Apple's documented RGB values (they change release to release); route everything through the token homes above.
- Every custom color needs light + dark + increased-contrast variants — even single-appearance apps ship both light/dark values, required for Liquid Glass adaptivity.
- **Liquid Glass has no inherent color by default** (it picks up the content behind it). Apply color sparingly — mainly to ONE primary action's background (e.g. the paywall CTA), never to multiple controls at once; prefer a monochromatic toolbar/tab bar over a colorful background.
- Never rely on color alone to convey state — pair with shape, icon, or text (colorblind-safe).
- Mind cultural color connotations in localized markets (e.g. red ≠ danger everywhere) — `docs/playbooks/localization.md`.

*Source: developer.apple.com/design/human-interface-guidelines/color.*

## Motion & haptics

- Prefer platform-native springs for meaningful state changes; deterministic feedback stays short.
  High-frequency actions may remain instant/subtle. Press feedback, navigation, list insertion,
  and success moments animate only when they improve feedback or continuity.
- **Expo RN:** reanimated worklets only (UI thread). **SwiftUI:** spring animations + Pow effects.
- Haptics on: core-action success, purchase success, destructive confirmations, selection changes. **Expo RN:** `expo-haptics` · **SwiftUI:** `.sensoryFeedback`.
- Respect Reduce Motion: tighten spring bounce, avoid z-axis/depth transitions, replace positional motion with cross-fades. Money-path jank budget: `docs/checklists/performance.md`.
- Motion/gesture/haptic changes follow `docs/checklists/motion-quality.md`; run
  `/motion-review` before `/ship` when a release diff touches those surfaces.

## Screen patterns (visual layer — flow stays in the playbooks)

- **Launch screen:** must be visually identical to the app's first screen (same background color, orientation, appearance) — no logo, no text, no spinner. A branded splash, if any, lives inside onboarding, never as the launch screen.
- **Onboarding:** one focal element per screen, visible progress (layout → Layout & Reachability below). Flow/analytics → `docs/playbooks/onboarding.md`.
- **Sign in with Apple = account-linking moment, never an onboarding wall** (auth ladder → `docs/playbooks/firebase.md`). Official button only — min 140×30pt (44pt height recommended), margin ≥1/10 of height, white/outline/black variant by background contrast; mandatory if any other social login exists.
- **Paywall:** hero → plan cards (annual pre-selected) → CTA → compliance block. Pricing/compliance → `docs/playbooks/paywall.md`.

*Source: developer.apple.com/design/human-interface-guidelines (launching, sign-in-with-apple).*

## Layout & reachability

- Extend backgrounds/content to the screen edges; respect safe areas and system margins — avoid full-width buttons that ignore the device's curvature.
- Put primary actions in the thumb-zone (middle/bottom of the screen) for comfortable one-handed reachability — this is why the paywall CTA and onboarding "Next" sit low, not at the top.
- Support both orientations unless there's a clear reason not to (e.g. a game); if landscape-only, it must work rotated either direction.

*Source: developer.apple.com/design/human-interface-guidelines/layout.*

## Polish bar — Definition of Done for every screen

The planned screen, required states, analytics, accessibility, and acceptance proof must
first exist in `docs/product-map.md`; a polished out-of-scope screen is still scope drift.

- [ ] Dark mode designed, not auto-inverted — contrast ≥4.5:1 (≤17pt, any weight) or ≥3:1 (≥18pt, or any bold text); re-check with Increase Contrast on
- [ ] Empty / loading / error states designed (skeletons, not default spinners)
- [ ] Dynamic Type survives at the largest size
- [ ] Hit targets ≥44×44pt (HIG's absolute floor is 28×28pt — don't design to the floor); ~12pt padding around bezeled controls, ~24pt around unbezeled
- [ ] Primary action has haptic + animation
- [ ] Full accessibility pass done for anything interactive/custom — `docs/checklists/accessibility.md`

*Source: developer.apple.com/design/human-interface-guidelines/accessibility.*

## The gotcha screen is a billboard

The gotcha screen (`{{GOTCHA_SCREEN}}` in `docs/product-map.md`) will be watched inside
someone else's phone video, at thumbnail size, with the sound off — design it like a
billboard, because functionally that is what it is.

- **5-second sound-off test:** a stranger watching a 5-second screen recording with no
  audio must understand the value. If the payoff needs three taps or a caption, the
  screen fails regardless of how good the creator promoting it is.
- **Street test:** hand the phone to someone who has never seen the app and watch them
  use it screen by screen without guiding or explaining. Where they stall or look
  confused is the fix list; help them through, keep watching, write it down.

## Inspiration workflow (MCPs — skip any that isn't connected; never block on one)

1. **Mobbin MCP:** search real shipped screens for this pattern (onboarding, paywall, empty states) before inventing one. Copy proven patterns for standard surfaces (onboarding, settings, paywalls); spend the taste budget on the gotcha screen — that is where differentiation must be visible.
2. **Stitch MCP:** generate the **full screen inventory as one coherent system up front** (not screen-by-screen) from this file's Design Direction block; adapt output to the tokens — never paste code that bypasses the component foundation. Make cross-screen changes by editing tokens once (they propagate everywhere), not per-screen — this is how consistency holds. Hosted "prompt → screens + native code" generators (FireVibe-style) market this same workflow, but the kit doesn't default to one: Claude writing native code directly against this block avoids export/lock-in friction and keeps a single source of truth. [verify traction before adopting any such vendor]
3. **Figma MCP:** when a design file exists, pull exact values (`get_variable_defs` / `get_design_context`) instead of eyeballing.
4. **AI image generation (dev-time only):** for a cohesive onboarding/marketing illustration set, use OpenAI image tooling or fal.ai's GPT Image 2.5 endpoints (`openai/gpt-image-2.5/flare/text-to-image` for the default, `.../sunburst/text-to-image` for extra detail, plus the matching `/edit` endpoints) with a shared style prompt drawn from this file's Design Direction block for consistency. Generate once, review it, and bundle as static assets — no runtime API call or Cloud Function proxy needed for generic (non-personalized) illustrations. For a per-user media feature, read `docs/playbooks/ai-media.md` and use the security proxy pattern.

Fallback with no MCPs: the patterns above + reference apps' store screenshots.

## Automation split

| Claude automates | Human does |
|---|---|
| Token files, component foundation setup, motion/haptic wiring, dark mode + state variants, MCP-driven drafts | Picks personality + reference apps, approves the design direction, judges "does it feel premium" on device |
