# iOS Simulator as evidence inside AI IDEs

*Read when: a terminal-capable AI IDE (Claude Code, Codex, Cursor) needs to prove an iOS UI
result, or when scripting the Simulator as a verification/evidence surface.*

The Simulator is the visual truth for iOS work. A terminal-capable agent drives it with
`xcodebuild` and `xcrun simctl`; the IDE/terminal is only the control surface. No UI result is
claimed without a captured frame or a test run that produced one. This is the Mac-local loop —
the optional MCP/XcodeBuildMCP and Axiom tooling layer that wraps these same commands lives in
`docs/playbooks/ios-expert-tools.md`.

## Build and run on a named destination

- Resolve a deterministic destination once and reuse it. Never use bare `booted` or a generic
  `platform=iOS Simulator` as a build/test destination:
  ```bash
  xcrun simctl list devices available
  xcodebuild -scheme "$SCHEME" \
    -destination "platform=iOS Simulator,name=$SIM_NAME,OS=$SIM_RUNTIME" build
  ```
- Keep boot, reset, install, and launch as explicit steps so failures are attributable:
  ```bash
  xcrun simctl boot "$SIM_NAME"
  xcrun simctl bootstatus "$SIM_NAME" -b
  xcrun simctl erase "$SIM_NAME"          # deterministic clean state
  xcrun simctl install "$SIM_NAME" /path/to/App.app
  xcrun simctl launch "$SIM_NAME" "$BUNDLE_ID"
  ```
- Derive `SIM_NAME`/`SIM_RUNTIME` from `xcodebuild -showdestinations -scheme "$SCHEME"` and
  record them in the task capsule — not in your head.

## Evidence capture

- Capture every visual claim into one evidence folder:
  ```bash
  mkdir -p evidence/ios
  xcrun simctl io "$SIM_NAME" screenshot evidence/ios/<step>.png
  ```
- Stream or show logs from the target device:
  ```bash
  xcrun simctl spawn "$SIM_NAME" log stream --level debug --predicate 'subsystem == "$BUNDLE_ID"'
  xcrun simctl spawn "$SIM_NAME" log show --last 5m --predicate 'subsystem == "$BUNDLE_ID"'
  ```
- Keep frames, logs, and the `xcodebuild` result bundle together, then reference the evidence
  IDs in the completion receipt — `docs/playbooks/context-engineering.md`.

## Deterministic UI tests

- XCUITest is the reproducible proof surface. Run it against the same named destination:
  ```bash
  xcodebuild -scheme "$SCHEME" \
    -destination "platform=iOS Simulator,name=$SIM_NAME,OS=$SIM_RUNTIME" \
    -resultBundlePath evidence/ios/UITests.xcresult test
  ```
- Prefer accessibility identifiers/labels over coordinates, and seed a named app state
  (launch arguments/env) before asserting, so a pass means the state, not luck.
- Inspect app state through the accessibility tree and explicit test hooks; do not infer
  internals from screenshots.

## Rules

- The agent works in the terminal/IDE; the Simulator is the display. Never claim a UI result
  without a captured frame or a test run that produced one.
- One claim, one artifact. Attach the frame or log to the receipt; do not describe it.
- Prefer deterministic destinations and named test states over ad-hoc manual tapping.
- Re-run after every source change — a stale build proves nothing about current code.

## Practical failures

- **Wrong runtime/destination:** `latest` or `booted` silently selects a different OS/device.
  Pin `OS=` explicitly.
- **Stale build:** the installed app no longer matches source — rebuild and reinstall, or
  `simctl uninstall` first.
- **Code signing:** simulator builds generally need no signing team; device builds do. A
  signing error on a simulator destination usually means device-only config leaked in.
- **Second device:** booting another simulator changes what `booted` means. Address the
  target by name/UDID whenever more than one is booted.

## Boundary

- The Simulator is not real-device proof. Keyboard, haptics, camera, biometrics, background
  behavior, and performance (thermal, memory, launch) require a physical device. Say so.
- Store screenshots are a separate, pinned pipeline — `docs/playbooks/store-listing.md` — not
  a byproduct of dev captures.
- For the deeper optional tooling layer (XcodeBuildMCP, Axiom), read
  `docs/playbooks/ios-expert-tools.md`.
