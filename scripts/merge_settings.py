#!/usr/bin/env python3
"""Merge the kit's .claude/settings.json into an existing project's settings.

Used by install.sh --existing when the target already has .claude/settings.json
(the case `rsync --ignore-existing` silently skips). Deliberately dumb: it only
touches `permissions.allow/ask/deny` and `hooks`, preserves every other key in
the target verbatim, and is idempotent. The pre-merge file is backed up to
settings.json.pre-factory once.

Placement rule for permission entries present on both sides: the stricter list
wins (deny > ask > allow).

Usage: merge_settings.py KIT_SETTINGS TARGET_SETTINGS
Exit 0 on success (including no-op), nonzero on unreadable/unwritable input.
"""
import json
import os
import sys
import tempfile

LEVELS = ("deny", "ask", "allow")  # strictest first


def entry_levels(settings):
    perms = settings.get("permissions", {})
    placement = {}
    for level in LEVELS:
        for entry in perms.get(level, []):
            # First (strictest) placement wins when an entry is duplicated.
            placement.setdefault(entry, level)
    return placement


def merge_permissions(kit, target):
    kit_place = entry_levels(kit)
    target_place = entry_levels(target)
    final = {}
    for entry, level in target_place.items():
        kit_level = kit_place.get(entry)
        if kit_level and LEVELS.index(kit_level) < LEVELS.index(level):
            final[entry] = kit_level
        else:
            final[entry] = level
    for entry, level in kit_place.items():
        final.setdefault(entry, level)

    merged = dict(target.get("permissions", {}))
    kit_perms = kit.get("permissions", {})
    for level in LEVELS:
        ordered = []
        for entry in target.get("permissions", {}).get(level, []):
            if final.get(entry) == level and entry not in ordered:
                ordered.append(entry)
        for source in (target.get("permissions", {}), kit_perms):
            for src_level in LEVELS:
                for entry in source.get(src_level, []):
                    if final.get(entry) == level and entry not in ordered:
                        ordered.append(entry)
        merged[level] = ordered
    return merged


def hook_commands(event_groups):
    commands = set()
    for group in event_groups:
        for hook in group.get("hooks", []):
            command = hook.get("command")
            if command:
                commands.add(command)
    return commands


def merge_hooks(kit, target):
    merged = {key: list(value) for key, value in target.get("hooks", {}).items()}
    for event, kit_groups in kit.get("hooks", {}).items():
        existing = merged.setdefault(event, [])
        present = hook_commands(existing)
        for group in kit_groups:
            commands = {
                hook.get("command")
                for hook in group.get("hooks", [])
                if hook.get("command")
            }
            if commands and commands.issubset(present):
                continue
            existing.append(group)
            present.update(commands)
    return merged


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: merge_settings.py KIT_SETTINGS TARGET_SETTINGS", file=sys.stderr)
        return 2
    kit_path, target_path = sys.argv[1], sys.argv[2]
    try:
        kit = json.loads(open(kit_path, encoding="utf-8").read())
        target = json.loads(open(target_path, encoding="utf-8").read())
        if not isinstance(kit, dict) or not isinstance(target, dict):
            raise ValueError("settings must be JSON objects")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"merge_settings: cannot read inputs: {exc}", file=sys.stderr)
        return 1

    merged = dict(target)
    merged["permissions"] = merge_permissions(kit, target)
    merged["hooks"] = merge_hooks(kit, target)

    rendered = json.dumps(merged, indent=2, ensure_ascii=False) + "\n"
    current = open(target_path, encoding="utf-8").read()
    if rendered == current:
        return 0

    backup = target_path + ".pre-factory"
    if not os.path.exists(backup):
        with open(backup, "w", encoding="utf-8") as fh:
            fh.write(current)
    directory = os.path.dirname(os.path.abspath(target_path))
    fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(rendered)
        os.replace(tmp, target_path)
    except OSError as exc:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        print(f"merge_settings: cannot write output: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
