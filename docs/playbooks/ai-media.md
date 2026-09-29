# AI media & provider connections

*Read this when: an app generates or edits media, or when connecting fal.ai, GPT Image 2, RevenueCat MCP/OAuth, or Firebase provider tooling.*

## Product decision first

Choose the provider from the product requirement, not novelty:

| Need | Default |
|---|---|
| Static onboarding/store artwork generated once during development | OpenAI image tooling or fal.ai; review, optimize, and bundle assets |
| Per-user image generation or editing | fal.ai server-side through Firebase Functions; Model B credits unless economics prove otherwise |
| Purchases, entitlements, offerings, catalog | RevenueCat SDK in-app + RevenueCat MCP/OAuth for operator catalog work |
| Product funnel, stability, performance | Firebase Analytics, Crashlytics, and Performance Monitoring |

Do not add runtime AI merely to decorate onboarding. A static asset is faster, cheaper, offline-safe, and reviewable.

## Credential and MCP connection protocol

The agent may ask the operator to **run a local command that enters a key directly**, but must never ask them to paste a key, bearer token, cookie, webhook secret, or private key into chat. Do not put secrets in `app-intake.md`, `.factory`, a committed `.env`, the operator profile, or MCP configuration committed to the app.

1. Run `/connect-providers` after `/factory-setup`, or before the first task that needs a provider.
2. The command inventories connected MCPs and existing CLI/OAuth sessions without printing values.
3. For RevenueCat, prefer its OAuth MCP login. The human completes the browser/terminal authorization; the agent runs a read-only project/catalog listing afterward.
4. For fal.ai, the human exports `FAL_KEY` in their terminal for the current session or adds it directly to the Firebase Secret Manager prompt when deploying the Function. The agent verifies only presence and a redacted health result.
5. For Firebase, use `firebase login:list`, then check Analytics DebugView, Crashlytics, and Performance Monitoring as M0 evidence.
6. A missing optional provider creates a precise `waiting_human` card; it never silently downgrades a paid runtime feature.

MCP setup is user-level harness configuration, not an app dependency. Show the exact config diff and obtain approval before adding or changing an MCP server. A provider MCP never authorizes billing, catalog mutation, production deploys, or a wider factory blueprint.

Full endpoint and schema catalog (GPT Image 2.5 + MiniMax H3/H3 Max): `docs/playbooks/media-models.md`.

## fal.ai image models — GPT Image 2.5

Use `@fal-ai/client` only on a trusted server/Function or a developer workstation. Never configure it with `FAL_KEY` in SwiftUI, Expo, Vite, Remote Config, or an `EXPO_PUBLIC_*` variable.

OpenAI's GPT Image 2.5 is available on fal in two variants with the same inputs:

- **Flare** — the default; faster, natural lighting, complex layouts.
- **Sunburst** — precision-focused; spends longer for finer detail. Use it when the image will be viewed large or cropped into.

Four endpoints (verify current IDs and schema at implementation time):

- Generate: `openai/gpt-image-2.5/flare/text-to-image`, `openai/gpt-image-2.5/sunburst/text-to-image`
- Edit: `openai/gpt-image-2.5/flare/edit`, `openai/gpt-image-2.5/sunburst/edit`

Editing accepts up to 16 reference images and an optional mask, and holds the subject across successive revisions. Generation accepts a prompt, image size, quality (`auto`/`low`/`medium`/`high`/`xhigh`/`max`), `num_images`, and `output_format` (`png`/`jpeg`/`webp`); `output_compression` applies to jpeg/webp. Presets are `square`, `square_hd`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`, or `auto`; custom dimensions must follow the provider's current limits. Keep output to one image unless the approved credit model charges for alternatives. The OpenAI Images API itself currently lists `gpt-image-2` (a dated `gpt-image-2-2026-04-21` pin exists); the `2.5` Flare/Sunburst variants are the fal naming — treat the exact model string as verify-at-implementation, not a fixed assumption.

fal also lists GPT Image 2, Nano Banana 2/Pro, GPT Image 1.5, Flux 2, Seedream, Qwen Image, and Grok Imagine. Choose from the product requirement, and keep the same server-only + review discipline.

For an interactive request: validate the prompt and reference-image ownership, reserve a credit in one transaction, submit an idempotent job, store only minimal job metadata, and release/refund the reservation on terminal failure. Prefer fal queue + webhook for long jobs; verify webhook authenticity before any state change. Polling must be bounded, cancellable, and visible in the UI. Upload only user-authorized files; use short-lived/private Storage URLs where possible.

### Function shape

```ts
// Server-only. FAL_KEY is a Firebase Secret Manager secret, never client config.
const result = await fal.subscribe("openai/gpt-image-2.5/flare/text-to-image", {
  input: { prompt, image_size: "portrait_4_3", quality: "high", num_images: 1, output_format: "png" },
});
// For edits: endpoint "openai/gpt-image-2.5/flare/edit" (or .../sunburst/edit) with image_urls / optional mask_url.
```

## fal.ai video models — MiniMax (H3 / H3 Max)

For AI-generated clips (marketing/social B-roll, concept motion), fal hosts MiniMax's H3 family. Same rule: `@fal-ai/client` only server-side or on a dev workstation; `FAL_KEY` never in client config.

- **MiniMax H3** (`minimax/h3/...`) — frontier multimodal video: 2K, 5–15s, native stereo audio. Endpoints: `minimax/h3/text-to-video`, `minimax/h3/image-to-video` (first/last frame), `minimax/h3/reference-to-video` (up to 9 images + 3 video + 3 audio references). A LoRA train/apply path exists for locking style or character.
- **MiniMax H3 Max** (`minimax/h3-max/...`) — fal's post-trained fast variant: 480p/768p, 5–15s at 24 fps, stronger prompt adherence; endpoints `minimax/h3-max/text-to-video`, `minimax/h3-max/image-to-video`, plus `minimax/h3-max/reference-to-video` (subject/style consistency), `minimax/h3-max/camera-controls` (keyframed camera-only move on a still), and `minimax/h3-max/director` (realtime WebRTC stream).
- Previous generation still available: `fal-ai/minimax/hailuo-2.3/standard|pro/{text,image}-to-video`, `fal-ai/minimax/hailuo-2.3-fast/...`, `fal-ai/minimax/hailuo-02/...`, and legacy `fal-ai/minimax/video-01`.

Full schema and observed pricing for every endpoint: `docs/playbooks/media-models.md`.

Pricing is per generated second and changes (promotional rates appear) — verify current pricing before budgeting and log cost per successful use in `PRODUCT.md` like any provider. Video jobs are long: use the fal queue + webhook, not an unbounded client poll.

**Compliance:** an App Store preview must be predominantly real, captured app footage (Apple rule) — AI-generated video is for social/ad/landing-page cuts only and must never imply a capability the app does not ship. See `docs/playbooks/marketing-video.md`.

### Before production (any fal media)

Before production, verify current fal input/output schema and pricing from official provider documentation, set `maxInstances`, rate limits, App Check enforcement, a per-user quota, and cost alerts. Generated media needs disclosure/moderation appropriate to the app category and must not imply a real capability that the app does not ship.

## Structured outputs and AI cost shape

For any schema-critical AI text feature (extraction, classification, structured
analysis), request schema-guaranteed output from the model API — on the Claude API use
`client.messages.parse()` or `output_config: {format: ...}`; the older top-level
`output_format` request parameter there is deprecated. Schema-guaranteed responses
eliminate the runtime JSON-parse failure class in production Functions: no regex repair,
no retry-on-malformed loops, no silently dropped fields.

Shape cost deliberately; margin is designed, not discovered:

- **Two-tier model split:** run high-volume extraction/classification on a small fast
  model (Haiku-tier) and reserve the frontier model for merging, reasoning, and
  synthesis. Volume work is small-model-shaped work.
- **Batch processing:** anything without a latency requirement (nightly digests,
  backfills, review mining at scale) goes through the provider's batch API at roughly
  half the interactive price.
- **Prompt caching:** keep the fixed instruction/schema prefix stable and put volatile
  user input last, so cached prefix reads stay cheap across calls.

Per-action unit cost must clear the gross-margin floor owned by
`docs/playbooks/monetization.md`; the cost-per-successful-core-action log required below
is the evidence that it does.

## Required evidence

- RevenueCat: OAuth/MCP or approved Keychain login, project/app/entitlement/offering readback.
- Firebase: DebugView event, Crashlytics test crash, Performance trace, and production privacy inventory.
- fal.ai: secret attached outside the repo, a dev-only sanitized success/failure probe, cancellation/failure refund test, and cost per successful core action logged in `PRODUCT.md`.

## Automation split

| Agent automates | Human does |
|---|---|
| Connection inventory, redacted doctor, Function/client wrappers, queue/webhook/idempotency tests, analytics and cost instrumentation | Completes OAuth, enters keys directly into terminal/provider console, approves MCP config changes, billing, and production provider actions |
