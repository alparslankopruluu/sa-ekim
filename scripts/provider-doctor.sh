#!/usr/bin/env bash
set -euo pipefail

# Read-only credential presence check. It deliberately never prints a value or calls a
# paid provider endpoint. Provider OAuth/MCP readback happens in the harness.

status=0
check_env() {
  local name="$1"
  if [ -n "${!name:-}" ]; then
    printf 'READY   %s is available in this shell (value redacted)\n' "$name"
  else
    printf 'ACTION  %s is not available in this shell\n' "$name"
    status=1
  fi
}

printf '%s\n' 'Provider connection doctor — no secrets are printed or persisted.'
if command -v firebase >/dev/null 2>&1; then
  printf '%s\n' 'READY   Firebase CLI is installed; run firebase login:list for authenticated-account readback.'
else
  printf '%s\n' 'ACTION  Firebase CLI is not installed.'
  status=1
fi

check_env FAL_KEY
printf '%s\n' 'INFO    RevenueCat uses MCP OAuth/Keychain; inspect connected MCP tools and run a read-only catalog list.'
printf '%s\n' 'INFO    FAL_KEY is required only for selected fal.ai work; unset is expected for non-AI apps.'
exit "$status"
