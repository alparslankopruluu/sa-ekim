#!/usr/bin/env python3
"""PostToolUse hook for Write/Edit/MultiEdit. Soft nudge only — the write already
happened, so this cannot revert anything; it scans the single touched file for a
small, high-value subset of CLAUDE.md #4 patterns and, on a hit, exits 2 so Claude
sees the finding and can follow up with another edit. False positives are expected
and acceptable for a nudge. Internal errors fail closed (exit 2) so a hook
regression is visible instead of silently disabling the nudge.
"""
import json
import os
import re
import sys

TEST_COMPONENTS = ("test", "tests", "__tests__", "spec", "specs")
TEST_FILENAME_RE = re.compile(r"(_test|_spec|Tests?|\.test|\.spec)\.[A-Za-z]+$")


def is_test_path(path: str) -> bool:
    """Component-based test detection. A path is test-like only when a path
    component *relative to the project root* is a test directory, or the
    filename itself is test-shaped — not when e.g. the user's home directory
    happens to contain the substring 'test'."""
    project = os.environ.get("CLAUDE_PROJECT_DIR", "").rstrip("/")
    rel = path
    if project and path.startswith(project + "/"):
        rel = path[len(project) + 1:]
    else:
        rel = os.path.basename(path)
    parts = rel.lower().split(os.sep)
    if any(p in TEST_COMPONENTS for p in parts[:-1]):
        return True
    return bool(TEST_FILENAME_RE.search(os.path.basename(path)))


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    if payload.get("tool_name") not in ("Write", "Edit", "MultiEdit"):
        return 0
    tool_input = payload.get("tool_input")
    path = tool_input.get("file_path", "") if isinstance(tool_input, dict) else ""
    if not isinstance(path, str) or not path or not os.path.isfile(path):
        return 0

    is_test = is_test_path(path)
    findings = []

    try:
        text = open(path, encoding="utf-8", errors="ignore").read()
    except OSError:
        return 0
    lines = text.splitlines()

    if path.endswith(".swift"):
        for i, line in enumerate(lines, 1):
            if re.search(r"\btry!", line) or re.search(r"\bas!\s", line):
                findings.append(
                    f"{path}:{i}: `try!`/`as!` — CLAUDE.md #9 forbids force-unwrap on "
                    "values that can be nil/throw at runtime; use `try?`/guard/if-let."
                )
        if not is_test:
            for i, line in enumerate(lines, 1):
                scan = line.replace("!==", "").replace("!=", "")
                if re.search(r"[A-Za-z0-9_\)\]]!(?!=)", scan):
                    findings.append(
                        f"{path}:{i}: possible force-unwrap `!` — confirm this value "
                        "cannot be nil here, or use `guard let`/`if let` (CLAUDE.md #9)."
                    )
                    break  # one hit is enough signal per file; avoid noisy repeats

    if not is_test and path.endswith((".swift", ".ts", ".tsx", ".js", ".jsx")):
        for i, line in enumerate(lines, 1):
            if re.search(r"\bconsole\.log\s*\(", line) or re.search(
                r"(?<!//)\bprint\s*\(", line
            ):
                findings.append(
                    f"{path}:{i}: `console.log`/`print(` left in non-test code "
                    "(CLAUDE.md #8) — remove before committing."
                )

    if path.endswith("firestore.rules") and re.search(
        r"allow\s+(read\s*,\s*)?write\s*:\s*if\s+true", text
    ):
        findings.append(
            f"{path}: world-writable Firestore rule (`allow … write: if true`) — "
            "CLAUDE.md #3 forbids this."
        )

    if findings:
        print(
            "REVIEW NUDGE (write already made; fix in a follow-up edit):",
            file=sys.stderr,
        )
        for f in findings[:5]:
            print(f" - {f}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as exc:  # fail closed: surface hook regressions loudly
        print(f"REVIEW NUDGE: guard_edit internal error ({exc!r}); fix the hook.", file=sys.stderr)
        sys.exit(2)
