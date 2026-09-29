# Expo Agent Tools

*Read this before installing or using Expo skills, Expo MCP, EAS agent actions, or a
project-local MCP dev server. Last verified: 2026-08-09.*

Expo projects use two complementary layers:

1. the official Expo skills package teaches current Expo/React Native conventions and
   command syntax;
2. `https://mcp.expo.dev/mcp` exposes authenticated Expo/EAS documentation, project,
   build, workflow, log, TestFlight feedback, and simulator operations.

For Codex, prefer the curated `expo@openai-curated` plugin and verify its installed source
and version before adding it. For Claude Code, use the official Expo marketplace package
shown by current Claude/Expo help. For another compatible harness, use
`bunx add-skill expo/skills` only after previewing the resolved source/ref and target.
External skills remain user-level and are never vendored into generated apps.

## Setup profile

`/factory-setup --expo-tools` performs an idempotent profile:

1. detect and report the Expo plugin/skill source and version; do not reinstall a valid
   Codex plugin;
2. preview the user-level MCP diff, then configure Codex with
   `codex mcp add expo --url https://mcp.expo.dev/mcp` when approved;
3. let the operator complete Expo OAuth in the official browser flow; never capture or
   persist its token in the repo or status files;
4. for an approved Expo project, read its actual SDK version. SDK 54+ may add
   `expo-mcp` as a dev dependency with `npx expo install expo-mcp --dev` and a project
   script that runs `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start`;
5. SDK <54 is blocked behind an Expo upgrade plan/TODO. Do not force-install the package
   or guess compatibility.

The blueprint approval must name all three mutations when applicable: user-level plugin/
skill installation, user-level MCP configuration/OAuth data flow, and project dependency/
script changes. If sensitive-data flags are enabled, document the MCP/OAuth data path and
threat controls in `docs/security-model.md` before connecting.

## Authority matrix

| Operation | Default authority |
|---|---|
| Expo docs/search; list projects, builds, workflows; read logs; TestFlight crash/feedback readback; simulator inspection | Allowed read-only within the approved project |
| `build_run` or `workflow_run` | Only inside the approved task graph, target/profile, and cost boundary; preview then read back |
| Add/update `expo-mcp` or project start script | Covered only when the approved blueprint explicitly lists the local project diff |
| Build cancellation, store submission, review response, deletion, public/persistent mutation | A fresh exact approval every time |

Expo/EAS may produce the production IPA. `asc` remains the iOS App Store transport,
metadata, TestFlight distribution, submission, and readback authority. MCP authentication
never broadens factory approval.

Sources: [Expo skills](https://docs.expo.dev/skills/) and
[Expo MCP](https://docs.expo.dev/mcp/).
