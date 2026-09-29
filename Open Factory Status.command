#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="${0:A:h}"
"${PROJECT_ROOT}/scripts/open-factory-status.command" --background
echo "Factory Status is open. This project is registered; reopen it from the Factory menu-bar icon."
