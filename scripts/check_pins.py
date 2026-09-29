#!/usr/bin/env python3
"""Report upstream drift for every git-pinned dependency in docs/pins.json.

Mechanizes the detection half of the audit rule in
docs/playbooks/ios-expert-tools.md / android-expert-tools.md ("compare each
upstream HEAD with the audited commit before installation"); reviewing what
changed and deciding to bump stays human. Read-only: never installs, never
modifies anything.

A pin may declare `"watchPaths": ["dir", ...]`. Drift is then judged per
watched path — "did any commit after the pin touch this path?" — instead of
comparing against repo HEAD, so unrelated upstream commits stop flagging a
vendored subdirectory (e.g. vercel-labs/skills vs its find-skills/ dir).

Exit codes: 0 all pins clean, 3 drift detected, 2 network or API error
(unknown state).
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
API_BASE = "https://api.github.com/repos/%s"
NETWORK_ERRORS = (urllib.error.URLError, OSError, ValueError, KeyError)


def _github_token() -> str:
    """Path-scoped checking makes dozens of API calls; unauthenticated GitHub
    allows only 60/hour. Use GITHUB_TOKEN/GH_TOKEN or the gh CLI's stored token
    when available. The token is only sent to api.github.com."""
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        return token
    if shutil.which("gh"):
        result = subprocess.run(
            ["gh", "auth", "token"], capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return result.stdout.strip()
    return ""


TOKEN = _github_token()


def api_get(url: str):
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "app-factory-check-pins",
    }
    if TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def head_commit(repo: str, path: str = ""):
    """Latest commit in the repo, or the latest commit touching `path`."""
    url = (API_BASE % repo) + "/commits?per_page=1"
    if path:
        url += "&path=" + urllib.parse.quote(path)
    payload = api_get(url)
    if not payload:
        return None, None
    commit = payload[0]
    return commit.get("sha"), commit.get("commit", {}).get("committer", {}).get("date")


def is_ahead_of_pin(repo: str, pin: str, sha: str) -> bool:
    """True when `sha` contains work the pinned commit does not."""
    if sha == pin:
        return False
    status = api_get((API_BASE % repo) + "/compare/%s...%s" % (pin, sha)).get("status")
    return status in ("ahead", "diverged")


def check_whole_repo(pin) -> str:
    repo = pin["source"].split(":", 1)[1]
    sha, date = head_commit(repo)
    if sha is None:
        print("? %-28s %s (no commits visible)" % (pin["id"], repo))
        return "error"
    if sha == pin["pin"]:
        print("= %-28s %s pinned at HEAD" % (pin["id"], repo))
        return "clean"
    print(
        "! %-28s %s drifted: pinned %s, HEAD %s (%s) — review upstream before bumping"
        % (pin["id"], repo, pin["pin"][:12], sha[:12], date)
    )
    return "drift"


def check_watched_paths(pin) -> str:
    repo = pin["source"].split(":", 1)[1]
    repo_sha, _ = head_commit(repo)
    if repo_sha == pin["pin"]:
        print("= %-28s %s pinned at HEAD" % (pin["id"], repo))
        return "clean"
    drifted = []
    for path in pin["watchPaths"]:
        sha, date = head_commit(repo, path)
        if sha is None:
            print("? %-28s %s (path %s has no commits visible)" % (pin["id"], repo, path))
            return "error"
        if is_ahead_of_pin(repo, pin["pin"], sha):
            drifted.append((path, sha, date))
    if drifted:
        for path, sha, date in drifted:
            print(
                "! %-28s %s path %s drifted: pinned %s, last touch %s (%s) — review upstream before bumping"
                % (pin["id"], repo, path, pin["pin"][:12], sha[:12], date)
            )
        return "drift"
    print(
        "= %-28s %s repo is ahead but watched paths untouched (%d paths clean)"
        % (pin["id"], repo, len(pin["watchPaths"]))
    )
    return "clean"


def main() -> int:
    manifest = json.loads((ROOT / "docs" / "pins.json").read_text(encoding="utf-8"))
    git_pins = [
        pin for pin in manifest["pins"] if pin.get("source", "").startswith("github:")
    ]
    drift = False
    errors = False
    for pin in git_pins:
        try:
            if pin.get("watchPaths"):
                outcome = check_watched_paths(pin)
            else:
                outcome = check_whole_repo(pin)
        except NETWORK_ERRORS as exc:
            print("? %-28s %s (error: %s)" % (pin["id"], pin["source"], exc))
            errors = True
            continue
        drift = drift or outcome == "drift"
        errors = errors or outcome == "error"
    if errors:
        return 2
    return 3 if drift else 0


if __name__ == "__main__":
    sys.exit(main())
