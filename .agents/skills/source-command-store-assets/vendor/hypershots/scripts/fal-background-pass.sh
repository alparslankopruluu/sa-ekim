#!/usr/bin/env bash
set -euo pipefail

WS="${1:?usage: fal-background-pass.sh <workspace> <profile> <locale> <name> <prompt>}"
PROFILE="${2:?missing profile}"; LOCALE="${3:?missing locale}"
NAME="${4:?missing background name}"; PROMPT="${5:?missing prompt}"
[[ "$NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "ERROR: background name must be lowercase kebab-case" >&2; exit 2; }
KIT="$(cd "$(dirname "$0")/.." && pwd)"
REVIEW="$WS/out/$PROFILE/review.html"
APPROVAL="${HYPERSHOTS_PROVIDER_APPROVAL:-$WS/provider-approval.json}"
ARTIFACT="background:$NAME"
MODEL="fal-ai/flux/schnell"

command -v genmedia >/dev/null || { echo "ERROR: background generation needs genmedia" >&2; exit 1; }
node "$KIT/scripts/verify-provider-approval.mjs" \
  "$APPROVAL" "$REVIEW" "$PROFILE" "$LOCALE" "$ARTIFACT" "$PROMPT" "fal.ai" "$MODEL"
mkdir -p "$WS/assets"
DEST="$WS/assets/$NAME.png"
perl -e 'alarm 300; exec @ARGV' -- genmedia run "$MODEL" \
  --prompt "$PROMPT" --image_size portrait_16_9 --download "$DEST" --json >/dev/null
[ -s "$DEST" ] || { echo "ERROR: background generation returned no image" >&2; exit 1; }
echo "$DEST"
