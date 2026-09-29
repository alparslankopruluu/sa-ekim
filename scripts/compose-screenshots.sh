#!/usr/bin/env bash
set -euo pipefail

# compose-screenshots.sh — turn raw simulator screenshots into caption-led
# marketing screenshots (App Store / Play Store).
#
# Usage:
#   scripts/compose-screenshots.sh <raw_dir> <captions_file> <out_dir> \
#       [--bg "#101014"] [--fg "#FFFFFF"] [--accent "#7C5CFF"] \
#       [--font "SF-Pro-Display-Bold"] [--size 1320x2868]
#
#   <raw_dir>        directory of raw PNGs (one per shot, ordered by filename)
#   <captions_file>  one caption per line, same order as the sorted PNGs
#   <out_dir>        output directory (created if missing)
#
# Layout: solid/token background, caption band (top ~18%), device screenshot
# scaled + rounded below. Colors/font come from the project's design tokens
# (docs/playbooks/design.md).
#
# Alternative: fastlane frameit adds real device frames; this script is
# dependency-light and brandable. Validate output sizes afterwards with:
#   magick identify -format "%f %wx%h\n" <out_dir>/*.png

RAW_DIR="${1:?raw screenshot dir required}"
CAPTIONS="${2:?captions file required}"
OUT_DIR="${3:?output dir required}"
shift 3

BG="#101014"; FG="#FFFFFF"; ACCENT="#7C5CFF"
FONT="Helvetica-Bold"; SIZE="1320x2868"
while [ $# -gt 0 ]; do
  case "$1" in
    --bg) BG="$2"; shift 2 ;;
    --fg) FG="$2"; shift 2 ;;
    --accent) ACCENT="$2"; shift 2 ;;
    --font) FONT="$2"; shift 2 ;;
    --size) SIZE="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

command -v magick >/dev/null || { echo "ImageMagick required: brew install imagemagick" >&2; exit 1; }

W="${SIZE%x*}"; H="${SIZE#*x}"
CAPTION_H=$(( H * 18 / 100 ))
SHOT_H=$(( H - CAPTION_H - H * 4 / 100 ))
SHOT_W=$(( W * 86 / 100 ))
POINTSIZE=$(( W / 14 ))

mkdir -p "$OUT_DIR"

i=0
# shellcheck disable=SC2012
ls "$RAW_DIR"/*.png | sort | while read -r shot; do
  i=$(( i + 1 ))
  caption="$(sed -n "${i}p" "$CAPTIONS")"
  [ -n "$caption" ] || { echo "no caption for shot $i ($shot) — skipping" >&2; continue; }
  out="$OUT_DIR/$(printf '%02d' "$i")_$(basename "$shot")"

  # 1) rounded, resized screenshot  2) caption panel  3) composite on token bg
  magick "$shot" -resize "${SHOT_W}x${SHOT_H}" \
    \( +clone -alpha extract \
       -draw "fill black polygon 0,0 0,60 60,0 fill white circle 60,60 60,0" \
       \( +clone -flip \) -compose Multiply -composite \
       \( +clone -flop \) -compose Multiply -composite \
    \) -alpha off -compose CopyOpacity -composite miff:- |
  magick -size "${W}x${H}" "xc:${BG}" \
    \( -size "$(( W * 88 / 100 ))x${CAPTION_H}" -background none -fill "$FG" \
       -font "$FONT" -pointsize "$POINTSIZE" -gravity center caption:"$caption" \) \
    -gravity north -geometry +0+$(( H * 3 / 100 )) -composite \
    \( miff:- \) -gravity south -geometry +0+0 -composite \
    "$out"
  echo "✓ $out  (\"$caption\")"
done

echo "Done. Validate: magick identify -format \"%f %wx%h\\n\" $OUT_DIR/*.png"
