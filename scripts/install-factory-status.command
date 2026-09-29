#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
SOURCE="${SCRIPT_DIR}/factory-status.swift"
SOURCE_DIR="${SCRIPT_DIR}/factory-status"
SOURCES=("${SOURCE}" "${SOURCE_DIR}"/*.swift)
ROBOT_ASSETS="${SCRIPT_DIR:h}/assets/factory-status/robot"
APP_DIR="${HOME}/Applications/App Factory Status.app"
CONTENTS_DIR="${APP_DIR}/Contents"
BINARY="${CONTENTS_DIR}/MacOS/factory-status"
ROBOT_RESOURCES="${CONTENTS_DIR}/Resources/Robot"
REDACTION_SOURCE="${SOURCE_DIR}/Resources/redaction-patterns.json"
REDACTION_RESOURCE="${CONTENTS_DIR}/Resources/Redaction/patterns.json"
PLIST="${HOME}/Library/LaunchAgents/com.appfactory.status.plist"
REGISTRY="${HOME}/.config/app-factory/projects.json"
MODE="${1:---dry-run}"

if [[ "${MODE}" != "--dry-run" && "${MODE}" != "--install" ]]; then
  echo "Usage: install-factory-status.command [--dry-run|--install]" >&2
  exit 2
fi

echo "Factory Status app: ${APP_DIR}"
echo "Login helper: ${PLIST}"
echo "Recent projects: ${REGISTRY} (0600, secret-free)"
if [[ "${MODE}" == "--dry-run" ]]; then
  xcrun swiftc -typecheck -parse-as-library "${SOURCES[@]}"
  test -f "${ROBOT_ASSETS}/manifest.json"
  test -f "${REDACTION_SOURCE}"
  test "$(find "${ROBOT_ASSETS}" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ')" = "12"
  exit 0
fi

mkdir -p "${CONTENTS_DIR}/MacOS" "${ROBOT_RESOURCES}" "${REDACTION_RESOURCE:h}" "${HOME}/Library/LaunchAgents" "${HOME}/.config/app-factory"
TEMP_BINARY="${BINARY}.tmp.$$"
trap 'rm -f "${TEMP_BINARY}"' EXIT
xcrun swiftc -parse-as-library "${SOURCES[@]}" -o "${TEMP_BINARY}"
chmod 700 "${TEMP_BINARY}"
mv -f "${TEMP_BINARY}" "${BINARY}"
trap - EXIT
for asset in "${ROBOT_ASSETS}"/*.png; do
  cp -f "${asset}" "${ROBOT_RESOURCES}/${asset:t}"
done
cp -f "${ROBOT_ASSETS}/manifest.json" "${ROBOT_RESOURCES}/manifest.json"
cp -f "${REDACTION_SOURCE}" "${REDACTION_RESOURCE}"
chmod 600 "${REDACTION_RESOURCE}"

INFO_PLIST="${CONTENTS_DIR}/Info.plist"
cat > "${INFO_PLIST}" <<'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>factory-status</string>
  <key>CFBundleIdentifier</key><string>com.appfactory.status</string>
  <key>CFBundleName</key><string>App Factory Status</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>4.1.0</string>
  <key>CFBundleVersion</key><string>330</string>
  <key>CFBundleURLTypes</key><array><dict>
    <key>CFBundleURLName</key><string>com.appfactory.status.open</string>
    <key>CFBundleURLSchemes</key><array><string>app-factory-status</string></array>
  </dict></array>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
</dict></plist>
PLIST_EOF
chmod 600 "${INFO_PLIST}"

TEMP_PLIST="${PLIST}.tmp.$$"
cat > "${TEMP_PLIST}" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.appfactory.status</string>
  <key>ProgramArguments</key><array>
    <string>${BINARY}</string><string>--registry</string><string>${REGISTRY}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>ProcessType</key><string>Interactive</string>
</dict></plist>
PLIST_EOF
chmod 600 "${TEMP_PLIST}"
mv -f "${TEMP_PLIST}" "${PLIST}"

launchctl bootout "gui/${UID}" "${PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/${UID}" "${PLIST}"
open -a "${APP_DIR}"
echo "Factory Status installed and registered for login."
