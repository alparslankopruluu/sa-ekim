# AI Media Model Catalog

*Read when: generating or editing images/video, choosing between GPT Image 2.5 variants,
or calling a MiniMax H3 / H3 Max endpoint. This is the endpoint + schema reference;
`docs/playbooks/ai-media.md` owns the credential, cost, and product-decision rules.*

Endpoints and prices below were observed from provider documentation and **change often** —
verify the current model string, schema, and price at implementation time. This catalog is
not a pin; it exists so the agent does not need the docs pasted into chat again.

## Rule for every endpoint here

`@fal-ai/client` runs **server-side or on a dev workstation only**. `FAL_KEY` never appears in
SwiftUI, Expo, Vite, Remote Config, or an `EXPO_PUBLIC_*` variable. Long jobs use the fal
queue + webhook (or, for Director, a server-proxied WebRTC session), never an unbounded client
poll. Pricing is rounded to the nearest $0.0001.

## GPT Image 2.5 (image) — `openai/gpt-image-2.5/*`

OpenAI's GPT Image 2.5 is exposed on fal in two tunings with the same input schema:

- **Flare** — default; faster, natural lighting, complex layouts.
- **Sunburst** — precision; spends longer for finer detail (large/cropped images).

| Mode | Endpoints |
|---|---|
| Generate (text-to-image) | `openai/gpt-image-2.5/flare/text-to-image`, `openai/gpt-image-2.5/sunburst/text-to-image` |
| Edit (image-to-image) | `openai/gpt-image-2.5/flare/edit`, `openai/gpt-image-2.5/sunburst/edit` |

### Input schema

Text-to-image:

| Field | Notes |
|---|---|
| `prompt` | the generation prompt |
| `image_size` | preset, explicit `{width, height}`, or `auto`. Presets: `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`, `auto`. Default `landscape_4_3`. Concrete sizes: both dims multiples of 16, max edge 3840px, aspect ratio ≤ 3:1, total pixels 655,360–8,294,400 |
| `background` | `auto` (default) / `transparent` / `opaque` |
| `quality` | `auto` / `low` / `medium` / `high` (default) / `xhigh` / `max`; higher = more detail, latency, and cost |
| `num_images` | default 1 |
| `output_format` | `jpeg` / `png` (default) / `webp` |
| `output_compression` | 0–100, only for jpeg/webp |
| `sync_mode` | true returns a data URI and keeps nothing in request history |
| `partial_images` | streaming variants only; default 3, each partial adds 100 output image tokens |

Edit adds:

| Field | Notes |
|---|---|
| `image_urls` | up to **16** reference images |
| `mask_url` | optional; what part of the image to edit |
| `image_size` | default `auto` (inferred from the input images) |

Output (both): `images` → list of `ImageFile { url, content_type, file_name, file_size, width, height }`.

### Pricing (observed)

Text tokens per 1M: **$5.00 input, $1.25 cached, $10.00 output**. Image tokens per 1M:
**$8.00 input, $2.00 cached, $30.00 output**. Quality strongly affects cost; the default is
`high`. Verify before budgeting, and log cost per successful use in `PRODUCT.md`.

### Related fal image models

GPT Image 2 (`openai/gpt-image-2`), Nano Banana 2/Pro, GPT Image 1.5, Flux 2, Seedream,
Qwen Image, Grok Imagine. Choose from product need, not novelty.

## MiniMax H3 Max (video) — `minimax/h3-max/*`

fal's post-trained, throughput-optimized H3 variant: 480P/768P native (1080P as 768P latent
refinement), 5–15s, 24 fps, stronger prompt adherence. Long jobs use queue + webhook.

| Endpoint | Use | Key inputs |
|---|---|---|
| `minimax/h3-max/text-to-video` | text → video | `prompt`, `duration` (default 5), `resolution` 480P/768P(default)/1080P, `aspect_ratio` 21:9/16:9(default)/4:3/1:1/3:4/9:16, `prompt_expansion_mode` balanced(default)/quality, `seed`, `enable_safety_checker` (default true), `sync_mode` |
| `minimax/h3-max/image-to-video` | animate a frame | `image_url` optional first frame, `end_image_url` optional last frame; canvas follows the provided frame; both omitted → text-to-video |
| `minimax/h3-max/reference-to-video` | keep subjects/style | `reference_image_urls`, `reference_video_urls` (2–15s each, combined ≤15s), `reference_audio_urls`; **≤12 files total**; refer to them in the prompt as Image 1, Video 1, Audio 1; `aspect_ratio` includes `adaptive` |
| `minimax/h3-max/camera-controls` | camera-only move on a still | `image_url` first frame, `camera_trajectory` = ordered keyframes `{time 0–1, azimuth°, elevation°, distance}`; default prompt freezes the scene and moves only the camera; `duration` default 5, `resolution` 480P/768P/1080P |
| `minimax/h3-max/director` | realtime continuous stream | WebRTC session via `@fal-ai/client@alpha` + `@fal-ai/server-proxy@alpha`; configure/prompt/ping/stop messages; resolutions 480p/768p/1080p; aspect 16:9/9:16/1:1; `memory` 1–50; scripts up to 64 beats; 24 fps |

### Pricing (observed, promotional)

- Text-to-video, image-to-video, camera-controls: promo **$0.0125/s at 480p, $0.02/s at 768p,
  $0.04/s at 1080p**; list rates roughly **$0.05 / $0.08 / $0.16 per second** after the promo.
- Reference-to-video: per second of output plus reference token billing — first 4096 tokens
  free, then **$0.02 per 1K reference tokens** (a 1024² image ≈ 1K tokens, a 2048² image ≈ 4K).
- Director sessions: promo **$0.02/s** (list ~$0.08/s), 1080p 2×, default session ≤15 min,
  **minimum charge $1.20/session**.

The promo window is time-limited (a stated end date appears on the pages). Verify current
pricing before budgeting.

## MiniMax H3 (video) — `minimax/h3/*`

The frontier multimodal variant: **2K**, 5–15s, native stereo audio, open weights.

| Endpoint | Use |
|---|---|
| `minimax/h3/text-to-video` | text → 2K video |
| `minimax/h3/image-to-video` | first/last-frame conditioning |
| `minimax/h3/reference-to-video` | up to 9 images + 3 video + 3 audio references (≤12 files) |
| `minimax/h3/text-to-video/lora` | apply a trained LoRA at adjustable strength |
| `minimax/h3/t2v/trainer` | train a LoRA on captioned clips |

Pricing (observed): **$0.05/s at 480p, $0.06/s at 768p, $0.13/s at 2K, $0.16/s at 4K**.

## Legacy video endpoints (still present)

Previous generation remains callable: `fal-ai/minimax/hailuo-2.3/standard|pro/{text,image}-to-video`,
`fal-ai/minimax/hailuo-2.3-fast/standard|pro/image-to-video`, `fal-ai/minimax/hailuo-02/...`,
`fal-ai/minimax/video-01`, and `fal-ai/minimax/video-01-director/image-to-video`. Prefer H3 /
H3 Max for new work unless a legacy endpoint is specifically needed.

## Compliance and cost

- An App Store preview must be **predominantly real, captured app footage** — AI video is for
  social/ad/landing-page cuts only and must not imply a capability the app does not ship. See
  `docs/playbooks/marketing-video.md`.
- Every provider action logs cost per successful use in `PRODUCT.md`; per-action unit cost must
  clear the gross-margin floor owned by `docs/playbooks/monetization.md`.
- Provider connection, secrets, and the redacted doctor follow `docs/playbooks/ai-media.md`.
