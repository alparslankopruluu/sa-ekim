#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
APP_ROOT="${SCRIPT_DIR:h}"
APP_DIR="${HOME}/Applications/App Factory Status.app"
STATUS_URL="app-factory-status://status"

for argument in "$@"; do
  case "${argument}" in
    --background) ;;
    --capabilities) STATUS_URL="app-factory-status://status?tab=capabilities" ;;
    *)
      echo "Usage: open-factory-status.command [--background] [--capabilities]" >&2
      exit 2
      ;;
  esac
done

python3 "${SCRIPT_DIR}/factoryctl.py" --root "${APP_ROOT}" recommend refresh >/dev/null
python3 "${SCRIPT_DIR}/factoryctl.py" --root "${APP_ROOT}" project register >/dev/null

if [[ ! -x "${APP_DIR}/Contents/MacOS/factory-status" ]] \
  || find "${SCRIPT_DIR}/factory-status.swift" "${SCRIPT_DIR}/factory-status" "${APP_ROOT}/assets/factory-status/robot" \
    -type f -newer "${APP_DIR}/Contents/MacOS/factory-status" -print -quit | grep -q .; then
  "${SCRIPT_DIR}/install-factory-status.command" --install >/dev/null
fi

open -a "${APP_DIR}" "${STATUS_URL}"
