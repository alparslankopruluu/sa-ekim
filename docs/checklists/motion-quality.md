# Native Motion Quality

*Read when changing animation, transition, gesture, sheet, drag/swipe, or haptic feedback; run `/motion-review` before `/ship` when the release diff touches those surfaces.*

This is a native adaptation inspired by Emil Kowalski’s MIT-licensed
[`review-animations`](https://github.com/emilkowalski/skills/tree/main/skills/review-animations)
skill. It is not a CSS rulebook and does not prescribe web timing curves for iOS.

## Motion intent

- Every motion has one job: direct feedback, state change, spatial continuity,
  explanation, or a rare/meaningful delight moment. Delete decorative motion that has
  no job.
- Frequent actions remain instant or nearly imperceptible; core repeated actions do not
  become slower because they animate. Onboarding, first success, and a meaningful save
  may use approved delight.
- Motion, haptics, typography, color, and tokens must match the approved motion
  personality in `docs/playbooks/design.md`; bounce is exceptional, not a default.
- Never block taps, gestures, navigation, or accessibility focus while a transition runs.

## SwiftUI

- Scope animation with `.animation(_:value:)` or a targeted `withAnimation`; do not put
  an unbounded/global `.animation` high in the view tree.
- Use springs for interruptible gesture-driven sheets, drags, swipes, and dismissals;
  begin from the current presented state and preserve the gesture’s direction/velocity
  through the native interaction whenever the platform API supports it.
- Use short, restrained timing for deterministic feedback. Do not add bounce to menus,
  repeated list updates, or money-path UI without a documented reason.
- Read `@Environment(\.accessibilityReduceMotion)` and replace positional/elastic motion
  with a short opacity or state transition while retaining comprehension.
- Trigger `.sensoryFeedback` at the causal success, commit, warning, error, or snap—not
  as decoration and not before the underlying state changes.
- Avoid large repeated `blur`, continuous timelines, full-screen loops, broad implicit
  layout animation, and expensive `matchedGeometryEffect` use in scrolling/hot paths.

## Expo React Native

- Use Reanimated shared values/worklets and `useAnimatedStyle` for interactive motion;
  do not use JS-thread `Animated` on the core loop, onboarding, paywall, list, or drag.
- Use `withTiming` for deterministic feedback and `withSpring` for interruptible,
  gesture-driven motion. Cancel/re-target prior motion rather than queueing visual state.
- Honor Reanimated `useReducedMotion` (or the app’s accessibility bridge) by removing
  position/bounce while preserving brief opacity/state feedback.
- Use `expo-haptics` only at the action’s causal completion. Keep haptic intensity and
  frequency proportional to the product’s motion personality.
- Avoid layout animations in long/virtualized lists, worklets that allocate/bridge on
  every frame, perpetual decorative loops, and animated blur/image effects on hot paths.

## Required review evidence

1. Name the motion’s purpose and how often it occurs.
2. Show normal and Reduce Motion behavior on a real device/simulator for every core flow.
3. Exercise interrupted gestures, repeated taps, slow device/list scroll, dark mode, and
   Dynamic Type when the motion touches those states.
4. Record any deliberate exception, reason, and expiry in `docs/decisions.md`.

## Verdict

Block: unexplained/high-frequency motion, blocked interaction, missing reduced-motion
behavior, JS-thread core-flow animation, layout/jank risk with a direct safer path, or
motion/haptics that misrepresent state. Approve only after all relevant evidence exists.
