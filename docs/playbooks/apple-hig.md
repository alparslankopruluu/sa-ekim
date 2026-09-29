# Apple HIG — practical index

*Read when: making an Apple-platform visual or UX decision and you need the right Apple source page at the decision point. The visual bar and the project Design Direction block live in `docs/playbooks/design.md`; this file is only the index.*

## Rule

Consult the live Apple page at the moment of the decision. Any summary — including this one — goes stale the day Apple ships a new OS; the page is the source of truth. `docs/playbooks/design.md` owns the visual bar and the per-project Design Direction block. The kit positions below are defaults for scoping, not a license to override the HIG.

## How to use this index

1. Find the decision in the table below.
2. Open the named Apple resource live — do not trust this file for current rules.
3. Apply the kit note for scope. If the project Design Direction disagrees, `docs/playbooks/design.md` wins on visuals and the HIG wins on platform behavior.

## Kit positions this index assumes (owned by `docs/playbooks/design.md`)

- **Native controls first** — custom only when the system surface genuinely cannot do the job.
- **Correct glass usage** — never override or stack system materials; standard components adopt the current material for free.
- **Tokens only** — no raw hex colors or magic spacing/font values in screens.
- **Do not over-build out-of-scope Apple surfaces** (Wallet passes, Apple Pay checkout, Widgets, Siri Shortcuts/App Intents, Spotlight indexing, App Clips, Snippets). Add one only when a milestone explicitly does, log it in `docs/decisions.md`, and consult the page fresh at that point.

## Decision → Apple resource → kit note

| Decision | Apple resource | Kit note |
|---|---|---|
| Starting a design / choosing a design pathway | Apple "Design" landing and its platform design-pathway pages | Set the `docs/playbooks/design.md` Design Direction block first, then pick the pathway; the HIG is the contract underneath |
| iOS conventions | HIG — iOS | Baseline assumptions; verify current rules before shipping |
| iPadOS conventions | HIG — iPadOS | Only if the app ships iPad, and only if the layout is genuinely adapted |
| macOS conventions | HIG — macOS | Only for a Mac target named in the blueprint |
| watchOS conventions | HIG — watchOS | Only for a Watch target; small-screen rules differ from iOS |
| visionOS conventions | HIG — visionOS | Only for a spatial target; glass and depth behavior are central |
| tvOS conventions | HIG — tvOS | Only for an Apple TV target; focus and 10-foot layout differ |
| Current system material | WWDC25 "Meet Liquid Glass"; "Adopting Liquid Glass" | Standard SwiftUI controls (`Button`, `Toggle`, `NavigationStack`, `TabView`, `.toolbar`, `.sheet`) adopt it for free; never override toolbar/tab-bar/sheet backgrounds or the scroll-edge effect; prefer `.glass`/`.glassProminent`; one custom edge effect only, never stacked |
| App icons | HIG app-icons; Icon Composer; layered icon (background + foreground); Default / Dark / Mono appearances | Layered, no transparency, avoid text except an essential mark; the system masks corners — never pre-round. Use Icon Composer only after verifying the installed macOS/Xcode/tool path, appearances, small-size legibility, and Xcode integration; otherwise one opaque 1024×1024 sRGB marketing fallback |
| UI iconography | SF Symbols — weights and scales, outline vs filled | Match weight/scale to adjacent text; outline in lists/toolbars, filled in tab bars; never for photorealistic content |
| Design files and handoff | Apple Design Resources for Figma / Sketch | Use them for native-control reference. Pull exact values via Figma MCP when a file exists (`get_variable_defs` / `get_design_context`); never eyeball or bypass tokens |
| Accessibility | HIG accessibility; VoiceOver, Dynamic Type, contrast, Reduce Motion | 44×44pt targets (HIG floor 28×28pt — don't design to it); Dynamic Type to the largest size; ≥4.5:1 (small) / ≥3:1 (large or bold) contrast; honor Reduce Motion. Full pass → `docs/checklists/accessibility.md` |
| Native components, kits, templates | Apple Design Resources (UI kits, glyphs, templates) | Reference for native controls only — never hand-roll a system surface that already exists |
| Wallet passes | Pass Designer | Out of scope by default; only if a future milestone adds passes, then design fresh and log in `docs/decisions.md` |
| 3D / spatial content | Reality Composer Pro | Only for a spatial/visionOS or 3D milestone. Web 3D has its own path → `docs/playbooks/web-3d.md` |
| Craft inspiration | Apple design videos; Apple Design Awards | Calibration and inspiration only. An award is not proof this app is good, and awards are never claimed or shown in metadata |

## Resources at a glance

| Resource | Use it for |
|---|---|
| Human Interface Guidelines (HIG) | The per-platform contract — rules and behavior for each Apple OS |
| Apple Design Resources | Figma/Sketch component kits, templates, glyphs, icon templates |
| Icon Composer | Authoring layered app icons with Default/Dark/Mono appearances |
| SF Symbols app | Browsing, weighting, and scaling system symbols |
| Liquid Glass sessions (WWDC25) | Current system material behavior and adoption rules |
| Pass Designer | Wallet pass layouts — out of scope unless a milestone adds them |
| Reality Composer Pro | Spatial/3D authoring — out of scope unless a milestone adds it |
| Apple design videos / Design Awards | Craft inspiration and calibration, never a quality claim |

## Read this when — quick list

- **Starting a design or choosing a pathway:** before any screen work — set the `docs/playbooks/design.md` Design Direction block first.
- **Choosing an Apple platform target:** when the blueprint lists more than iPhone — read that platform's HIG page, not the iOS one.
- **iPad support:** only if the layout is genuinely adapted — a weak iPad UI costs reviews and time.
- **Touching a system surface (toolbar, tab bar, sheet, scroll edge):** before styling — confirm current Liquid Glass behavior.
- **App icon work:** before generating or shipping icons — confirm layered/appearance requirements and mask behavior.
- **Choosing an SF Symbol or its variant:** when picking or weighting an icon — outline vs filled is usage, not taste.
- **Preparing Figma / Sketch handoff:** when a design file exists — Apple Design Resources plus Figma MCP for exact values.
- **Accessibility pass:** before `/ship` on any interactive or custom surface — VoiceOver, Dynamic Type, contrast, Reduce Motion.
- **Wallet pass work:** only when a milestone explicitly adds passes — otherwise out of scope.
- **Spatial / 3D work:** only when a milestone explicitly adds it — otherwise out of scope.
- **Looking for inspiration:** when calibrating craft — treat videos and awards as reference, never as a quality claim.

## Trademarks and "for iPhone" phrasing

Apple trademark rules, "for iPhone" / "compatible with" phrasing, official badge usage, and screenshot rules live in `docs/playbooks/store-listing.md`. Do not restate or improvise them here.

*Source: Apple's Human Interface Guidelines, Apple Design Resources, and WWDC25 Liquid Glass sessions. Resources are named without deep links on purpose so the reader opens the live page.*
