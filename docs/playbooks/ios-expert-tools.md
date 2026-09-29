# iOS Expert Tools

*Read when running `/factory-setup --ios-expert-tools`, writing/reviewing SwiftUI code,
or choosing an advanced Apple-platform diagnostic tool.*

The kit stays complete without third-party expert skills. These are user-level,
optional accelerators: never vendor them into app repos or copy them through `install.sh`.
Load one relevant skill at a time so the router and canonical app docs remain the source
of product, architecture, security, release, and scope truth.

## Approved focused skills

| Skill | Trigger | Audited source commit |
|---|---|---|
| `swiftui-pro` | write/review SwiftUI views, navigation, state, performance, accessibility | `twostraws/SwiftUI-Agent-Skill@be297ff80dddec529af1f9b1f1f114aab6c9d11c` |
| `swift-concurrency-pro` | async/await, actors, Sendable, cancellation, strict-concurrency errors | `twostraws/Swift-Concurrency-Agent-Skill@bee3f69ba17142da148d3c5406f148ed62592b69` |
| `swift-testing-pro` | write/review Swift Testing unit or integration tests | `twostraws/Swift-Testing-Agent-Skill@2d6bba14a3c8bf3694f218b92fffe617c41ae43e` |
| `swiftdata-pro` | only after the blueprint chooses SwiftData | `twostraws/SwiftData-Agent-Skill@922d989473a9914210b41529a1ac5636aff4b8c1` |

All four sources are MIT-licensed and target Swift 6.2/iOS 26-era APIs. Before an
upgrade, read the changed `SKILL.md` and references, verify the license, and record a new
audited commit here. Do not silently follow `main` drift.

Invoke only the matching skill at a natural checkpoint. The skill may find or explain
issues, but app-factory's milestone, protected files, dependency approval, canonical
docs, and verification rules win any conflict. Never run all skills on every edit.

## Simulator and build routing

CLI remains the portable baseline: `xcodebuild` for build/test and `simctl` for device
control/screenshots. When a full Xcode project exists and XcodeBuildMCP/Build iOS Apps is
connected, prefer it for scheme/simulator discovery, build/launch, accessibility-tree
inspection, labeled taps, screenshots, and logs. Use one bug/path per run and preserve
evidence. Raw coordinates are a last resort; labels/accessibility identifiers come first.

Cloud agents cannot replace this local loop. Xcode, Simulator, device logs, signing,
archive/export, and TestFlight proof stay Mac-local.

## Axiom beta boundary

Axiom adds useful on-demand diagnostics (`xclog`, `xcsym`, `xcprof`, targeted memory,
concurrency, accessibility, build, crash, and performance guidance). Its current npm
`latest` at this kit release is `axiom-mcp@27.0.0-beta.20`, which also tracks OS 27 beta.

- Never install or configure it during normal `/factory-setup`.
- `--axiom-beta` is an explicit beta opt-in and must pin that exact package version.
- Use its MCP search/read path on demand; never inject all 262 skills into normal context.
- Do not run full `health-check`, 41-agent scans, auto-fix agents, or broad parallel audits
  by default. Select the smallest diagnostic that answers the current evidence gap.
- OS 27 guidance never changes deployment target or introduces beta APIs without a new
  blueprint/stack decision and explicit user approval.
- Start read-only. Any proposed source change returns through normal app-factory gates.

Primary references: Paul Hudson's MIT skill repositories, Axiom's MIT repository/MCP
guide, and OpenAI Learn's [native iOS apps](https://learn.chatgpt.com/use-cases/native-ios-apps),
[iOS simulator debugging](https://learn.chatgpt.com/use-cases/ios-simulator-bug-debugging),
and [build skills](https://learn.chatgpt.com/docs/build-skills) guides. Verify current
upstream state before changing pins.
