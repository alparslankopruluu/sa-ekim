---
description: Guide or configure secure phone access to local Codex and Claude Code sessions
argument-hint: [codex|claude|both] [--mode=guide|setup|doctor|disable]
---

Prepare optional phone access for: **$ARGUMENTS**

Read `docs/playbooks/remote-access.md` first and re-check both linked official sources plus
installed app/CLI help. Accept only provider `codex|claude|both` (default `both`) and
`--mode=guide|setup|doctor|disable` (default `guide`). Reject unknown arguments.

Keep the repository, shell, MCPs, skills, builds, signing, and provider access on the local
host. Use only official Codex/ChatGPT Remote and Claude Code Remote Control. Never create a
public listener, SSH exposure, tunnel, proxy, port forward, or custom mobile controller.
Remote access does not weaken any app-factory permission or external-action gate.
For Codex prefer desktop **Set up Remote** with ChatGPT mobile; treat experimental
`codex remote-control` as a confirmed fallback. For Claude use `claude remote-control` or
`/remote-control`, then Claude mobile **Code** or `claude.ai/code` with the same
account/organization.

For `guide`, make no changes. Explain the provider choice, account/plan requirements, host
awake/network requirements, phone app path, local setup, safe validation, and revocation.

For `doctor`, use read-only checks such as installed versions and `--help`. Do not start a
daemon/session, log in, pair, alter sleep, enable Computer Use, change permission mode, or
enable all-session access/notifications. Report `READY`, `PARTIAL`, or `BLOCKED`.

For `setup`, run the doctor and show a precise security/action preview. Obtain explicit user
confirmation before starting Codex Remote or `claude remote-control`, opening settings,
changing persistent configuration, or enabling notifications. Pairing/login remains a human
action on the local UI/terminal and phone. Never accept, echo, persist, or log a password,
cookie, MFA value, API key, session URL, QR payload, device token, or pairing code.

Validate a completed setup with one harmless read-only prompt and one action expected to
request approval. Do not enable Codex Computer Use, Claude all-session Remote Control,
push notifications, or host sleep changes unless separately explained and approved.

For `disable`, identify the exact provider/session/device, preview stop/revoke steps, and
obtain confirmation before changing state. Then verify the phone no longer reaches the host.

Finish with a **PHONE ACCESS CARD** containing provider, readiness, host requirements, local
human steps, phone steps, validation, security boundaries, disable path, and remaining TODO.
If setup is verified, run `python3 scripts/factoryctl.py recommend done remote-access`, then
refresh recommendations; a guide alone does not mark it complete.
