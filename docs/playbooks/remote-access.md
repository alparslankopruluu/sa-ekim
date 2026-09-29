# Phone access for Codex and Claude Code

Use the vendors' managed remote features to continue a local app-factory session from a
phone. This is an optional operator convenience, not a project runtime, provider MCP, or
replacement for the local status window.

Official sources are the authority because availability and command surfaces can change:

- Codex: <https://learn.chatgpt.com/docs/remote-connections.md>
- Claude Code: <https://code.claude.com/docs/en/remote-control>

Re-check those pages and the installed CLI/app help before setup. Never infer entitlement
from this playbook.

## Shared security boundary

- The repository, shell, skills, MCP servers, build tools, signing material, and execution
  remain on the selected host. The phone is a synchronized control surface.
- Use only the official account/workspace and managed relay. Do not expose Codex app-server,
  Claude Code, SSH, a WebSocket, or a local port to the public internet. Do not create an
  ngrok, Cloudflare Tunnel, custom proxy, or port-forwarding workaround.
- Remote access never weakens app-factory approvals. Publishing, deploy, spend, signing,
  provider writes, destructive commands, and secret handling still require their normal
  gates. Keep the host's sandbox and permission mode conservative.
- Remote access uses account login, not project API keys. Never request, paste, echo, store,
  or log passwords, cookies, MFA codes, API keys, session URLs, QR payloads, device tokens,
  or short-lived pairing codes. `.factory` state stores only readiness labels and TODOs.
- Pairing/login is a human action on the local app, terminal, and phone. A guide or doctor
  may inspect versions/help read-only; it must not silently start a daemon, pair a device,
  enable all-session access, change sleep settings, or register notifications.
- Name remote sessions without customer names, unreleased product details, credentials, or
  other sensitive data. Revoke lost devices and stop unused sessions promptly.

## Codex managed Remote

Prefer the Codex desktop application's managed Remote flow for phone use:

1. Confirm Codex desktop and ChatGPT mobile use the intended account and workspace, with MFA
   where required. In Codex, choose **Set up Remote** and review the connection preview.
2. Scan the displayed QR code from ChatGPT mobile and complete the account/workspace checks
   on the phone. Manage or revoke devices in **Settings -> Connections**.
3. Keep the host awake, online, and the Codex app open. Start or continue the project from
   ChatGPT mobile's Remote surface, then test with a harmless read-only request and one
   deliberately approval-gated request.
4. Confirm the phone can review diffs/tests and that command approvals still appear. Do not
   enable Computer Use unless a concrete task needs it and the user separately approves it.

The installed CLI may expose experimental `codex remote-control` start/stop/pair commands.
Treat that as a fallback only after current official docs and `--help` confirm it. Starting
the daemon and displaying a pairing code require explicit approval; never capture the code
in chat, logs, screenshots, or files. Never expose app-server transports directly.

To disable access, stop the managed connection/daemon using the current official UI or CLI,
then revoke the device in Connections. Verify from the phone that the host is unavailable.

## Claude Code Remote Control

1. Verify `claude --version` meets the current official minimum, sign in with the intended
   Claude subscription account, and open the project locally once to accept workspace trust.
   API-key authentication is not supported for Remote Control. Team/Enterprise may require
   an administrator to enable the feature.
2. From the project directory, start `claude remote-control`, or use `/remote-control` in an
   existing interactive session. The local terminal may display a URL or QR code; the human
   opens it directly and never copies it into chat or project files.
3. On Claude mobile (iOS/Android), sign in to the same account/organization and open **Code**;
   alternatively use <https://claude.ai/code>. Give the session a non-sensitive name.
4. Test a harmless read-only request, then an action that must ask permission. Confirm the
   local project, tools, MCPs, and permission prompts behave as expected.

Automatic Remote Control for every Claude session and mobile push notifications are separate
opt-ins under Claude Code configuration. Explain their persistence and privacy impact and ask
before enabling either. Do not use `bypassPermissions` for phone convenience. Stop the local
server/session and disable the all-session toggle to turn access off.

## Guide, setup, doctor, and disable

- `guide` (default): explain provider choices, requirements, security, test, and revocation;
  do not change anything.
- `setup`: run the read-only doctor, show the exact actions and security preview, then pause
  for explicit confirmation before any daemon start, pairing, login, persistent setting, or
  notification opt-in. The human completes QR/code handling locally.
- `doctor`: inspect installed app/CLI versions and current official help only. Report
  `READY`, `PARTIAL`, or `BLOCKED` without starting or changing a connection.
- `disable`: first identify the exact provider/session/device and preview the stop/revoke
  action. Require confirmation before changing external state, then verify disconnection.

End with a compact **PHONE ACCESS CARD**: selected provider, readiness, host requirements,
local human steps, phone steps, validation, security boundaries, disable path, and any TODO.
