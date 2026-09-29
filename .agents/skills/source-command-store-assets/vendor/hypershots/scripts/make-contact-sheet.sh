#!/usr/bin/env bash
set -euo pipefail

WS="${1:-}"
PROFILE="${2:-iphone-6.9}"
LOCALE="${3:-en}"

if [[ -z "$WS" ]]; then
  echo "usage: make-contact-sheet.sh <workspace> [profile=iphone-6.9] [locale=en]" >&2
  exit 2
fi
if ! command -v magick >/dev/null 2>&1; then
  echo "ERROR: ImageMagick ('magick') is required to build the contact sheet." >&2
  exit 1
fi

SOURCE_DIR="$WS/out/$PROFILE/$LOCALE"
OUTPUT="$WS/out/$PROFILE/contact-sheet-$LOCALE.png"
shopt -s nullglob
PANELS=("$SOURCE_DIR"/panel-*.png)
shopt -u nullglob
if [[ ${#PANELS[@]} -eq 0 ]]; then
  echo "ERROR: no rendered panels found in $SOURCE_DIR" >&2
  exit 1
fi

# Some ImageMagick macOS installs have no type.xml default and montage attempts to
# resolve an empty font even when no labels were requested. Supply a deterministic
# local font so contact-sheet generation stays independent of global IM configuration.
FONT_ARGS=()
if [[ -f /System/Library/Fonts/SFNS.ttf ]]; then
  FONT_ARGS=(-font /System/Library/Fonts/SFNS.ttf)
elif command -v fc-match >/dev/null 2>&1; then
  FONT_PATH="$(fc-match -f '%{file}' sans | head -n 1)"
  [[ -n "$FONT_PATH" && -f "$FONT_PATH" ]] && FONT_ARGS=(-font "$FONT_PATH")
fi

magick montage "${FONT_ARGS[@]}" "${PANELS[@]}" \
  -background '#f2f0eb' \
  -tile "${#PANELS[@]}x1" \
  -geometry '320x+12+12' \
  "$OUTPUT"
echo "$OUTPUT"
