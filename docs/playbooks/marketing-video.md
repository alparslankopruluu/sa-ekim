# Marketing & App Store Preview Video

*Read this when: making an App Store preview video, or a social/ad promo video for the app.*

## When it's worth making one

- **App Store preview:** only AFTER screenshots are optimized (`docs/playbooks/store-listing.md`) — a preview replaces a screenshot slot in search, so a weak one lowers conversion.
- **Social / ad promo:** only if the app leans UGC/Ads distribution. For a pure-ASO app, screenshots + metadata do the heavy lifting — video is optional polish, not a priority (ASO-led indie apps can run ~70% margins with no video ad spend at all).

## The compliance divide (do not get this wrong)

- **App Store preview MUST be predominantly real, captured app footage** (Apple rule). Motion graphics can frame it — intro card, captions, zoom emphasis, device frame, outro — but generated animation cannot BE the whole preview, or it risks rejection and misrepresents the app.
- **Social / ad / landing-page promos have no such rule** — fully synthetic Remotion animation is fine there.

## AI-generated clips (fal MiniMax) — social/ad only

When you want motion that is not a screen recording — concept shots, stylized B-roll, an abstract intro — fal hosts MiniMax's H3 family:

- `minimax/h3/text-to-video`, `minimax/h3/image-to-video`, `minimax/h3/reference-to-video` (2K, 5–15s, native audio).
- `minimax/h3-max/text-to-video`, `minimax/h3-max/image-to-video` (faster 480p/768p at 24 fps).
- Previous generation still available: `fal-ai/minimax/hailuo-2.3/...`.

Same credential and job rules as all fal media: `@fal-ai/client` server-side or a dev workstation only, `FAL_KEY` never in client config, queue + webhook for long jobs, verify current per-second pricing. Full endpoint and credential detail lives in `docs/playbooks/ai-media.md`.

Hard rule: **never use AI-generated footage to stand in for the app UI.** It is fine for social/ad/landing-page cuts, but an App Store preview must stay predominantly real, captured app footage, and no cut may imply a capability the build does not ship. AI video is a garnish around real proof, not the proof.

## Remotion = the programmatic animation tool

React → real MP4, agent-native (Claude writes the composition as code). This is the kit's default video path.

- **You don't learn Remotion — the agent does.** Describe the video in plain language ("15s vertical promo, show the plant-scan flow, upbeat, end on the App Store badge"). The agent installs the Remotion Agent Skills, writes the React composition, wires captions/zoom/data, renders, and hands back the MP4. You only record real footage when needed and approve the result — you never touch the React code unless you want to.
- Install the official Agent Skills, then scaffold: `npx skills add remotion-dev/skills`, `npx create-video`.
- **License:** free for individuals and teams of ≤3 people, commercial use allowed — fine for a solo/indie dev. A paid Company License applies once the team is 4+. [verify at team growth]
- It's a **dev-time tool in its own project directory** — never an app dependency, never bundled into the shipped app, no runtime or MAU cost.
- **Render locally by default.** Remotion Lambda (cloud/bulk rendering) adds AWS setup + cost — out of scope for a solo dev unless generating many videos at once.

## In-app animated assets vs runtime animation (don't confuse them)

Remotion can produce animated **assets** you bundle in the app — an onboarding hero loop, a success celebration — exported as video / GIF / frame sequence. But true **runtime UI animation** (transitions, gestures, live state) stays native: reanimated (Expo RN) / SwiftUI (`docs/playbooks/design.md`). Rule of thumb: pre-rendered, non-interactive, always-the-same → Remotion asset is fine; responds to the user or app state → native animation, never a video.

## Pipeline

1. Capture real screen footage (screen recording per `docs/stack.md`; or drive the app through the money path).
2. Build a Remotion composition: captions, zoom/emphasis, device frame, branded intro/outro, synced to the Design Direction tokens (`docs/playbooks/design.md`) so it matches the app.
3. Export MP4 → **App Store preview** (real-footage-dominant, 15–30s per store-listing specs) or a **social cut** (free-form, platform aspect ratios).

For social cuts, start with the approved three-second hook and video-ready state from
PRODUCT.md. Produce a small, measurable variant set from real build footage: clean screen
recording, problem→solution, before→after, or a disclosed founder/user demo. Keep the
product proof identical while varying one hook or framing at a time. Posting cadence is
an experiment in `docs/growth-plan.md`, never a guaranteed formula.

Do not present the founder as an unrelated user, pretend to have discovered the app,
hide ownership inside a listicle, fabricate reviews/accounts, or imply results the build
cannot demonstrate.

## OpenReel & GUI editors — considered, not the default

Open-source browser video editors (e.g. OpenReel) exist for manual timeline editing. They're fine for a human who prefers hand-editing, but they're not agent-drivable the way Remotion is — so the kit's automated path stays Remotion. Reach for a GUI editor only when you specifically want to edit by hand.

## Automation split

| Claude automates | Human does |
|---|---|
| Scaffolds the Remotion project, writes compositions, wires captions/zoom/data, exports cuts | Records real app footage, approves creative, uploads the preview in ASC, provides a paid Remotion license if the team grows past 3 |
