---
description: Prepare this Mac for repeatable factory runs without storing secrets
argument-hint: "[--ios-expert-tools] [--axiom-beta] [--expo-tools] [--connect-providers] [--remote-access] [--android-tools] [--android-community-tools]"
---

Prepare the local macOS machine for `/factory-run`. This command installs/verifies the
toolchain and creates a **secret-free** operator profile; it does not create an app or
any cloud resource.

Set `python3 scripts/factoryctl.py run stage setup`, then refresh recommendations.

Load playbooks JIT — read only the one the step you are on needs (toolchain:
`docs/playbooks/factory-run.md`; ASC: `app-store-connect.md`; R2: `cloudflare-r2.md`;
`--ios-expert-tools`: `ios-expert-tools.md`; providers: `ai-media.md`;
`--remote-access`: `remote-access.md`; `--android-tools`: `play-store.md` +
`android-expert-tools.md`; `--expo-tools`: `expo-agent-tools.md`; skill gaps:
`skill-discovery.md`; before finishing: `docs/checklists/security.md`). Parse
`$ARGUMENTS`; reject unknown flags. `--android-community-tools` is valid only together
with `--android-tools`.

## 1. Read-only inventory

Run `python3 scripts/factoryctl.py doctor`, then inspect without changing anything:

- macOS version, active Xcode path/version/license, simulator runtimes, Git, Homebrew,
  Node/npm, Python, Ruby/Bundler, disk free space;
- Android Studio, compatible JDK, Android SDK/SDK Manager, `adb`, emulator, installed
  API 36/build-tools, Gradle/AGP visibility, `bundletool`, Android CLI, and a usable
  phone/emulator target;
- `asc`, Firebase CLI, Wrangler, EAS (for Expo), Fastlane, Maestro, AXe, ImageMagick,
  and Koubou versions;
- user-level Claude/Codex presence of `swiftui-pro`, `swift-concurrency-pro`, and
  `swift-testing-pro`; XcodeBuildMCP/Build iOS Apps and Axiom MCP connection state;
- user-level Claude/Codex visibility of the audited factory ASC subset from
  `docs/playbooks/app-store-connect.md` (a copy only under `~/.agents/skills` is not
  sufficient proof for either harness);
- official Expo plugin/skill source and version, Expo MCP config/OAuth state, and for an
  Expo project its real SDK version plus local `expo-mcp` dependency/start script;
- `npx` and the bundled `find-skills/SOURCE.json` revision/SKILL.md hash; routine setup
  must not fetch, auto-update, or globally install external discovery skills;
- optional Cloudflare Docs MCP and task-scoped Cloudflare MCP/plugin visibility per
  `docs/playbooks/cloudflare-r2.md`; absence is informational, not a blocker;
- `asc auth status --validate`, `asc auth doctor`, `firebase login:list`,
  `wrangler whoami`, and EAS auth when installed.

Never delete DerivedData or other files to make disk checks pass. Report exact missing,
unsupported, and unauthenticated items before installation.

## 2. Install the approved toolchain

The invocation authorizes normal package installs needed by the factory, but not `sudo`,
curl-piped installers, shell profile rewrites, or secret collection. Prefer official
Homebrew/npm/pip packages. Before each install, verify the current package and command
from its official help/source; show a concise install plan.

Required:

- `asc >=3.1.0,<4` (`brew install asc`), then `asc version`;
- official rorkai ASC skills (`asc install-skills`, or the installed help's canonical
  equivalent), pinned/audited at
  `13861c2051189e08ac843b396c90dda004b916a8`; then install only the factory subset from
  `docs/playbooks/app-store-connect.md` at user scope for Claude Code and Codex and verify
  both locations. Never copy external ASC skills into this repo/generated apps;
- current supported Firebase CLI and Wrangler;
- Xcode command-line tools and a usable iOS Simulator runtime;
- ImageMagick and stack screenshot driver: AXe/simctl for SwiftUI, Maestro/simctl for Expo.

Optional/fallback:

- Fastlane only for SwiftUI screenshot fallback;
- EAS CLI only for Expo IPA builds;
- Koubou pinned to the version required by installed ASC screenshot skills.

### Optional Android profile

Without `--android-tools`, inventory Android tooling and skills but install nothing.
With it, show and obtain confirmation for the exact install plan, then install/verify a
compatible JDK 17+, Android Studio/SDK command-line tools, API 36 platform/build-tools,
`adb`, emulator, `bundletool`, and Android CLI through their official distribution
channels. Never accept licenses non-interactively, rewrite shell profiles, create an
emulator, start a device, or download a system image without a separate preview. A GUI,
admin, license, or first-run requirement becomes a precise human action.

Use Google's `android/skills` at tag `v1.0.7` (commit
`1e5e7ae6138bebd0835d0d5854b0b9adfeed3181`). Verify Android CLI help and the resolved
source/ref before writing. Install only `android-cli`, `navigation-3`, `adaptive`,
`styles`, `edge-to-edge`, `testing-setup`, `r8-analyzer`,
`android-intent-security`, and `play-policy-insights` for the detected Claude Code and
Codex agent locations. Never use `android skills add --all`; if the installed CLI cannot
prove the pin or target the requested agents, stop with a reviewed manual-install action
rather than fetching latest or guessing flags. External skills remain user-level and are
never vendored into this kit or generated apps.

`--android-community-tools` is a separate opt-in. Pin
`rcosteira79/android-skills` at
`6373e59c1dcdb28fe94649e7db59055a5052f4db`, review license and diff, and expose only
`android-dev`, `compose`, `kotlin-coroutines`, `kotlin-flows`, `android-testing`,
`android-debugging`, and `android-gradle-logic` at user scope for Claude Code and Codex.
Never install its whole
plugin/catalog, auto-update it, or add Drjacky/dpconde rule sets. Upstream drift stops
for review. Android reverse-engineering skills are never part of setup.

### Optional iOS expert profile

Without `--ios-expert-tools`, report focused skill/MCP availability but install nothing.
With the flag, follow `docs/playbooks/ios-expert-tools.md`: compare each upstream HEAD
and relevant skill diff with the audited commit before installation. If it drifted, stop
for review; never silently accept changed instructions. Install only `swiftui-pro`,
`swift-concurrency-pro`, and `swift-testing-pro` at user scope for Claude Code and Codex.
Never vendor or copy them into this repo/generated apps. Install `swiftdata-pro` only when an
approved SwiftUI blueprint actually selects SwiftData.

`--axiom-beta` is a separate explicit beta opt-in. Pin `axiom-mcp@27.0.0-beta.20`, show
the exact existing global/Xcode MCP config diff, preserve all other servers, and obtain
confirmation before writing it. Never install the full Axiom plugin/catalog globally,
run a broad health-check, or enable OS 27 APIs by default. If the package/version differs,
stop and update the audited decision first.

If a tool requires an official installer script, admin rights, Xcode GUI download, or
license acceptance, create a precise human action instead of bypassing the boundary.
Re-run version checks after every install. Do not install a future major of `asc`.

### Optional Expo profile

Without `--expo-tools`, inventory only. With it, follow
`docs/playbooks/expo-agent-tools.md`: do not reinstall a valid Codex
`expo@openai-curated` plugin; use Expo's official Claude marketplace package; and reserve
`expo/skills` for compatible harness fallback. Show and approve the exact user-level
MCP diff before `codex mcp add expo --url https://mcp.expo.dev/mcp`; the operator completes
OAuth. For an approved SDK 54+ project, add `expo-mcp` as a dev dependency and an MCP start
script. SDK <54 stops at an upgrade/TODO gate. Read-only tools are usable in scope;
`build_run`/`workflow_run` need an approved graph and cost; submit/cancel/review/delete and
other public writes need fresh approval. Expo builds the IPA; `asc` transports it.

Do not install Cloudflare's entire global skill catalog automatically. If the operator
wants agent integrations, re-fetch the official agent-setup prompt, show the exact
user-level MCP/plugin config diff, and obtain explicit approval. Prefer the public read-only
Cloudflare Docs MCP; add authenticated servers only for a concrete approved task.
An authenticated MCP never broadens blueprint authority.

## 3. Configure authentication safely

- Disable ASC telemetry: `asc telemetry disable` and verify its status.
- Prefer Keychain-backed `asc auth login`; instruct the human to enter key ID, issuer ID,
  and `.p8` path directly in their terminal. Never request or echo private-key contents.
- Run `asc auth status --validate`, `asc auth doctor`, and a read-only apps list.
- Let Firebase, Wrangler, EAS, and RevenueCat OAuth use their own login flows. Do not
  copy tokens into the repo, operator profile, prompt, status, or logs.
- Never use `--bypass-keychain` or repo-local ASC credentials on this developer Mac.

Authentication can remain a named human action; setup is `PARTIAL`, not falsely green,
until each required provider's read-only doctor succeeds.

If `--connect-providers` is selected, invoke `/connect-providers all` after the basic
toolchain check. It may start OAuth in the user's browser/terminal but never asks for a
key in chat, writes an MCP config without a reviewed diff, or makes a paid fal.ai call.

If `--remote-access` is selected, invoke `/remote-access both --mode=guide` after the basic
doctor. This only prepares the optional phone-access guide. Do not start a remote daemon,
pair a device, open a session, change sleep/persistent settings, or enable notifications
during factory setup; those actions remain a separately previewed and approved setup.

## 4. Create the operator profile

Use `factoryctl profile` help to create/update
`~/.config/app-factory/operator.json`. Store only non-secret values:

- Apple team ID, internal tester email and internal group name;
- support email, support URL, privacy URL, and terms URL;
- Firebase account email/alias and Cloudflare account ID.

Reject fields resembling passwords, tokens, private keys, API keys, cookies, or auth
headers. Validate file permissions and print a redacted summary, never the full raw file.

## 5. Final doctor

Re-run `factoryctl doctor` plus provider read-only checks. Report `READY`, `PARTIAL`, or
`BLOCKED` with versions, auth status, screenshot capability per stack, operator-profile
gaps, optional iOS expert/Axiom status, Android build/device/selected-skill status, and
exact human actions. Android readiness requires a successful read-only tool/version
inventory, not an app build or Play connection. Do not create Firebase projects, ASC or
Play apps, RevenueCat catalog items, R2 buckets, builds, TestFlight groups, signing keys,
or Play releases in setup.
Dry-run, then install/refresh the no-provider Factory Status menu app with
`scripts/install-factory-status.command --install`.
When and only when the result is `READY`, run
`python3 scripts/factoryctl.py recommend done factory-setup`, then refresh recommendations.
