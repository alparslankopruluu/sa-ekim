#!/usr/bin/env bash
set -euo pipefail

WS="${1:?usage: fal-sticker-pass.sh <workspace> <profile> <locale> <name> <subject>}"
PROFILE="${2:?missing profile}"; LOCALE="${3:?missing locale}"
NAME="${4:?missing sticker name}"; SUBJECT="${5:?missing sticker subject}"
[[ "$NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "ERROR: sticker name must be lowercase kebab-case" >&2; exit 2; }
KIT="$(cd "$(dirname "$0")/.." && pwd)"
REVIEW="$WS/out/$PROFILE/review.html"
APPROVAL="${HYPERSHOTS_PROVIDER_APPROVAL:-$WS/provider-approval.json}"
ARTIFACT="sticker:$NAME"
MODEL="openai/gpt-image-2+fal-ai/birefnet/v2"
PROMPT="A single die-cut glossy 3D sticker of $SUBJECT, thick clean white die-cut sticker border around the whole silhouette, centered, on a solid flat bright magenta background, soft studio lighting, high detail, no text"

command -v genmedia >/dev/null || { echo "ERROR: sticker generation needs genmedia" >&2; exit 1; }
node "$KIT/scripts/verify-provider-approval.mjs" \
  "$APPROVAL" "$REVIEW" "$PROFILE" "$LOCALE" "$ARTIFACT" "$PROMPT" "fal.ai" "$MODEL"

guard() { perl -e 'alarm 300; exec @ARGV' -- "$@"; }
json_field() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.cdn_url)process.exit(1);console.log(j.cdn_url)})'
}
TMPD="$(mktemp -d "${TMPDIR:-/tmp}/hypershots-sticker.XXXXXX")"
trap 'rm -rf "$TMPD"' EXIT
RAW="$TMPD/generated.png"
DEST="$WS/assets/$NAME.png"
mkdir -p "$WS/assets"
guard genmedia run openai/gpt-image-2 \
  --prompt "$PROMPT" --image_size square_hd --quality high \
  --download "$RAW" --json >/dev/null
[ -s "$RAW" ] || { echo "ERROR: sticker generation returned no image" >&2; exit 1; }
RAW_URL="$(guard genmedia upload "$RAW" --json | json_field)"
guard genmedia run fal-ai/birefnet/v2 --image_url "$RAW_URL" \
  --output_format png --download "$DEST" --json >/dev/null
[ -s "$DEST" ] || { echo "ERROR: background removal returned no image" >&2; exit 1; }
echo "$DEST"
