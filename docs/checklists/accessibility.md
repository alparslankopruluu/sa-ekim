# Accessibility

*Read this when: building any interactive screen or custom component, and at every `/ship` run.*

## Vision

- Support Dynamic Type up to 200% enlargement (iOS default body size 17pt, minimum 11pt) — adopt Dynamic Type directly, or scale a custom UI proportionally.
- Contrast (HIG's AA table): text/icons ≤17pt at **any weight** → ≥4.5:1. Text ≥18pt (any weight) **or bold at any size** → ≥3:1 — bold/larger text needs *less* contrast, not more. Ship a higher-contrast variant for Increase Contrast; verify in both light and dark.
- Never rely on color alone to convey state — pair with shape, icon, or text (red/green and blue/orange are the common colorblind failure pairs).
- Prefer system/semantic colors — they auto-adapt to Increase Contrast and light/dark for free.
- Every interactive element and icon-only control needs a VoiceOver label — no unlabeled tap targets.

## Hearing

- Never convey essential info through audio alone — provide on-screen captions/subtitles or a text equivalent for any narrated content.
- Pair audio cues (success chime, error sound) with haptics for anyone who can't hear them or has sound off.
- Add a visual cue alongside any audio cue that points to something off-screen or non-obvious.

## Mobility

- Control size: 44×44pt default, 28×28pt absolute minimum (iOS/iPadOS). Padding: ~12pt around bezeled controls, ~24pt around unbezeled.
- Prefer simple, standard gestures over custom multi-finger gestures for anything done frequently.
- Every swipe-only action needs a tap alternative — e.g. swipe-to-delete also needs an Edit-mode delete button; gestures alone exclude people with limited dexterity.
- Label elements properly for Voice Control and Switch Control; verify with Accessibility Inspector before release.

## Speech & interaction

- Support Full Keyboard Access for anyone navigating with an external keyboard; never override system-defined keyboard shortcuts.

## Cognitive

- Never auto-dismiss important UI on a timer alone — pair with an explicit dismiss action.
- Respect Reduce Motion (`docs/playbooks/design.md`) and Dim Flashing Lights for any video/animation content.
- **Require double confirmation for destructive, hard-to-reverse actions** (e.g. account deletion — `docs/playbooks/firebase.md` step 6) — one confirm is not enough.
- Keep flows simple and escapable; avoid locking people into a sequence they can't exit.

## Web (WCAG 2.2 AA)

*Applies to the web stack (`docs/stack/web.md`). The native rules above stay authoritative for app screens; these replace the platform-specific ones for a browser surface.*

- **Semantics first:** one `<h1>` per page, headings in order with no skipped levels, real landmarks (`header`/`nav`/`main`/`footer`), lists as lists, buttons as `<button>` and links as `<a>` — never a clickable `<div>`. An ARIA attribute is a last resort after the right element.
- **Keyboard:** every interactive element reachable and operable by keyboard in DOM order; a visible focus indicator that meets the 3:1 non-text contrast rule (never `outline: none` without a replacement); a skip-to-content link; focus moves into a dialog on open and returns to the trigger on close; no keyboard trap.
- **Targets:** 24×24 CSS px minimum (WCAG 2.2 *Target Size (Minimum)*), 44×44 preferred for anything touched frequently.
- **Text:** body ≥16px, resizable to 200% without loss of content or horizontal scrolling; contrast 4.5:1 for normal text and 3:1 for large text and UI/graphical components.
- **Forms:** every input has a persistent visible `<label>` (placeholder is not a label); errors are announced, described in text, and point at the field; do not re-ask for information already given in the same flow (WCAG 2.2 *Redundant Entry*).
- **Media and motion:** meaningful images have alt text and decorative ones have `alt=""`; video has captions; honour `prefers-reduced-motion`; no content flashes more than three times per second.
- **Verify before ship:** axe or Lighthouse a11y pass with zero criticals, one full keyboard-only run through the primary flow, and a screen-reader spot check (VoiceOver on Safari or NVDA on Firefox) of the core action.

## ASC Accessibility Nutrition Labels

Declare the accessibility features your app actually supports (VoiceOver, Voice Control, Larger Text, Sufficient Contrast, etc.) at submission — keep in sync with what's actually true; cross-checked in `docs/checklists/release.md`'s pre-submission table.

## Automation split

| Claude automates | Human does |
|---|---|
| VoiceOver labels, Dynamic Type support, contrast checks against tokens, tap alternatives to gestures, double-confirm flows for destructive actions | Real-device testing with VoiceOver/Voice Control/Switch Control on; ASC Accessibility Nutrition Label submission |

*Source: developer.apple.com/design/human-interface-guidelines/accessibility.*
