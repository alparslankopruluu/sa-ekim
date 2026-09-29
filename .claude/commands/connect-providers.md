---
description: Safely connect and verify Firebase, RevenueCat MCP/OAuth, and optional fal.ai
argument-hint: [firebase|revenuecat|fal|all]
---

Read `docs/playbooks/ai-media.md`, `docs/playbooks/firebase.md`, and
`docs/checklists/security.md`. This command configures no product and performs no paid
request, deployment, billing, catalog mutation, or secret write.

1. Parse `$ARGUMENTS` (`firebase`, `revenuecat`, `fal`, or `all`; default `all`). Run
   `scripts/provider-doctor.sh`; never echo its environment or capture it in factory state.
2. Firebase: run `firebase login:list`, then report the selected account redacted. For an
   existing app, list the project only and give the exact later evidence required for
   DebugView, Crashlytics, and Performance Monitoring.
3. RevenueCat: inspect whether its MCP is callable. If missing, explain that MCP is
   user-level configuration and show the exact proposed configuration/install diff; stop
   for approval before changing it. If available, invoke the provider's OAuth login flow
   and perform a read-only project/entitlement/offering list. Never request a secret API
   key in chat or add it to a project config.
4. fal: ask the operator to enter their key directly in their own terminal, for example
   `read -s FAL_KEY; export FAL_KEY; unset REPLY`, or directly into the Firebase Secret
   Manager prompt when an approved runtime Function is deployed. Do not ask them to paste
   it into this conversation. Confirm only that `FAL_KEY` is present, then state that a
   future approved dev probe may incur provider cost.
5. Report READY/PARTIAL and the next exact human action. Record only provider name,
   connection status, and timestamp in a status card; never store credential values.

An established MCP/OAuth connection never authorizes catalog writes, billing, deploys, or
provider usage beyond the explicit task.
