#!/usr/bin/env python3
"""PreToolUse hook for Bash. Deterministic backstop for the destructive patterns
CLAUDE.md forbids in prose but that .claude/settings.json's string-prefix
`permissions` matcher cannot catch: compound commands, quoting, command
substitution, and one level of interpreter indirection. This is a backstop, not
a sandbox: it blocks the forms an agent would plausibly write, it cannot model
arbitrary shell metaprogramming (multi-level eval, variable indirection).

Exit 0: allow. Exit 2: block, message goes to stderr and Claude sees it.
Unexpected internal errors fail CLOSED (exit 2) so a hook regression can never
silently disable the guard.
"""
import fnmatch
import json
import os
import re
import shlex
import sys

WRAPPERS = ("sudo", "env", "command", "nohup", "time", "nice")
SHELLS = ("sh", "bash", "zsh", "dash")
BROAD_TARGETS = ("/", "~", "..", ".", "*", ".git")
HOME_TOKENS = ("~", "~/", "$HOME", "${HOME}", "$HOME/", "${HOME}/")
# Temp trees are legitimate deletion targets even outside the project root.
SAFE_ABS_PREFIXES = ("/tmp/", "/private/tmp/", "/var/folders/", "/private/var/folders/")
SECRET_BASENAMES = (
    ".env",
    ".env.*",
    "*.p8",
    "*.jks",
    "*.keystore",
    "play-service-account.json",
    "GoogleService-Info.plist",
    "google-services.json",
    "Secrets.xcconfig",
)
SECRET_READERS = (
    "cat", "head", "tail", "less", "more", "strings", "base64", "xxd", "od",
    "cp", "scp", "curl", "open", "source", ".",
)
FIND_NAME_FILTERS = ("-name", "-iname", "-path", "-ipath", "-regex", "-iregex")
PY_DANGEROUS = re.compile(
    r"shutil\s*\.\s*rmtree|os\s*\.\s*(remove|unlink|rmdir|system)|"
    r"subprocess[^;\n]*\brm\b|pathlib[^;\n]*\bunlink\b"
)


def split_outside_quotes(cmd: str):
    """Split on && || ; | and newlines, but only outside quotes so that quoted
    payloads (e.g. `python3 -c "a; b"`) stay one segment."""
    parts = []
    buf = []
    quote = None
    i = 0
    while i < len(cmd):
        ch = cmd[i]
        if quote:
            buf.append(ch)
            if ch == "\\" and quote == '"' and i + 1 < len(cmd):
                buf.append(cmd[i + 1])
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            buf.append(ch)
            i += 1
            continue
        if ch == "\\" and i + 1 < len(cmd):
            buf.append(ch)
            buf.append(cmd[i + 1])
            i += 2
            continue
        two = cmd[i:i + 2]
        if two in ("&&", "||"):
            parts.append("".join(buf))
            buf = []
            i += 2
            continue
        if ch in (";", "|", "\n"):
            parts.append("".join(buf))
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    parts.append("".join(buf))
    return parts


def segments(cmd: str):
    parts = split_outside_quotes(cmd)
    parts += [a or b for a, b in re.findall(r"\$\(([^)]*)\)|`([^`]*)`", cmd)]
    return [p.strip() for p in parts if p.strip()]


def block(msg: str) -> str:
    return msg


def is_home_root(token: str) -> bool:
    return token.rstrip("/") in ("~", "$HOME", "${HOME}") or token in HOME_TOKENS


def resolves_outside_project(target: str) -> bool:
    """True when target is an absolute path outside the project root and outside
    known temp trees. Skipped entirely when CLAUDE_PROJECT_DIR is unset."""
    project = os.environ.get("CLAUDE_PROJECT_DIR", "").rstrip("/")
    if not project or not target.startswith("/"):
        return False
    norm = os.path.normpath(target)
    if norm == "/":
        return True
    if any((norm + "/").startswith(p) for p in SAFE_ABS_PREFIXES):
        return False
    return not (norm + "/").startswith(project + "/")


def strip_wrappers(tokens):
    """Drop sudo/env/etc. prefixes and leading VAR=VAL assignments."""
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok in WRAPPERS or re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", tok):
            i += 1
            continue
        break
    return tokens[i:]


def rm_verdict(tokens):
    flags = []
    targets = []
    literal_only = False
    for tok in tokens[1:]:
        if literal_only or not tok.startswith("-") or tok == "-":
            targets.append(tok)
        elif tok == "--":
            literal_only = True
        elif tok.startswith("--"):
            flags.append(tok)
        else:
            flags.extend(tok[1:])
    recursive = "r" in flags or "R" in flags or "--recursive" in flags
    force = "f" in flags or "--force" in flags
    if not (recursive and force):
        return None
    if not targets:
        return block("`rm -rf` with no explicit target")
    for t in targets:
        base = t.rstrip("/") or "/"
        if base in BROAD_TARGETS or t in ("./", "/*"):
            return block(f"`rm -rf` on broad target `{t}`")
        if is_home_root(t):
            return block(f"`rm -rf` on the home directory (`{t}`)")
        if t.startswith("/") and (t == "/*" or re.fullmatch(r"/[^/]*\*", t)):
            return block(f"`rm -rf` on a root-level glob `{t}`")
        if resolves_outside_project(t):
            return block(
                f"`rm -rf` on `{t}`, an absolute path outside the project root"
            )
    return None


def find_verdict(tokens):
    has_delete = "-delete" in tokens
    exec_rm = any(
        tok == "-exec" and i + 1 < len(tokens) and tokens[i + 1] == "rm"
        for i, tok in enumerate(tokens)
    )
    if not (has_delete or exec_rm):
        return None
    paths = []
    for tok in tokens[1:]:
        if tok.startswith("-") or tok in ("!", "(", ")"):
            break
        paths.append(tok)
    if not paths:
        paths = ["."]
    for p in paths:
        if p.rstrip("/") in ("/", "") or is_home_root(p):
            return block(f"`find {p} … -delete/-exec rm` over a broad root")
        if resolves_outside_project(p):
            return block(f"`find {p} … -delete` outside the project root")
    filtered = any(f in tokens for f in FIND_NAME_FILTERS)
    if not filtered and all(p in (".", "..", "./") for p in paths):
        return block("unfiltered `find . -delete/-exec rm` (deletes everything)")
    return None


def xargs_verdict(tokens):
    if "rm" not in tokens[1:]:
        return None
    tail = tokens[tokens.index("rm"):]
    if rm_flags_recursive_force(tail):
        return block("`xargs rm -rf` — deletion targets are not statically knowable")
    return None


def rm_flags_recursive_force(tokens):
    flags = []
    for tok in tokens[1:]:
        if tok.startswith("--"):
            flags.append(tok)
        elif tok.startswith("-") and tok != "-":
            flags.extend(tok[1:])
    recursive = "r" in flags or "R" in flags or "--recursive" in flags
    force = "f" in flags or "--force" in flags
    return recursive and force


def git_push_verdict(tokens):
    if len(tokens) < 2 or tokens[0] != "git" or tokens[1] != "push":
        return None
    rest = tokens[2:]
    forced = any(t in ("--force", "-f") for t in rest) and (
        "--force-with-lease" not in rest
    )
    positionals = [t for t in rest if not t.startswith("-") or t.startswith("+")]
    refspecs = positionals[1:] if positionals else []
    forced_refspec = any(t.startswith("+") for t in refspecs)

    def protected(ref):
        r = ref.lstrip("+")
        return (
            r in ("main", "master")
            or r.endswith(":main")
            or r.endswith(":master")
            or r.endswith("refs/heads/main")
            or r.endswith("refs/heads/master")
        )

    if forced_refspec and any(protected(r) for r in refspecs if r.startswith("+")):
        return block("force push (`+refspec`) to main/master")
    if forced:
        if not refspecs:
            return block("ambiguous force push with no refspec (could target main)")
        if any(protected(r) for r in refspecs):
            return block("force push to main/master")
    return None


def secret_read_verdict(tokens):
    if tokens[0] not in SECRET_READERS:
        return None
    for tok in tokens[1:]:
        if tok.startswith("-"):
            continue
        base = os.path.basename(tok.rstrip("/"))
        if base.endswith(".example") or base.endswith(".sample"):
            continue
        for pat in SECRET_BASENAMES:
            if fnmatch.fnmatch(base, pat):
                return block(
                    f"reading secret file `{tok}` via Bash — the Read deny list "
                    "covers these; do not route around it"
                )
    return None


def firebase_verdict(tokens):
    if tokens[0] == "firebase":
        rest = tokens[1:]
    elif tokens[0] == "npx" and len(tokens) > 1 and tokens[1] in ("firebase", "firebase-tools"):
        rest = tokens[2:]
    else:
        return None
    if "deploy" in rest and "--only" not in rest:
        return block("bare `firebase deploy` — use `firebase deploy --only <target>`")
    return None


def interpreter_verdict(tokens, depth):
    head = tokens[0]
    if head in SHELLS and "-c" in tokens:
        idx = tokens.index("-c")
        if idx + 1 < len(tokens):
            if depth >= 1:
                return block("nested shell `-c` more than one level deep")
            return check_command(tokens[idx + 1], depth + 1)
    if head in ("python", "python3") and "-c" in tokens:
        idx = tokens.index("-c")
        code = tokens[idx + 1] if idx + 1 < len(tokens) else ""
        if PY_DANGEROUS.search(code):
            return block("`python -c` with filesystem-destructive calls")
    return None


def raw_fallback_verdict(seg):
    """Conservative checks when shlex cannot tokenize (unbalanced quotes)."""
    if re.search(r"\brm\s+(-[a-zA-Z-]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*f|"
                 r"\brm\s+(-[a-zA-Z-]+\s+)*-[a-zA-Z]*f[a-zA-Z]*[rR]|"
                 r"\brm\s+--recursive", seg):
        return block(f"unparseable quoting around an `rm -rf`-style command: `{seg}`")
    if re.search(r"\bfirebase\s+deploy\b", seg) and "--only" not in seg:
        return block(f"bare `firebase deploy` in `{seg}`")
    return None


def check_segment(seg, depth=0):
    try:
        tokens = shlex.split(seg, comments=True, posix=True)
    except ValueError:
        return raw_fallback_verdict(seg)
    tokens = strip_wrappers(tokens)
    if not tokens:
        return None

    for tok in tokens:
        if tok == "--dangerously-skip-permissions":
            return block("`--dangerously-skip-permissions` is forbidden (CLAUDE.md #13)")

    verdict = firebase_verdict(tokens)
    if verdict:
        return verdict
    verdict = git_push_verdict(tokens)
    if verdict:
        return verdict
    verdict = secret_read_verdict(tokens)
    if verdict:
        return verdict
    verdict = interpreter_verdict(tokens, depth)
    if verdict:
        return verdict

    head = tokens[0]
    if head == "rm":
        return rm_verdict(tokens)
    if head == "find":
        return find_verdict(tokens)
    if head == "xargs":
        return xargs_verdict(tokens)
    return None


def check_command(cmd, depth=0):
    if re.search(r"\b(base64|curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|dash)\b", cmd):
        return block("piping a decoder/downloader into a shell")
    for seg in segments(cmd):
        verdict = check_segment(seg, depth)
        if verdict:
            return verdict
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    if payload.get("tool_name") != "Bash":
        return 0
    tool_input = payload.get("tool_input")
    cmd = tool_input.get("command") if isinstance(tool_input, dict) else None
    if cmd is None:
        return 0
    if not isinstance(cmd, str):
        print("BLOCKED: guard_bash received a non-string command payload.", file=sys.stderr)
        return 2
    if not cmd.strip():
        return 0

    verdict = check_command(cmd)
    if verdict:
        print(f"BLOCKED: {verdict}.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as exc:  # fail closed: a broken guard must not disable itself
        print(f"BLOCKED: guard_bash internal error ({exc!r}); fix the hook.", file=sys.stderr)
        sys.exit(2)
