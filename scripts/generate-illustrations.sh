#!/usr/bin/env bash
set -euo pipefail

# generate-illustrations.sh — dev-time helper to generate a cohesive set of
# onboarding/marketing illustrations via OpenAI's image API.
#
# NOT for runtime use. This is run once by the developer, from their own
# terminal, with their own key — never wire this into the shipped app
# without the Cloud Function proxy pattern (docs/checklists/security.md S1).
# Claude should not invoke this unprompted: every call costs real money.
#
# Note: Anthropic's Claude API is image-UNDERSTANDING only (vision/input) —
# it cannot generate images. OpenAI (or another image-gen provider) is
# required for output. This script calls the OpenAI Images API directly.
# Newer GPT Image 2.5 (Flare/Sunburst) variants are available through fal.ai;
# for those, use @fal-ai/client server-side instead (docs/playbooks/ai-media.md).
# Model name may drift; override with OPENAI_IMAGE_MODEL and verify the current
# flagship image model in OpenAI's API docs before relying on this script.
#
# Usage:
#   export OPENAI_API_KEY=sk-...   # never commit this
#   scripts/generate-illustrations.sh <style_prompt_file> <scenes_file> <out_dir>
#
#   <style_prompt_file>  one paragraph describing the shared visual style —
#                        write it from docs/playbooks/design.md's Design
#                        Direction block (personality adjectives, tokens),
#                        e.g. "flat 2D illustration, pastel palette, rounded
#                        shapes, no text, mood: calm and friendly"
#   <scenes_file>        one scene description per line, e.g. "a person
#                        smiling while looking at a phone showing a plant"
#   <out_dir>            output directory for generated PNGs
#
# Reference: docs/playbooks/design.md "Inspiration workflow".

STYLE_FILE="${1:?style prompt file required}"
SCENES_FILE="${2:?scenes file required}"
OUT_DIR="${3:?output dir required}"

: "${OPENAI_API_KEY:?Set OPENAI_API_KEY in your shell — never in a committed file}"

command -v python3 >/dev/null || { echo "python3 required" >&2; exit 1; }

STYLE="$(cat "$STYLE_FILE")"
MODEL="${OPENAI_IMAGE_MODEL:-gpt-image-2}" # override to match the current flagship model
mkdir -p "$OUT_DIR"

i=0
while IFS= read -r scene || [ -n "$scene" ]; do
  [ -z "$scene" ] && continue
  i=$((i + 1))
  out="$OUT_DIR/$(printf '%02d' "$i").png"
  echo "Generating $out — \"$scene\""

  payload="$(python3 -c '
import json, sys
style, scene, model = sys.argv[1], sys.argv[2], sys.argv[3]
print(json.dumps({
    "model": model,
    "prompt": f"{style}. Scene: {scene}.",
    "size": "1024x1024",
    "quality": "medium",
}))
' "$STYLE" "$scene" "$MODEL")"

  curl -sS https://api.openai.com/v1/images/generations \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" \
  | python3 -c '
import json, sys, base64
data = json.load(sys.stdin)
if "data" not in data:
    sys.stderr.write("API error: " + json.dumps(data) + "\n")
    sys.exit(1)
sys.stdout.buffer.write(base64.b64decode(data["data"][0]["b64_json"]))
' > "$out"
done < "$SCENES_FILE"

echo "Done ($i images). Review $OUT_DIR for style consistency before bundling as app assets."
