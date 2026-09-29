#!/usr/bin/env python3
"""Local, secret-free run state for app-factory.

The file intentionally uses only the Python standard library so generated apps can
use it before their language toolchain or package manager has been bootstrapped.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple


SCHEMA_VERSION = 1
RUN_SCHEMA_VERSION = 2
CAPABILITY_CATALOG_SCHEMA_VERSION = 3
CAPABILITY_STATE_SCHEMA_VERSION = 2
CONTEXT_CAPSULE_SCHEMA_VERSION = 2
RECEIPT_SCHEMA_VERSION = 2
KNOWLEDGE_INDEX_SCHEMA_VERSION = 1
SESSION_SCHEMA_VERSION = 1
HARNESS_ADAPTER_VERSION = "1.0"
HARNESS_TARGETS = {"codex", "claude", "cli"}
HARNESS_CONTRACT_KINDS = {"capsule", "receipt", "workflow"}
EVENT_LIMIT = 20
TASK_STATUSES = {
    "queued",
    "running",
    "waiting_human",
    "blocked",
    "succeeded",
    "skipped",
    "failed",
    "review_pending",
    "needs_revision",
}
DONE_STATUSES = {"succeeded", "skipped"}
LOCALE_PROFILES = {"launch", "extended"}
EXECUTION_LANES = {"local", "cloud_safe"}
ANDROID_SCOPES = {"core", "shipped", "planned"}
ANDROID_DELIVERY_TARGETS = {"local", "internal", "production-ready"}
ANDROID_PHASES = (
    "source_audit",
    "parity_contract",
    "implementation",
    "backend_parity",
    "quality",
    "local_aab",
    "play_internal",
    "production_ready",
)
ANDROID_MAX_PHASE = {
    "local": "local_aab",
    "internal": "play_internal",
    "production-ready": "production_ready",
}
LIFECYCLE_STAGES = {"setup", "discovery", "planning", "build", "release", "post_launch"}
RECOMMENDATION_PRIORITIES = {"now", "next", "later"}
RECOMMENDATION_STATUSES = {"suggested", "todo", "dismissed", "completed"}
QUEUE_PLACEMENTS = {"after_current_checkpoint", "after_milestone", "later"}
CAPABILITY_RISKS = {"read_only", "local_write", "approval_gated_external"}
DELEGATION_MODES = {"none", "cloud_safe"}
AVAILABILITY_STATES = {"ready", "setup_required", "unavailable"}
CAPABILITY_CADENCES = {"none", "once", "on_demand", "milestone", "daily", "weekly", "monthly", "release"}
CAPABILITY_ROLES = {
    "product_ceo",
    "product_owner",
    "design_director",
    "onboarding_conversion",
    "monetization_lead",
    "tech_lead",
    "security_review",
    "video_producer",
    "growth_lead",
    "reliability_operator",
    "release_manager",
}
ASC_FACTORY_SKILLS = (
    "asc-cli-usage",
    "asc-id-resolver",
    "asc-app-create-ui",
    "asc-signing-setup",
    "asc-xcode-build",
    "asc-shots-pipeline",
    "asc-metadata-sync",
    "asc-localize-metadata",
    "asc-submission-health",
    "asc-testflight-orchestration",
    "asc-revenuecat-catalog-sync",
    "asc-subscription-localization",
    "asc-ppp-pricing",
    "asc-build-lifecycle",
)
PROFILE_KEYS = {
    "appleTeamId",
    "testerEmail",
    "testerGroup",
    "supportEmail",
    "supportUrl",
    "privacyUrl",
    "termsUrl",
    "firebaseAccount",
    "cloudflareAccountId",
}

SECRET_KEY_RE = re.compile(
    r"(?:api[_-]?key|private[_-]?key|client[_-]?secret|secret|password|passwd|token|authorization|credential)",
    re.IGNORECASE,
)
SAFE_METRIC_KEYS = {
    "estimatedTokens",
    "routerEstimatedTokens",
    "bootstrapEstimatedTokens",
    "docSliceEstimatedTokens",
    "inputTokens",
    "cachedTokens",
    "outputTokens",
    "bootstrapTokenLimit",
    "capsuleTokenSoftLimit",
}
# Keep these fallback pattern strings byte-identical to
# scripts/factory-status/Resources/redaction-patterns.json (parity-tested).
_FALLBACK_SECRET_VALUE_PATTERNS = tuple(
    re.compile(pattern)
    for pattern in (
        r"(?s)-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----",
        r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+",
        r"(?i)\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{8,}\b",
        r"\bsk_[A-Za-z0-9_-]{12,}\b",
        r"(?i)\b(?:sk-|fal-)[A-Za-z0-9_-]{8,}\b",
        r"\bAIza[0-9A-Za-z_-]{20,}\b",
        r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b",
        r"\bghp_[A-Za-z0-9]{20,}\b",
        r"\bgithub_pat_[A-Za-z0-9_]{22,}\b",
        r"\bgh[ousr]_[A-Za-z0-9]{20,}\b",
        r"\bAKIA[0-9A-Z]{16}\b",
        r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b",
        r"\brk_(?:live|test)_[A-Za-z0-9]{8,}\b",
        r"\bwhsec_[A-Za-z0-9]{16,}\b",
        r"\bnpm_[A-Za-z0-9]{30,}\b",
        r"\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b",
        r"\bAC[0-9a-f]{32}\b",
        r"\bappl_[A-Za-z0-9]{16,}\b",
        r"(?i)\b[a-z][a-z0-9+.-]*://[^/\s:@]+:[^/\s:@]+@[^\s]+",
        r"\bMII[A-Za-z0-9+/=\r\n]{60,}",
    )
)
_FALLBACK_ASSIGNMENT_RE = re.compile(
    r'''(?i)["']?([A-Za-z0-9_.-]*(?:api[_ -]?key|private[_ -]?key|client[_ -]?secret'''
    r'''|secret|password|passwd|token|authorization|credential|access[_ -]?token)'''
    r'''[A-Za-z0-9_.-]*)["']?\s*[:=]\s*(?:["'][^"']+["']|(?!\d+(?:[\s,;]|$))[^\s,;"']+)'''
)


def _load_redaction_patterns() -> Tuple[Tuple[re.Pattern[str], ...], re.Pattern[str]]:
    path = Path(__file__).resolve().parent / "factory-status" / "Resources" / "redaction-patterns.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        values = tuple(re.compile(value) for value in payload["valuePatterns"])
        assignment = re.compile(payload["assignmentPattern"])
        if not values:
            raise ValueError("empty redaction rules")
        return values, assignment
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError, re.error):
        return _FALLBACK_SECRET_VALUE_PATTERNS, _FALLBACK_ASSIGNMENT_RE


SECRET_VALUE_PATTERNS, ASSIGNMENT_RE = _load_redaction_patterns()
VERSION_RE = re.compile(r"(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)")


class FactoryError(RuntimeError):
    """A user-actionable CLI error."""


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _redact_string(value: str) -> str:
    result = value
    for pattern in SECRET_VALUE_PATTERNS:
        result = pattern.sub("[REDACTED]", result)
    result = ASSIGNMENT_RE.sub(lambda match: "%s=[REDACTED]" % match.group(1), result)
    return result


def redact(value: Any, key: str = "") -> Any:
    """Return a JSON-compatible value with secret-shaped content removed."""
    if key and SECRET_KEY_RE.search(key) and key not in SAFE_METRIC_KEYS:
        return "[REDACTED]"
    if isinstance(value, str):
        return _redact_string(value)
    if isinstance(value, dict):
        return {str(k): redact(v, str(k)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, tuple):
        return [redact(item) for item in value]
    return value


def config_home() -> Path:
    override = os.environ.get("APP_FACTORY_CONFIG_HOME")
    return Path(override).expanduser() if override else Path.home() / ".config" / "app-factory"


def profile_path() -> Path:
    return config_home() / "operator.json"


def projects_path() -> Path:
    return config_home() / "projects.json"


def factory_dir(root: Path) -> Path:
    return root.resolve() / ".factory"


def state_path(root: Path) -> Path:
    return factory_dir(root) / "run-state.json"


def android_state_path(root: Path) -> Path:
    return factory_dir(root) / "android-state.json"


def capability_state_path(root: Path) -> Path:
    return factory_dir(root) / "capability-state.json"


def capabilities_path(root: Path) -> Path:
    return root.resolve() / "docs" / "capabilities.json"


def _atomic_json_write(path: Path, payload: Dict[str, Any], mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    clean_payload = redact(payload)
    fd, temporary = tempfile.mkstemp(prefix=".%s." % path.name, suffix=".tmp", dir=str(path.parent))
    temporary_path = Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(clean_payload, handle, ensure_ascii=False, indent=2, sort_keys=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary_path, mode)
        os.replace(temporary_path, path)
        directory_fd = os.open(str(path.parent), os.O_RDONLY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        with contextlib.suppress(FileNotFoundError):
            temporary_path.unlink()


@contextlib.contextmanager
def state_lock(root: Path, namespace: str = "run") -> Iterable[None]:
    directory = factory_dir(root)
    directory.mkdir(parents=True, exist_ok=True)
    lock_path = directory / ("%s-state.lock" % namespace)
    with lock_path.open("a+", encoding="utf-8") as handle:
        os.fchmod(handle.fileno(), 0o600)
        fcntl.lockf(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.lockf(handle.fileno(), fcntl.LOCK_UN)


def _read_json(path: Path) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            result = json.load(handle)
    except FileNotFoundError as exc:
        raise FactoryError("No factory run exists. Start one with `factoryctl.py run init`.") from exc
    except (json.JSONDecodeError, OSError) as exc:
        raise FactoryError("Factory state is unreadable: %s" % exc) from exc
    if not isinstance(result, dict):
        raise FactoryError("Factory state root must be a JSON object.")
    return result


def contract_schema_path(root: Path, kind: str) -> Path:
    if kind not in HARNESS_CONTRACT_KINDS:
        raise FactoryError("Contract kind must be one of: %s" % ", ".join(sorted(HARNESS_CONTRACT_KINDS)))
    return root.resolve() / "docs" / "contracts" / (kind + ".schema.json")


def _json_pointer(path: Sequence[Any]) -> str:
    if not path:
        return ""
    return "/" + "/".join(str(item).replace("~", "~0").replace("/", "~1") for item in path)


def _contract_error(
    code: str,
    path: Sequence[Any],
    expected: Any,
    actual: Any,
    retryable: bool = True,
    approval_impact: str = "none",
) -> Dict[str, Any]:
    return {
        "code": code,
        "instancePath": _json_pointer(path),
        "expected": expected,
        "actual": redact(actual),
        "retryable": retryable,
        "approvalImpact": approval_impact,
    }


def _matches_schema_type(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "null":
        return value is None
    return False


def _validate_schema_value(
    value: Any,
    schema: Dict[str, Any],
    path: Sequence[Any] = (),
) -> List[Dict[str, Any]]:
    """Validate the closed Draft 2020-12 subset used by factory-owned contracts."""
    errors: List[Dict[str, Any]] = []
    raw_type = schema.get("type")
    expected_types = raw_type if isinstance(raw_type, list) else [raw_type] if raw_type else []
    if expected_types and not any(_matches_schema_type(value, item) for item in expected_types):
        return [_contract_error("type_mismatch", path, expected_types, type(value).__name__)]
    if "enum" in schema and value not in schema["enum"]:
        errors.append(_contract_error("invalid_enum", path, schema["enum"], value))
    if isinstance(value, str):
        if len(value) < int(schema.get("minLength", 0)):
            errors.append(_contract_error("min_length", path, schema.get("minLength"), len(value)))
        if schema.get("pattern") and not re.fullmatch(schema["pattern"], value):
            errors.append(_contract_error("pattern_mismatch", path, schema["pattern"], value))
    if isinstance(value, list):
        if len(value) < int(schema.get("minItems", 0)):
            errors.append(_contract_error("min_items", path, schema.get("minItems"), len(value)))
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                errors.extend(_validate_schema_value(item, item_schema, (*path, index)))
    if isinstance(value, dict):
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        for key in required:
            if key not in value:
                errors.append(_contract_error("missing_required", (*path, key), "present", "missing"))
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in properties:
                    errors.append(_contract_error("unknown_field", (*path, key), "not present", value[key]))
        for key, child in value.items():
            child_schema = properties.get(key)
            if isinstance(child_schema, dict):
                errors.extend(_validate_schema_value(child, child_schema, (*path, key)))
    return errors


def _load_contract_schema(root: Path, kind: str) -> Dict[str, Any]:
    path = contract_schema_path(root, kind)
    if not path.is_file():
        bundled = Path(__file__).resolve().parents[1] / "docs" / "contracts" / (kind + ".schema.json")
        if bundled.is_file():
            path = bundled
    try:
        schema = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise FactoryError("Harness contract schema is missing: %s" % path.relative_to(root.resolve())) from exc
    except (json.JSONDecodeError, OSError) as exc:
        raise FactoryError("Harness contract schema is unreadable: %s" % exc) from exc
    if not isinstance(schema, dict):
        raise FactoryError("Harness contract schema root must be an object.")
    return schema


def validate_contract_payload(root: Path, payload: Dict[str, Any], kind: str) -> Dict[str, Any]:
    errors = _validate_schema_value(payload, _load_contract_schema(root, kind))
    return {
        "valid": not errors,
        "kind": kind,
        "schemaVersion": payload.get("schemaVersion"),
        "contractStatus": "current" if not errors else "invalid",
        "errors": errors,
    }


def load_state(root: Path) -> Dict[str, Any]:
    state = _read_json(state_path(root))
    schema = state.get("schemaVersion")
    if schema != RUN_SCHEMA_VERSION:
        raise FactoryError(
            "run state schemaVersion %r is not supported by kit 4; re-init the run" % schema
        )
    return state


def load_android_state(root: Path) -> Dict[str, Any]:
    path = android_state_path(root)
    if not path.exists():
        raise FactoryError("No Android parity run exists. Start one with `factoryctl.py android init`.")
    try:
        state = _read_json(path)
    except FactoryError as exc:
        message = str(exc)
        if message.startswith("Factory state is unreadable"):
            raise FactoryError("Android state is unreadable%s" % message.removeprefix("Factory state is unreadable")) from exc
        if message.startswith("Factory state root"):
            raise FactoryError("Android state root must be a JSON object.") from exc
        if message.startswith("Unsupported factory state schema"):
            raise FactoryError("Unsupported Android state schema%s" % message.removeprefix("Unsupported factory state schema")) from exc
        raise
    if state.get("schemaVersion") != SCHEMA_VERSION:
        raise FactoryError("Unsupported Android state schema: %r" % state.get("schemaVersion"))
    if state.get("scope") not in ANDROID_SCOPES:
        raise FactoryError("Android state contains an invalid scope.")
    if state.get("through") not in ANDROID_DELIVERY_TARGETS:
        raise FactoryError("Android state contains an invalid delivery target.")
    if state.get("phase") not in ANDROID_PHASES:
        raise FactoryError("Android state contains an invalid phase.")
    return state


def _require_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise FactoryError("Capability field %s must be a non-empty string." % field)
    return value.strip()


def load_capability_catalog(root: Path) -> Dict[str, Any]:
    path = capabilities_path(root)
    try:
        with path.open("r", encoding="utf-8") as handle:
            catalog = json.load(handle)
    except FileNotFoundError as exc:
        raise FactoryError("Capability catalog is missing: docs/capabilities.json") from exc
    except (json.JSONDecodeError, OSError) as exc:
        raise FactoryError("Capability catalog is unreadable: %s" % exc) from exc
    if not isinstance(catalog, dict):
        raise FactoryError("Capability catalog root must be a JSON object.")
    if catalog.get("schemaVersion") == 2:
        for item in catalog.get("capabilities", []):
            if not isinstance(item, dict):
                continue
            item.setdefault("triggerExamples", [item.get("title", item.get("id", "capability"))])
            refs = [
                {"path": "PRODUCT.md", "reason": "product truth"},
                {"path": "docs/mvp-plan.md", "reason": "current milestone and scope"},
            ]
            item.setdefault("contextProfile", {"refs": refs, "stateProjection": ["lifecycleStage", "health"]})
            item.setdefault(
                "toolRequirements",
                [
                    check for check in item.get("availabilityChecks", [])
                    if isinstance(check, str) and check.partition(":")[0] in {"command", "skill", "plugin", "mcp"}
                ],
            )
        catalog["schemaVersion"] = CAPABILITY_CATALOG_SCHEMA_VERSION
    if catalog.get("schemaVersion") != CAPABILITY_CATALOG_SCHEMA_VERSION:
        raise FactoryError("Unsupported capability catalog schema: %r" % catalog.get("schemaVersion"))
    capabilities = catalog.get("capabilities")
    if not isinstance(capabilities, list):
        raise FactoryError("Capability catalog must contain a capabilities array.")
    seen: set[str] = set()
    for item in capabilities:
        if not isinstance(item, dict):
            raise FactoryError("Each capability must be an object.")
        capability_id = _require_string(item.get("id"), "id")
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", capability_id):
            raise FactoryError("Capability ID is invalid: %s" % capability_id)
        if capability_id in seen:
            raise FactoryError("Duplicate capability ID: %s" % capability_id)
        seen.add(capability_id)
        _require_string(item.get("title"), "%s.title" % capability_id)
        _require_string(item.get("summary"), "%s.summary" % capability_id)
        _require_string(item.get("claudeInvocation"), "%s.claudeInvocation" % capability_id)
        _require_string(item.get("skillInvocation"), "%s.skillInvocation" % capability_id)
        stages = item.get("stages")
        if not isinstance(stages, list) or not stages or any(stage not in LIFECYCLE_STAGES for stage in stages):
            raise FactoryError("Capability %s has invalid lifecycle stages." % capability_id)
        if item.get("risk") not in CAPABILITY_RISKS:
            raise FactoryError("Capability %s has an invalid risk." % capability_id)
        delegation = item.get("delegation")
        if not isinstance(delegation, dict) or delegation.get("mode") not in DELEGATION_MODES:
            raise FactoryError("Capability %s has invalid delegation." % capability_id)
        max_workers = delegation.get("maxWorkers")
        if not isinstance(max_workers, int) or not 0 <= max_workers <= 3:
            raise FactoryError("Capability %s maxWorkers must be between 0 and 3." % capability_id)
        if delegation.get("mode") == "none" and max_workers != 0:
            raise FactoryError("Capability %s cannot assign workers when delegation is none." % capability_id)
        workflow_policy = item.get("workflowPolicy")
        if workflow_policy is not None:
            required_policy = {
                "strategy",
                "defaultConcurrency",
                "maxConcurrency",
                "defaultTotalAgents",
                "approvalRequiredAboveTotal",
                "requiresWorktreeForWrites",
            }
            if not isinstance(workflow_policy, dict) or set(workflow_policy) != required_policy:
                raise FactoryError("Capability %s has invalid workflowPolicy fields." % capability_id)
            if workflow_policy.get("strategy") != "provider_adaptive":
                raise FactoryError("Capability %s has an invalid workflow strategy." % capability_id)
            for policy_field in (
                "defaultConcurrency",
                "maxConcurrency",
                "defaultTotalAgents",
                "approvalRequiredAboveTotal",
            ):
                value = workflow_policy.get(policy_field)
                if not isinstance(value, int) or isinstance(value, bool) or value < 1:
                    raise FactoryError("Capability %s workflowPolicy.%s must be a positive integer." % (capability_id, policy_field))
            if workflow_policy["defaultConcurrency"] > workflow_policy["maxConcurrency"]:
                raise FactoryError("Capability %s default workflow concurrency exceeds its maximum." % capability_id)
            if workflow_policy["maxConcurrency"] > workflow_policy["defaultTotalAgents"]:
                raise FactoryError("Capability %s workflow concurrency exceeds its total-agent limit." % capability_id)
            if workflow_policy["approvalRequiredAboveTotal"] != workflow_policy["defaultTotalAgents"]:
                raise FactoryError("Capability %s approval threshold must equal its default total-agent limit." % capability_id)
            if workflow_policy.get("requiresWorktreeForWrites") is not True:
                raise FactoryError("Capability %s must isolate parallel workflow writers." % capability_id)
        if item.get("defaultPriority") not in RECOMMENDATION_PRIORITIES:
            raise FactoryError("Capability %s has an invalid default priority." % capability_id)
        if item.get("defaultCadence") not in CAPABILITY_CADENCES:
            raise FactoryError("Capability %s has an invalid default cadence." % capability_id)
        if not isinstance(item.get("rank"), int):
            raise FactoryError("Capability %s rank must be an integer." % capability_id)
        for array_field in ("roleIds", "prerequisites", "availabilityChecks"):
            if not isinstance(item.get(array_field), list) or any(not isinstance(value, str) for value in item[array_field]):
                raise FactoryError("Capability %s field %s must be a string array." % (capability_id, array_field))
        if any(role not in CAPABILITY_ROLES for role in item["roleIds"]):
            raise FactoryError("Capability %s has an invalid role." % capability_id)
        if not isinstance(item.get("recommendable", True), bool) or not isinstance(item.get("promotional", False), bool):
            raise FactoryError("Capability %s recommendation flags must be booleans." % capability_id)
        for optional_string in ("category", "whenUseful"):
            if optional_string in item:
                _require_string(item.get(optional_string), "%s.%s" % (capability_id, optional_string))
        if "platforms" in item and (
            not isinstance(item["platforms"], list)
            or not item["platforms"]
            or any(value not in {"ios", "android", "local", "web"} for value in item["platforms"])
        ):
            raise FactoryError("Capability %s has invalid platforms." % capability_id)
        trigger_examples = item.get("triggerExamples")
        if not isinstance(trigger_examples, list) or not trigger_examples or any(
            not isinstance(value, str) or not value.strip() for value in trigger_examples
        ):
            raise FactoryError("Capability %s has invalid triggerExamples." % capability_id)
        context_profile = item.get("contextProfile")
        if not isinstance(context_profile, dict):
            raise FactoryError("Capability %s has invalid contextProfile." % capability_id)
        refs = context_profile.get("refs")
        if not isinstance(refs, list) or any(
            not isinstance(ref, dict)
            or not isinstance(ref.get("path"), str)
            or not ref.get("path")
            or not isinstance(ref.get("reason"), str)
            for ref in refs
        ):
            raise FactoryError("Capability %s contextProfile.refs is invalid." % capability_id)
        tool_requirements = item.get("toolRequirements")
        if not isinstance(tool_requirements, list) or any(not isinstance(value, str) for value in tool_requirements):
            raise FactoryError("Capability %s has invalid toolRequirements." % capability_id)
    for item in capabilities:
        unknown = set(item["prerequisites"]) - seen
        if unknown:
            raise FactoryError(
                "Capability %s has unknown prerequisites: %s"
                % (item["id"], ", ".join(sorted(unknown)))
            )
    return catalog


def _empty_capability_state(stage: str = "setup") -> Dict[str, Any]:
    now = utc_now()
    return {
        "schemaVersion": CAPABILITY_STATE_SCHEMA_VERSION,
        "lifecycleStage": stage,
        "recommendations": [],
        "unlockNext": [],
        "extras": [],
        "capabilityAvailability": {},
        "lastRefreshAt": None,
        "updatedAt": now,
    }


def load_capability_state(root: Path, allow_missing: bool = True) -> Dict[str, Any]:
    path = capability_state_path(root)
    if not path.exists():
        if allow_missing:
            return _empty_capability_state()
        raise FactoryError("No capability state exists. Run `recommend refresh` first.")
    try:
        with path.open("r", encoding="utf-8") as handle:
            state = json.load(handle)
    except (json.JSONDecodeError, OSError) as exc:
        raise FactoryError("Capability state is unreadable: %s" % exc) from exc
    if not isinstance(state, dict):
        raise FactoryError("Capability state root must be a JSON object.")
    if state.get("schemaVersion") == 1:
        state["schemaVersion"] = CAPABILITY_STATE_SCHEMA_VERSION
        state.setdefault("unlockNext", [])
        state.setdefault("extras", [])
        for extra in state["extras"]:
            if isinstance(extra, dict):
                extra.setdefault("source", "legacy discovery")
                extra.setdefault("verified", False)
    if state.get("schemaVersion") != CAPABILITY_STATE_SCHEMA_VERSION:
        raise FactoryError("Unsupported capability state schema: %r" % state.get("schemaVersion"))
    if state.get("lifecycleStage") not in LIFECYCLE_STAGES:
        raise FactoryError("Capability state contains an invalid lifecycle stage.")
    recommendations = state.get("recommendations")
    if not isinstance(recommendations, list):
        raise FactoryError("Capability state recommendations must be an array.")
    for item in recommendations:
        if not isinstance(item, dict) or item.get("status") not in RECOMMENDATION_STATUSES:
            raise FactoryError("Capability state contains an invalid recommendation.")
        placement = item.get("queuePlacement")
        if placement is not None and placement not in QUEUE_PLACEMENTS:
            raise FactoryError("Capability state contains an invalid queue placement.")
        queue_order = item.get("queueOrder")
        if queue_order is not None and (not isinstance(queue_order, int) or queue_order < 0):
            raise FactoryError("Capability state contains an invalid queue order.")
    state.setdefault("extras", [])
    state.setdefault("unlockNext", [])
    if not isinstance(state["unlockNext"], list):
        raise FactoryError("Capability state unlockNext must be an array.")
    return state


def _save_capability_state(root: Path, state: Dict[str, Any]) -> Dict[str, Any]:
    state["updatedAt"] = utc_now()
    _atomic_json_write(capability_state_path(root), state)
    return state


def set_lifecycle_stage(root: Path, stage: str) -> Dict[str, Any]:
    if stage not in LIFECYCLE_STAGES:
        raise FactoryError("Lifecycle stage must be one of: %s" % ", ".join(sorted(LIFECYCLE_STAGES)))
    with state_lock(root, "capability"):
        state = load_capability_state(root)
        if state.get("lifecycleStage") != stage:
            state["recommendations"] = [
                item for item in state.get("recommendations", []) if item.get("status") != "suggested"
            ]
        state["lifecycleStage"] = stage
        return _save_capability_state(root, state)


def _skill_locations(root: Path) -> List[Path]:
    return [
        root.resolve() / ".agents" / "skills",
        Path.home() / ".codex" / "skills",
        Path.home() / ".claude" / "skills",
        Path.home() / ".agents" / "skills",
    ]


def _configured_codex_plugins() -> Dict[str, Dict[str, str]]:
    config = Path.home() / ".codex" / "config.toml"
    configured: Dict[str, Dict[str, str]] = {}
    try:
        lines = config.read_text(encoding="utf-8").splitlines()
    except OSError:
        return configured
    current: Optional[str] = None
    for line in lines:
        match = re.match(r'^\s*\[plugins\."([a-z0-9._-]+)@([a-z0-9._-]+)"\]\s*$', line, re.IGNORECASE)
        if match:
            current = "%s@%s" % (match.group(1), match.group(2))
            configured[current] = {
                "name": match.group(1),
                "marketplace": match.group(2),
                "enabled": "unknown",
            }
            continue
        if current:
            enabled = re.match(r"^\s*enabled\s*=\s*(true|false)\s*$", line, re.IGNORECASE)
            if enabled:
                configured[current]["enabled"] = enabled.group(1).lower()
            elif line.lstrip().startswith("["):
                current = None
    return configured


def discover_codex_plugins() -> List[Dict[str, Any]]:
    extras: List[Dict[str, Any]] = []
    for key, plugin in sorted(_configured_codex_plugins().items()):
        if plugin.get("enabled") == "false":
            continue
        name = plugin["name"]
        manifest_paths = list((Path.home() / ".codex" / "plugins" / "cache" / plugin["marketplace"] / name).glob("*/.codex-plugin/plugin.json"))
        manifest_paths.append(Path.home() / ".codex" / ".tmp" / "plugins" / "plugins" / name / ".codex-plugin" / "plugin.json")
        manifest: Dict[str, Any] = {}
        manifest_path = next((path for path in reversed(manifest_paths) if path.is_file()), None)
        if manifest_path:
            try:
                payload = json.loads(manifest_path.read_text(encoding="utf-8"))
                manifest = payload if isinstance(payload, dict) else {}
            except (json.JSONDecodeError, OSError):
                pass
        extras.append(
            {
                "id": "extra.plugin.%s" % name,
                "title": manifest.get("name", name),
                "summary": manifest.get("description", "Enabled Codex plugin."),
                "availability": "ready" if manifest else "configured_unverified",
                "skillInvocation": "Plugin: %s" % key,
                "source": key,
                "version": manifest.get("version"),
                "verified": bool(manifest),
                "kind": "plugin",
            }
        )
    return extras


def discover_extra_skills(root: Path, catalog: Dict[str, Any]) -> List[Dict[str, str]]:
    catalog_skills = {
        item.get("skillInvocation", "").split()[0].removeprefix("$")
        for item in catalog.get("capabilities", [])
    }
    extras: Dict[str, Dict[str, str]] = {}
    for directory in _skill_locations(root):
        if not directory.is_dir():
            continue
        for skill_file in directory.glob("*/SKILL.md"):
            name = skill_file.parent.name
            if name in catalog_skills or name in extras:
                continue
            extras[name] = {
                "id": "extra.%s" % name,
                "title": name,
                "summary": "Installed skill; preview its instructions before use.",
                "availability": "ready",
                "skillInvocation": "$%s" % name,
                "source": str(directory),
                "verified": True,
                "kind": "skill",
            }
    return [extras[key] for key in sorted(extras)]


def discover_extra_mcps(root: Path) -> List[Dict[str, str]]:
    names: set[str] = set()
    codex_config = Path.home() / ".codex" / "config.toml"
    if codex_config.is_file():
        try:
            for line in codex_config.read_text(encoding="utf-8").splitlines():
                match = re.match(r'^\s*\[mcp_servers\.(?:"([^"]+)"|([A-Za-z0-9_-]+))\]\s*$', line)
                if match:
                    names.add(match.group(1) or match.group(2))
        except OSError:
            pass
    project_config = root.resolve() / ".mcp.json"
    if project_config.is_file():
        try:
            payload = json.loads(project_config.read_text(encoding="utf-8"))
            servers = payload.get("mcpServers", {}) if isinstance(payload, dict) else {}
            if isinstance(servers, dict):
                names.update(str(name) for name in servers if re.fullmatch(r"[A-Za-z0-9._-]+", str(name)))
        except (json.JSONDecodeError, OSError):
            pass
    return [
        {
            "id": "extra.mcp.%s" % name,
            "title": name,
            "summary": "Configured MCP name; tool and authorization are not yet verified.",
            "availability": "configured_unverified",
            "skillInvocation": "MCP: %s" % name,
            "source": "Codex or project MCP configuration",
            "verified": False,
            "kind": "mcp",
        }
        for name in sorted(names)
    ]


def discover_extras(root: Path, catalog: Dict[str, Any]) -> List[Dict[str, str]]:
    return discover_extra_skills(root, catalog) + discover_codex_plugins() + discover_extra_mcps(root)


def _has_existing_app(root: Path) -> bool:
    project_root = root.resolve()
    root_markers = (
        "Package.swift",
        "package.json",
        "app.json",
        "app.config.js",
        "app.config.ts",
        "Podfile",
        "Cartfile",
    )
    if any((project_root / marker).is_file() for marker in root_markers):
        return True
    if any((project_root / directory).is_dir() for directory in ("ios", "android", "Sources", "src", "app")):
        return True
    project_patterns = ("*.xcodeproj", "*.xcworkspace", "*/*.xcodeproj", "*/*.xcworkspace")
    return any(any(project_root.glob(pattern)) for pattern in project_patterns)


def _is_swiftui_project(root: Path) -> bool:
    """Recognize a generated native-iOS app without executing its toolchain."""
    project_root = root.resolve()
    stack_path = project_root / "docs" / "stack.md"
    try:
        stack_text = stack_path.read_text(encoding="utf-8").lower()
    except OSError:
        return False
    if "swiftui" not in stack_text or "native ios" not in stack_text:
        return False

    ignored_parts = {".git", ".factory", ".build", "build", "DerivedData", "Pods"}
    has_swift_source = any(
        not ignored_parts.intersection(path.relative_to(project_root).parts)
        for path in project_root.rglob("*.swift")
        if path.is_file()
    )
    if not has_swift_source:
        return False
    project_markers = [project_root / "Package.swift"]
    project_markers.extend(project_root.glob("*.xcodeproj"))
    project_markers.extend(project_root.glob("*.xcworkspace"))
    project_markers.extend(project_root.glob("*/*.xcodeproj"))
    project_markers.extend(project_root.glob("*/*.xcworkspace"))
    return any(path.exists() for path in project_markers)


def _is_expo_project(root: Path) -> bool:
    project_root = root.resolve()
    package_path = project_root / "package.json"
    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        package = {}
    dependencies: Dict[str, Any] = {}
    if isinstance(package, dict):
        for field in ("dependencies", "devDependencies"):
            values = package.get(field, {})
            if isinstance(values, dict):
                dependencies.update(values)
    if "expo" in dependencies and any((project_root / marker).exists() for marker in ("app.json", "app.config.js", "app.config.ts", "app")):
        return True
    try:
        stack_text = (project_root / "docs" / "stack.md").read_text(encoding="utf-8").lower()
    except OSError:
        return False
    return "expo" in stack_text and "react native" in stack_text


def _configured_mcp_names(root: Path) -> set[str]:
    return {
        str(item.get("title"))
        for item in discover_extra_mcps(root)
        if isinstance(item.get("title"), str)
    }


def _configured_plugin_names() -> set[str]:
    return {
        str(item.get("title"))
        for item in discover_codex_plugins()
        if item.get("availability") == "ready"
    }


def _availability_details(root: Path, capability: Dict[str, Any]) -> Tuple[str, List[str]]:
    result = "ready"
    missing: List[str] = []
    for raw_check in capability.get("availabilityChecks", []):
        kind, separator, value = raw_check.partition(":")
        if not separator or not value:
            raise FactoryError("Capability %s has an invalid availability check." % capability["id"])
        if kind == "command":
            available = shutil.which(value) is not None
        elif kind == "file":
            available = (root.resolve() / value).exists()
        elif kind == "skill":
            available = any((directory / value / "SKILL.md").is_file() for directory in _skill_locations(root))
        elif kind == "claude_command":
            available = (root.resolve() / ".claude" / "commands" / (value + ".md")).is_file()
        elif kind == "plugin":
            available = value in _configured_plugin_names()
        elif kind == "mcp":
            available = value in _configured_mcp_names(root)
        elif kind == "existing_project":
            if value != "root":
                raise FactoryError("Capability %s has an invalid existing-project signal." % capability["id"])
            if not _has_existing_app(root):
                return "not_applicable", []
            available = True
        elif kind == "stack":
            if value == "swiftui":
                matches = _is_swiftui_project(root)
            elif value == "expo":
                matches = _is_expo_project(root)
            else:
                raise FactoryError("Capability %s has an invalid stack signal." % capability["id"])
            if not matches:
                return "not_applicable", []
            available = True
        elif kind == "milestone":
            if value != "creative-ready":
                raise FactoryError("Capability %s has an invalid milestone signal." % capability["id"])
            available = _creative_work_is_ready(root)
        else:
            raise FactoryError("Capability %s uses unknown availability check %s." % (capability["id"], kind))
        if not available:
            missing.append(raw_check)
            result = "setup_required" if kind in {"command", "skill", "claude_command", "plugin", "mcp"} else "unavailable"
    return result, missing


def _check_availability(root: Path, capability: Dict[str, Any]) -> str:
    return _availability_details(root, capability)[0]


def _milestone_section_is_complete(text: str, milestone: str) -> bool:
    match = re.search(
        r"(?ms)^##\s+%s\b.*?(?=^##\s+M\d+\b|^##\s+Scope Fence|\Z)" % re.escape(milestone),
        text,
    )
    if not match:
        return False
    section = match.group(0)
    checkboxes = re.findall(r"(?m)^\s*-\s*\[([ xX])\]", section)
    return bool(checkboxes) and all(value.lower() == "x" for value in checkboxes)


def _creative_work_is_ready(root: Path) -> bool:
    """Accept explicit factory evidence or a completed M1/M2 memory-bank gate."""
    try:
        run = load_state(root)
        acceptance = next(
            (task for task in run.get("tasks", []) if task.get("id") == "mvp.acceptance"),
            None,
        )
        if acceptance is not None:
            return acceptance.get("status") in DONE_STATUSES
    except FactoryError:
        pass
    try:
        text = (root.resolve() / "docs" / "mvp-plan.md").read_text(encoding="utf-8")
    except OSError:
        return False
    current = re.search(r"(?mi)^\*\*Current milestone:\*\*\s*(M\d+)\s*$", text)
    return bool(
        current
        and current.group(1) == "M3"
        and _milestone_section_is_complete(text, "M1")
        and _milestone_section_is_complete(text, "M2")
    )


def list_capabilities(root: Path, stage: Optional[str] = None, available_only: bool = False) -> Dict[str, Any]:
    if stage is not None and stage not in LIFECYCLE_STAGES:
        raise FactoryError("Unknown lifecycle stage: %s" % stage)
    catalog = load_capability_catalog(root)
    state = load_capability_state(root)
    completed_ids = {
        item.get("capabilityId")
        for item in state.get("recommendations", [])
        if item.get("status") == "completed"
        and (not item.get("dueAt") or not _due_has_passed(item.get("dueAt")))
    }
    items = []
    for capability in catalog["capabilities"]:
        if stage is not None and stage not in capability["stages"]:
            continue
        item = dict(capability)
        unmet = [required for required in capability.get("prerequisites", []) if required not in completed_ids]
        availability, missing = _availability_details(root, capability)
        item["availability"] = "setup_required" if unmet else availability
        item["blockedBy"] = unmet
        item["missingChecks"] = missing
        if available_only and item["availability"] != "ready":
            continue
        items.append(item)
    items.sort(key=lambda item: (item["rank"], item["id"]))
    return {
        "schemaVersion": CAPABILITY_CATALOG_SCHEMA_VERSION,
        "stage": stage,
        "capabilities": items,
        "extras": discover_extras(root, catalog),
    }


def _run_health_is_red(root: Path) -> bool:
    try:
        state = load_state(root)
    except FactoryError:
        return False
    critical_terms = ("crash", "payment", "purchase", "security", "provider", "release", "review")
    for task in state.get("tasks", []):
        if task.get("status") not in {"failed", "blocked"}:
            continue
        haystack = "%s %s" % (task.get("id", ""), task.get("title", ""))
        if state.get("phase") == "release" or any(term in haystack.lower() for term in critical_terms):
            return True
    return False


def _iso_due(cadence: str, now: Optional[dt.datetime] = None) -> Optional[str]:
    moment = now or dt.datetime.now(dt.timezone.utc)
    deltas = {"daily": dt.timedelta(days=1), "weekly": dt.timedelta(days=7), "monthly": dt.timedelta(days=30)}
    if cadence not in deltas:
        return None
    due = (moment + deltas[cadence]).replace(microsecond=0)
    return due.isoformat().replace("+00:00", "Z")


def _due_has_passed(value: Any, now: Optional[dt.datetime] = None) -> bool:
    if not isinstance(value, str):
        return False
    try:
        due = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    return due <= (now or dt.datetime.now(dt.timezone.utc))


def _normalize_queue_placement(value: Optional[str]) -> str:
    aliases = {
        None: "after_milestone",
        "after-current": "after_current_checkpoint",
        "after_current_checkpoint": "after_current_checkpoint",
        "after-milestone": "after_milestone",
        "after_milestone": "after_milestone",
        "later": "later",
    }
    placement = aliases.get(value)
    if placement not in QUEUE_PLACEMENTS:
        raise FactoryError("Queue placement must be after-current, after-milestone, or later.")
    return placement


def _next_queue_order(state: Dict[str, Any], placement: str) -> int:
    orders = [
        item.get("queueOrder", -1)
        for item in state.get("recommendations", [])
        if item.get("status") == "todo" and item.get("queuePlacement") == placement
    ]
    return max(orders, default=-1) + 1


def _queue_sort_key(item: Dict[str, Any]) -> Tuple[int, int, str]:
    placement_order = {
        "after_current_checkpoint": 0,
        "after_milestone": 1,
        "later": 2,
    }
    return (
        placement_order.get(item.get("queuePlacement", "after_milestone"), 1),
        int(item.get("queueOrder", 1_000_000)),
        str(item.get("id", "")),
    )


def _copy_queue_metadata(old: Optional[Dict[str, Any]], new: Dict[str, Any]) -> None:
    if not old:
        return
    for key in ("queuePlacement", "queueOrder", "queuedAt", "dueAt", "recurrence"):
        if key in old:
            new[key] = old[key]


def _new_capability_recommendation(
    root: Path,
    state: Dict[str, Any],
    capability: Dict[str, Any],
    placement: str,
) -> Dict[str, Any]:
    stage = state["lifecycleStage"]
    completed_ids = {
        item.get("capabilityId")
        for item in state.get("recommendations", [])
        if item.get("status") == "completed"
        and (not item.get("dueAt") or not _due_has_passed(item.get("dueAt")))
    }
    unmet = [item for item in capability.get("prerequisites", []) if item not in completed_ids]
    availability = _check_availability(root, capability)
    if unmet:
        availability = "setup_required"
    now = utc_now()
    item: Dict[str, Any] = {
        "id": "%s:%s" % (capability["id"], stage),
        "capabilityId": capability["id"],
        "title": capability["title"],
        "reason": (
            "Complete prerequisite%s first: %s."
            % ("s" if len(unmet) != 1 else "", ", ".join(unmet))
            if unmet
            else _recommendation_reason(stage, capability, _run_health_is_red(root))
        ),
        "priority": "now" if placement == "after_current_checkpoint" else "next" if placement == "after_milestone" else "later",
        "status": "todo",
        "availability": availability,
        "invocation": capability["claudeInvocation"],
        "claudeInvocation": capability["claudeInvocation"],
        "skillInvocation": capability["skillInvocation"],
        "roleIds": capability["roleIds"],
        "executionLane": capability["delegation"]["mode"],
        "maxWorkers": capability["delegation"]["maxWorkers"],
        "requiresApproval": capability["risk"] == "approval_gated_external",
        "queuePlacement": placement,
        "queueOrder": _next_queue_order(state, placement),
        "queuedAt": now,
        "createdAt": now,
        "updatedAt": now,
    }
    if unmet:
        item["blockedBy"] = unmet
    return item


def _recommendation_reason(stage: str, capability: Dict[str, Any], health_red: bool) -> str:
    if health_red and capability["id"] == "reliability-review":
        return "Release or operational health needs attention before promotion."
    reason = capability.get("whenUseful") or capability["summary"]
    return "%s Current stage: %s." % (str(reason).rstrip(". ") + ".", stage.replace("_", " "))


def _factory_blockers(root: Path) -> List[Dict[str, Any]]:
    try:
        state = load_state(root)
    except FactoryError:
        return []
    blockers: List[Dict[str, Any]] = []
    for action in state.get("humanActions", []):
        if action.get("status") == "open":
            blockers.append(
                {
                    "id": "human.%s" % action.get("id", "action"),
                    "title": action.get("title", "Human approval required"),
                    "reason": "This open human action blocks safe progress.",
                    "executionLane": "local",
                    "requiresApproval": True,
                }
            )
    for status in ("waiting_human", "failed", "blocked", "running"):
        for task in state.get("tasks", []):
            if task.get("status") != status:
                continue
            blockers.append(
                {
                    "id": "task.%s" % task.get("id", "unknown"),
                    "title": task.get("title", "Factory task"),
                    "reason": (
                        "This task needs human input before the approved graph can continue."
                        if status == "waiting_human"
                        else "This failed or blocked task must be resolved before optional improvements."
                        if status in {"failed", "blocked"}
                        else "This is the next incomplete task in the approved factory graph."
                    ),
                    "executionLane": task.get("executionLane", "local"),
                    "requiresApproval": status == "waiting_human",
                }
            )
    running = any(task.get("status") == "running" for task in state.get("tasks", []))
    if not running:
        finished = {
            task.get("id")
            for task in state.get("tasks", [])
            if task.get("status") in {"succeeded", "skipped"}
        }
        runnable = next(
            (
                task
                for task in state.get("tasks", [])
                if task.get("status") == "queued"
                and all(dependency in finished for dependency in task.get("dependsOn", []))
            ),
            None,
        )
        if runnable:
            blockers.append(
                {
                    "id": "task.%s" % runnable.get("id", "unknown"),
                    "title": runnable.get("title", "Factory task"),
                    "reason": "This is the next runnable task in the approved factory graph.",
                    "executionLane": runnable.get("executionLane", "local"),
                    "requiresApproval": False,
                }
            )
    return blockers[:8]


def refresh_recommendations(root: Path) -> Dict[str, Any]:
    catalog = load_capability_catalog(root)
    with state_lock(root, "capability"):
        state = load_capability_state(root)
        stage = state["lifecycleStage"]
        health_red = _run_health_is_red(root)
        previous = {item.get("id"): item for item in state.get("recommendations", [])}
        eligible = []
        unlock_candidates: List[Dict[str, Any]] = []
        for capability in catalog["capabilities"]:
            if not capability.get("recommendable", True) or stage not in capability["stages"]:
                continue
            if _check_availability(root, capability) == "not_applicable":
                continue
            if health_red and capability.get("promotional", False):
                continue
            availability, missing = _availability_details(root, capability)
            completed_snapshot = {
                item.get("capabilityId")
                for item in previous.values()
                if item.get("status") == "completed"
                and (not item.get("dueAt") or not _due_has_passed(item.get("dueAt")))
            }
            unmet = [item for item in capability.get("prerequisites", []) if item not in completed_snapshot]
            if availability != "ready" or unmet:
                unlock_candidates.append(
                    {
                        "capability": capability,
                        "availability": "setup_required" if unmet else availability,
                        "missingChecks": missing,
                        "blockedBy": unmet,
                    }
                )
            eligible.append(capability)
        def recommendation_bucket(item: Dict[str, Any]) -> int:
            if health_red and item["id"] == "reliability-review":
                return 0
            if stage in {"release", "post_launch"} and item["id"] == "reliability-review":
                return 1
            return 2

        eligible.sort(key=lambda item: (recommendation_bucket(item), item["rank"], item["id"]))
        now = utc_now()
        current_ids = {"%s:%s" % (capability["id"], stage) for capability in eligible}
        blockers = _factory_blockers(root)
        for blocker in blockers:
            current_ids.add("factory-blocker.%s:%s" % (blocker["id"], stage))
        recommendations = [
            item
            for item in previous.values()
            if item.get("id") not in current_ids and item.get("status") in {"todo", "dismissed", "completed"}
        ]
        active_index = 0
        for blocker in blockers:
            recommendation_id = "factory-blocker.%s:%s" % (blocker["id"], stage)
            old = previous.get(recommendation_id)
            task_lane = blocker["executionLane"]
            blocker_status = old.get("status") if old else None
            if blocker_status not in {"todo", "dismissed", "completed"}:
                blocker_status = "suggested" if active_index < 3 else "todo"
            recommendations.append(
                {
                    "id": recommendation_id,
                    "capabilityId": "current-factory-task",
                    "title": blocker["title"],
                    "reason": blocker["reason"],
                    "priority": old.get("priority", "now") if old else "now",
                    "status": blocker_status,
                    "availability": "ready",
                    "invocation": "/factory-run --resume",
                    "claudeInvocation": "/factory-run --resume",
                    "skillInvocation": "$source-command-factory-run --resume",
                    "roleIds": ["tech_lead"],
                    "executionLane": task_lane,
                    "maxWorkers": 3 if task_lane == "cloud_safe" else 0,
                    "requiresApproval": blocker["requiresApproval"],
                    "createdAt": old.get("createdAt", now) if old else now,
                    "updatedAt": now,
                }
            )
            if blocker_status == "suggested":
                active_index += 1
        completed_ids = {
            item.get("capabilityId")
            for item in previous.values()
            if item.get("status") == "completed"
            and (not item.get("dueAt") or not _due_has_passed(item.get("dueAt")))
        }
        for capability in eligible:
            recommendation_id = "%s:%s" % (capability["id"], stage)
            old = previous.get(recommendation_id)
            cadence = capability.get("defaultCadence", "once")
            capability_availability = _check_availability(root, capability)
            if old and old.get("status") in {"dismissed", "completed"} and not (
                old.get("status") == "completed" and _due_has_passed(old.get("dueAt"))
            ):
                recommendations.append(old)
                continue
            unmet = [item for item in capability.get("prerequisites", []) if item not in completed_ids]
            preserved_todo = bool(old and old.get("status") == "todo")
            if preserved_todo:
                status = "todo"
                priority = old.get("priority", "next")
            elif unmet or capability_availability != "ready" or active_index >= 3:
                # The complete catalog remains visible in the Capability Center. Only the
                # user's explicit TODOs occupy the queue; unavailable or overflow stage
                # capabilities do not silently become selected work.
                continue
            else:
                status = "suggested"
                priority = "now"
                active_index += 1
            recommendation = {
                "id": recommendation_id,
                "capabilityId": capability["id"],
                "title": capability["title"],
                "reason": _recommendation_reason(stage, capability, health_red),
                "priority": priority,
                "status": status,
                "availability": capability_availability,
                "invocation": capability["claudeInvocation"],
                "claudeInvocation": capability["claudeInvocation"],
                "skillInvocation": capability["skillInvocation"],
                "roleIds": capability["roleIds"],
                "executionLane": capability["delegation"]["mode"],
                "maxWorkers": capability["delegation"]["maxWorkers"],
                "requiresApproval": capability["risk"] == "approval_gated_external",
                "createdAt": old.get("createdAt", now) if old else now,
                "updatedAt": now,
            }
            _copy_queue_metadata(old, recommendation)
            if unmet:
                recommendation["availability"] = "setup_required"
                recommendation["blockedBy"] = unmet
                recommendation["reason"] = "Complete prerequisite%s first: %s." % (
                    "s" if len(unmet) != 1 else "",
                    ", ".join(unmet),
                )
            elif capability_availability != "ready":
                recommendation["reason"] = (
                    "%s is visible for later, but its availability checks are not ready yet."
                    % capability["title"]
                )
            if old and old.get("dueAt") and not _due_has_passed(old["dueAt"]):
                recommendation["dueAt"] = old["dueAt"]
            elif status == "completed":
                due_at = _iso_due(cadence)
                if due_at:
                    recommendation["dueAt"] = due_at
            recommendations.append(recommendation)
        queued = sorted(
            (item for item in recommendations if item.get("status") == "todo"),
            key=_queue_sort_key,
        )
        other = [item for item in recommendations if item.get("status") != "todo"]
        recommendations = other + queued
        active_todos = queued
        if len(active_todos) > 10:
            keep_ids = {item["id"] for item in active_todos[:10]}
            recommendations = [item for item in recommendations if item.get("status") != "todo" or item["id"] in keep_ids]
        state["recommendations"] = recommendations
        unlock_candidates.sort(key=lambda item: (item["capability"]["rank"], item["capability"]["id"]))
        state["unlockNext"] = []
        if unlock_candidates:
            candidate = unlock_candidates[0]
            capability = candidate["capability"]
            missing_labels = candidate["blockedBy"] + candidate["missingChecks"]
            state["unlockNext"] = [
                {
                    "capabilityId": capability["id"],
                    "title": capability["title"],
                    "reason": (
                        "%s Unlock by resolving: %s."
                        % (
                            (capability.get("whenUseful") or capability["summary"]).rstrip(". ") + ".",
                            ", ".join(missing_labels),
                        )
                        if missing_labels
                        else (capability.get("whenUseful") or capability["summary"])
                    ),
                    "availability": candidate["availability"],
                    "missingChecks": candidate["missingChecks"],
                    "blockedBy": candidate["blockedBy"],
                    "claudeInvocation": capability["claudeInvocation"],
                    "skillInvocation": capability["skillInvocation"],
                }
            ]
        state["extras"] = discover_extras(root, catalog)
        state["capabilityAvailability"] = {
            item["id"]: (
                "setup_required"
                if any(required not in completed_ids for required in item.get("prerequisites", []))
                else _check_availability(root, item)
            )
            for item in catalog["capabilities"]
        }
        state["healthRed"] = health_red
        state["lastRefreshAt"] = now
        return _save_capability_state(root, state)


def transition_recommendation(
    root: Path,
    recommendation_id: str,
    target: str,
    placement: Optional[str] = None,
    task_id: Optional[str] = None,
) -> Dict[str, Any]:
    target_map = {"todo": "todo", "dismiss": "dismissed", "done": "completed"}
    if target not in target_map:
        raise FactoryError("Unknown recommendation transition: %s" % target)
    catalog = load_capability_catalog(root)
    capabilities = {item["id"]: item for item in catalog["capabilities"]}
    with state_lock(root, "capability"):
        state = load_capability_state(root, allow_missing=False)
        item = next((entry for entry in state["recommendations"] if entry.get("id") == recommendation_id), None)
        if item is None:
            current_stage = state.get("lifecycleStage")
            item = next(
                (
                    entry
                    for entry in state["recommendations"]
                    if entry.get("capabilityId") == recommendation_id
                    and str(entry.get("id", "")).endswith(":" + str(current_stage))
                ),
                None,
            )
        if item is None and target == "todo" and recommendation_id in capabilities:
            normalized = _normalize_queue_placement(placement)
            item = _new_capability_recommendation(root, state, capabilities[recommendation_id], normalized)
            state["recommendations"].append(item)
        if item is None:
            raise FactoryError("Unknown recommendation ID: %s" % recommendation_id)
        if target == "done" and state_path(root).is_file():
            # A receipt-backed --task-id is required only when the active run
            # actually tracks work for this capability. Flows that never create
            # a task (continue-app, factory-setup, remote-access, operate-app)
            # may complete their recommendation directly.
            run = load_state(root)
            recommendation_capability = item.get("capabilityId")
            matching_tasks = [
                task
                for task in run.get("tasks", [])
                if recommendation_capability
                and task.get("capabilityId") == recommendation_capability
            ]
            if task_id or matching_tasks:
                if not task_id:
                    raise FactoryError(
                        "Completing %s requires --task-id: the active run tracks %s for this capability."
                        % (
                            recommendation_capability,
                            ", ".join(str(task.get("id")) for task in matching_tasks),
                        )
                    )
                task = _task_by_id(run, task_id)
                if not task.get("acceptedReceiptId") or task.get("status") != "succeeded":
                    raise FactoryError("Task %s does not have an accepted completion receipt." % task_id)
                task_capability = task.get("capabilityId")
                if task_capability and recommendation_capability and task_capability != recommendation_capability:
                    raise FactoryError(
                        "Task %s belongs to capability %s, not %s."
                        % (task_id, task_capability, recommendation_capability)
                    )
                item["acceptedTaskId"] = task_id
                item["acceptedReceiptId"] = task["acceptedReceiptId"]
            else:
                item["completedWithoutTask"] = True
        item["status"] = target_map[target]
        item["priority"] = "next" if target == "todo" else item.get("priority", "later")
        item["updatedAt"] = utc_now()
        item.pop("dueAt", None)
        if target == "todo":
            normalized = _normalize_queue_placement(placement or item.get("queuePlacement"))
            item["queuePlacement"] = normalized
            item["queueOrder"] = _next_queue_order(state, normalized)
            item["queuedAt"] = item.get("queuedAt") or item["updatedAt"]
            item["priority"] = (
                "now" if normalized == "after_current_checkpoint"
                else "next" if normalized == "after_milestone"
                else "later"
            )
        else:
            for key in ("queuePlacement", "queueOrder", "queuedAt"):
                item.pop(key, None)
        capability = capabilities.get(item.get("capabilityId"))
        if target == "done" and capability:
            due_at = _iso_due(capability.get("defaultCadence", "once"))
            if due_at:
                item["dueAt"] = due_at
        return _save_capability_state(root, state)


def move_recommendation(
    root: Path,
    recommendation_id: str,
    anchor_id: str,
    relation: str,
) -> Dict[str, Any]:
    if relation not in {"before", "after"}:
        raise FactoryError("Recommendation move relation must be before or after.")
    with state_lock(root, "capability"):
        state = load_capability_state(root, allow_missing=False)

        def resolve(identifier: str) -> Optional[Dict[str, Any]]:
            return next(
                (
                    item for item in state["recommendations"]
                    if item.get("status") == "todo"
                    and (item.get("id") == identifier or item.get("capabilityId") == identifier)
                ),
                None,
            )

        item = resolve(recommendation_id)
        anchor = resolve(anchor_id)
        if item is None:
            raise FactoryError("Unknown queued recommendation ID: %s" % recommendation_id)
        if anchor is None:
            raise FactoryError("Unknown queued anchor ID: %s" % anchor_id)
        if item is anchor:
            raise FactoryError("A queued recommendation cannot be moved relative to itself.")
        placement = anchor.get("queuePlacement", "after_milestone")
        queued = sorted(
            (
                entry for entry in state["recommendations"]
                if entry.get("status") == "todo"
                and entry.get("queuePlacement", "after_milestone") == placement
                and entry is not item
            ),
            key=_queue_sort_key,
        )
        anchor_index = queued.index(anchor)
        queued.insert(anchor_index if relation == "before" else anchor_index + 1, item)
        now = utc_now()
        for index, entry in enumerate(queued):
            entry["queuePlacement"] = placement
            entry["queueOrder"] = index
            entry["updatedAt"] = now
        return _save_capability_state(root, state)


def _task_by_id(state: Dict[str, Any], task_id: str) -> Dict[str, Any]:
    for task in state.get("tasks", []):
        if task.get("id") == task_id:
            return task
    raise FactoryError("Unknown task ID: %s" % task_id)


def _human_by_id(state: Dict[str, Any], action_id: str) -> Dict[str, Any]:
    for action in state.get("humanActions", []):
        if action.get("id") == action_id:
            return action
    raise FactoryError("Unknown human action ID: %s" % action_id)


def _event(state: Dict[str, Any], event_type: str, message: str, task_id: Optional[str] = None) -> None:
    event: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "type": event_type,
        "message": _redact_string(message),
        "at": utc_now(),
    }
    if task_id:
        event["taskId"] = task_id
    events = list(state.get("events", []))
    events.append(event)
    state["events"] = events[-EVENT_LIMIT:]


def calculate_progress(tasks: Sequence[Dict[str, Any]]) -> Dict[str, int]:
    total = len(tasks)
    completed = sum(1 for task in tasks if task.get("status") in DONE_STATUSES)
    return {
        "completed": completed,
        "total": total,
        "percent": round(completed * 100 / total) if total else 0,
        "running": sum(1 for task in tasks if task.get("status") == "running"),
        "waitingHuman": sum(1 for task in tasks if task.get("status") == "waiting_human"),
        "blocked": sum(1 for task in tasks if task.get("status") == "blocked"),
        "failed": sum(1 for task in tasks if task.get("status") == "failed"),
        "queued": sum(1 for task in tasks if task.get("status") == "queued"),
        "reviewPending": sum(1 for task in tasks if task.get("status") == "review_pending"),
        "needsRevision": sum(1 for task in tasks if task.get("status") == "needs_revision"),
    }


def _save_state(root: Path, state: Dict[str, Any], namespace: str = "run") -> None:
    state["updatedAt"] = utc_now()
    state["progress"] = calculate_progress(state.get("tasks", []))
    destination = state_path(root) if namespace == "run" else android_state_path(root)
    _atomic_json_write(destination, state)


def mutate_state(
    root: Path,
    mutation: Callable[[Dict[str, Any]], None],
    namespace: str = "run",
) -> Dict[str, Any]:
    with state_lock(root, namespace):
        state = load_state(root) if namespace == "run" else load_android_state(root)
        mutation(state)
        _save_state(root, state, namespace)
        return state


def init_run(root: Path, source: str, locales: str) -> Dict[str, Any]:
    if locales not in LOCALE_PROFILES:
        raise FactoryError("Locale profile must be launch or extended.")
    with state_lock(root):
        path = state_path(root)
        if path.exists():
            existing = _read_json(path)
            raise FactoryError(
                "Run %s already exists. Use `run resume`; never replace resumable state."
                % existing.get("runId", "unknown")
            )
        now = utc_now()
        state: Dict[str, Any] = {
            "schemaVersion": RUN_SCHEMA_VERSION,
            "runId": str(uuid.uuid4()),
            "phase": "research",
            "source": _redact_string(source),
            "localeProfile": locales,
            "tasks": [],
            "humanActions": [],
            "humanActiveMinutes": 0,
            "progress": calculate_progress([]),
            "evidence": [],
            "receipts": [],
            "context": {"health": "needs_evidence", "handoffSequence": 0},
            "events": [],
            "startedAt": now,
            "updatedAt": now,
        }
        _event(state, "run_initialized", "Factory run initialized")
        _save_state(root, state)
        return state


def _git_directory(root: Path) -> Optional[Path]:
    marker = root.resolve() / ".git"
    if marker.is_dir():
        return marker
    if marker.is_file():
        try:
            line = marker.read_text(encoding="utf-8").strip()
        except OSError:
            return None
        prefix = "gitdir: "
        if line.startswith(prefix):
            candidate = Path(line[len(prefix):])
            return candidate.resolve() if candidate.is_absolute() else (root.resolve() / candidate).resolve()
    return None


def _source_revision(root: Path) -> str:
    git_dir = _git_directory(root)
    if git_dir is None:
        return "unversioned"
    try:
        head = (git_dir / "HEAD").read_text(encoding="utf-8").strip()
    except OSError:
        return "unversioned"
    if re.fullmatch(r"[0-9a-fA-F]{40,64}", head):
        return head.lower()
    if not head.startswith("ref: "):
        return "unversioned"
    ref = head[5:].strip()
    try:
        value = (git_dir / ref).read_text(encoding="utf-8").strip()
        if re.fullmatch(r"[0-9a-fA-F]{40,64}", value):
            return value.lower()
    except OSError:
        pass
    try:
        for line in (git_dir / "packed-refs").read_text(encoding="utf-8").splitlines():
            if line.startswith("#") or line.startswith("^"):
                continue
            revision, separator, candidate_ref = line.partition(" ")
            if separator and candidate_ref == ref and re.fullmatch(r"[0-9a-fA-F]{40,64}", revision):
                return revision.lower()
    except OSError:
        pass
    return "unversioned"


def _source_branch(root: Path) -> str:
    git_dir = _git_directory(root)
    if git_dir is None:
        return "unversioned"
    try:
        head = (git_dir / "HEAD").read_text(encoding="utf-8").strip()
    except OSError:
        return "unversioned"
    return head[5:].removeprefix("refs/heads/") if head.startswith("ref: ") else "detached"


def _source_digest(root: Path) -> str:
    """Hash portable app source and canonical project context without invoking tools."""
    project_root = root.resolve()
    ignored = {
        ".git", ".factory", ".build", "build", "dist", "coverage", "DerivedData",
        "Pods", "node_modules", ".expo", ".next", ".turbo",
    }
    exact_docs = {
        "PRODUCT.md",
        "docs/architecture.md",
        "docs/data-model.md",
        "docs/features.md",
        "docs/product-map.md",
        "docs/security-model.md",
        "docs/stack.md",
    }
    exact_configs = {
        "Package.swift", "Package.resolved", "package.json", "app.json", "eas.json",
        "tsconfig.json", "babel.config.js", "metro.config.js", "Podfile", "Podfile.lock",
        "pubspec.yaml", "pubspec.lock", "settings.gradle", "settings.gradle.kts",
        "build.gradle", "build.gradle.kts", "gradle.properties",
    }
    source_suffixes = {
        ".swift", ".m", ".mm", ".h", ".kt", ".kts", ".java", ".dart",
        ".js", ".jsx", ".ts", ".tsx", ".css", ".scss", ".html", ".py",
        ".sh", ".sql", ".gradle", ".properties", ".plist", ".entitlements", ".xml",
    }
    candidates: List[Path] = []
    for path in project_root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(project_root)
        if ignored.intersection(relative.parts):
            continue
        relative_text = relative.as_posix()
        if (
            path.suffix in source_suffixes
            or path.suffix in {".pbxproj", ".xcconfig"}
            or relative_text in exact_docs
            or path.name in exact_configs
        ):
            candidates.append(path)
    digest = hashlib.sha256()
    for path in sorted(candidates, key=lambda item: item.relative_to(project_root).as_posix()):
        relative = path.relative_to(project_root).as_posix().encode("utf-8")
        digest.update(len(relative).to_bytes(8, "big"))
        digest.update(relative)
        try:
            with path.open("rb") as handle:
                while True:
                    chunk = handle.read(64 * 1024)
                    if not chunk:
                        break
                    digest.update(chunk)
        except OSError as exc:
            raise FactoryError("Cannot digest project source: %s" % exc) from exc
    return "sha256:%s" % digest.hexdigest()


def context_dir(root: Path) -> Path:
    return factory_dir(root) / "context"


def receipts_dir(root: Path) -> Path:
    return factory_dir(root) / "receipts"


def _safe_identifier(value: str, label: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", value):
        raise FactoryError("%s must use letters, digits, dot, underscore, or dash." % label)
    return value


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(64 * 1024), b""):
                digest.update(chunk)
    except OSError as exc:
        raise FactoryError("Cannot hash %s: %s" % (path, exc)) from exc
    return "sha256:%s" % digest.hexdigest()


def _extract_markdown_section(text: str, heading: str) -> str:
    escaped = re.escape(heading.strip())
    match = re.search(
        r"(?ms)^#{1,6}\s+%s\s*$.*?(?=^#{1,6}\s+|\Z)" % escaped,
        text,
    )
    if not match:
        raise FactoryError("Context heading is missing: %s" % heading)
    return match.group(0).strip()


def _context_ref(root: Path, spec: Dict[str, Any]) -> Dict[str, Any]:
    project_root = root.resolve()
    candidate = (project_root / spec["path"]).resolve()
    if candidate != project_root and project_root not in candidate.parents:
        raise FactoryError("Context references must stay inside the project root.")
    if not candidate.is_file():
        raise FactoryError("Context reference is missing: %s" % spec["path"])
    try:
        text = candidate.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise FactoryError("Context reference is unreadable: %s" % exc) from exc
    section = spec.get("section")
    selected = _extract_markdown_section(text, section) if section else text
    return {
        "path": candidate.relative_to(project_root).as_posix(),
        "section": section,
        "reason": spec.get("reason", "task context"),
        "sourceSha256": _sha256_file(candidate),
        "contentSha256": "sha256:%s" % hashlib.sha256(selected.encode("utf-8")).hexdigest(),
        "bytes": len(selected.encode("utf-8")),
        "estimatedTokens": max(1, len(selected.encode("utf-8")) // 4),
    }


def _tokenize(value: str) -> List[str]:
    aliases = {
        "screenshots": "screenshot",
        "screenshotlar": "screenshot",
        "release": "ship",
        "yayinla": "publish",
        "yayin": "publish",
        "devam": "continue",
        "kurulum": "setup",
        "buyume": "growth",
        "gecisinde": "handoff",
        "gecis": "handoff",
        "unutuyor": "forgot",
        "unuttu": "forgot",
        "bozuluyor": "malformed",
    }
    normalized = value.lower().translate(str.maketrans("çğıöşü", "cgiosu"))
    tokens = re.findall(r"[a-z0-9][a-z0-9._-]+", normalized)
    stopwords = {
        "and", "the", "for", "with", "from", "this", "that", "app", "application",
        "is", "are", "there", "any", "good", "can", "do", "how", "what", "goal",
        "want", "need", "please", "bir", "bu", "icin", "ile", "ve", "ya", "da",
        "de", "mi", "var", "iyi", "prepare", "review", "in", "on", "of", "to",
        "current", "existing", "project", "plan", "make", "improve", "kit", "mevcut",
        "proje", "gorev", "gorevi", "yap", "yeni",
    }
    normalized_tokens: List[str] = []
    for token in tokens:
        token = token.strip("._-")
        if len(token) <= 1 or token in stopwords:
            continue
        canonical = aliases.get(token, token[:-1] if len(token) > 3 and token.endswith("s") else token)
        if len(canonical) > 1 and canonical not in stopwords:
            normalized_tokens.append(canonical)
    return normalized_tokens


def _detected_stack(root: Path) -> str:
    candidates = (root / "docs" / "stack.md", root / "package.json", root / "Package.swift")
    text = ""
    for path in candidates:
        with contextlib.suppress(OSError):
            text += "\n" + path.read_text(encoding="utf-8")[:12000]
    lowered = text.lower()
    if (
        '"next"' in lowered
        or "next.js app router" in lowered
        or any((root / name).exists() for name in ("next.config.js", "next.config.mjs", "next.config.ts"))
    ):
        return "web"
    # Narrow signals on purpose: a bare "expo" substring also matches the "exports"
    # field that any package.json may carry.
    if '"expo"' in lowered or "expo-router" in lowered or "expo sdk" in lowered:
        return "expo"
    if "swiftui" in lowered or "package.swift" in lowered:
        return "swiftui"
    return "unknown"


def route_context(root: Path, intent: str) -> Dict[str, Any]:
    if not intent.strip():
        raise FactoryError("Context intent cannot be empty.")
    catalog = load_capability_catalog(root)
    capability_state = load_capability_state(root)
    stage = capability_state.get("lifecycleStage", "setup")
    availability = capability_state.get("capabilityAvailability", {})
    stack = _detected_stack(root)
    intent_tokens = set(_tokenize(intent))
    explicit_skill_search = (
        "skill" in intent_tokens
        and any(term in intent.lower() for term in ("find", "search", "recommend", "good skill", "skill for"))
    )
    local_meta_intent = bool(intent_tokens & {"harness", "schema", "receipt", "handoff", "context", "factoryctl", "adapter"}) or any(
        phrase in intent.lower() for phrase in ("app factory", "app-factory", "factory kit", "kit plan")
    )
    harness_problem = bool(intent_tokens & {"malformed", "failed", "failing", "blocked", "forgot", "stale", "schema", "receipt"}) or any(
        phrase in intent.lower() for phrase in ("lost context", "context kaybol", "tool call")
    )
    ranked: List[Dict[str, Any]] = []
    for capability in catalog["capabilities"]:
        if capability["id"] == "harness-health" and not harness_problem:
            continue
        searchable = " ".join(
            [capability["id"], capability["title"], capability["summary"], capability.get("whenUseful", "")]
            + capability["triggerExamples"]
        )
        candidate_tokens = set(_tokenize(searchable))
        overlap = intent_tokens & candidate_tokens
        phrase_hits = sum(
            1 for example in capability["triggerExamples"] if example.lower() in intent.lower()
        )
        score = len(overlap) * 2 + phrase_hits * 5
        if capability["id"] in intent.lower():
            score += 8
        if score <= 0:
            continue
        if stage in capability["stages"]:
            score += 2
        if stack == "expo" and any("expo" in value.lower() for value in capability["triggerExamples"]):
            score += 2
        if stack == "web" and "web" in capability["platforms"] and len(capability["platforms"]) == 1:
            score += 2
        if availability.get(capability["id"]) == "unavailable":
            score -= 3
        ranked.append(
            {
                "capabilityId": capability["id"],
                "title": capability["title"],
                "summary": capability["summary"],
                "score": score,
                "matchedTerms": sorted(overlap)[:8],
                "availability": availability.get(capability["id"], _check_availability(root, capability)),
                "skillInvocation": capability["skillInvocation"],
                "claudeInvocation": capability["claudeInvocation"],
                "toolRequirements": capability["toolRequirements"],
                "contextRefs": capability["contextProfile"]["refs"],
                "workflowPolicy": capability.get("workflowPolicy"),
            }
        )
    # A request such as "is there a good skill for <goal>?" is itself a
    # discovery intent when no local capability matches the goal-specific
    # terms. Keep local, meaningful matches ahead of this external fallback.
    generic_discovery_terms = {"agent", "skill"}
    meaningful_local_match = any(
        item["capabilityId"] != "external-skill-discovery"
        and (set(item["matchedTerms"]) - generic_discovery_terms)
        for item in ranked
    )
    if explicit_skill_search and not meaningful_local_match:
        for item in ranked:
            if item["capabilityId"] == "external-skill-discovery":
                item["score"] += 8
                break
    ranked.sort(key=lambda item: (-item["score"], item["capabilityId"]))
    candidates = ranked[:3]
    selected = None
    confidence = "low"
    if candidates:
        margin = candidates[0]["score"] - (candidates[1]["score"] if len(candidates) > 1 else 0)
        if candidates[0]["score"] >= 8 or (candidates[0]["score"] >= 4 and margin >= 2):
            selected = candidates[0]["capabilityId"]
            confidence = "high"
    discovery_fallback = None
    if confidence == "low" and (explicit_skill_search or not local_meta_intent):
        fallback = next(
            (item for item in catalog["capabilities"] if item["id"] == "external-skill-discovery"),
            None,
        )
        if fallback:
            discovery_fallback = {
                "capabilityId": fallback["id"],
                "title": fallback["title"],
                "reason": "The local catalog has no high-confidence match. Prepare a credential-free external skill search.",
                "availability": availability.get(fallback["id"], _check_availability(root, fallback)),
                "skillInvocation": fallback["skillInvocation"],
                "claudeInvocation": fallback["claudeInvocation"],
                "contextRefs": fallback["contextProfile"]["refs"],
                "networkSearch": True,
                "installRequiresApproval": True,
            }
    result = {
        "schemaVersion": 1,
        "intentDigest": "sha256:%s" % hashlib.sha256(intent.encode("utf-8")).hexdigest(),
        "stage": stage,
        "stack": stack,
        "confidence": confidence,
        "selectedCapabilityId": selected,
        "candidates": candidates,
        "discoveryFallback": discovery_fallback,
        "opaqueHarnessOverhead": "unknown",
    }
    serialized = json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    result["telemetry"] = {
        "routerBytes": len(serialized),
        "routerEstimatedTokens": max(1, len(serialized) // 4),
        "candidateCount": len(candidates),
        "catalogEntriesProjected": len(candidates),
        "installedExtrasProjected": 0,
    }
    return result


def _normalize_harness_target(target: str) -> str:
    aliases = {"grok": "cli", "other": "cli", "copyOnly": "cli"}
    normalized = aliases.get(target, target)
    if normalized not in HARNESS_TARGETS:
        raise FactoryError("Harness target must be one of: codex, claude, cli.")
    return normalized


def _digest_json(value: Any) -> str:
    encoded = json.dumps(redact(value), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:%s" % hashlib.sha256(encoded).hexdigest()


def _canonical_task_packet(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "task": payload["task"],
        "current": {
            "milestone": payload["current"]["milestone"],
            "decisions": payload["current"]["decisions"],
            "openRisks": payload["current"]["openRisks"],
            "exactNextAction": payload["current"]["exactNextAction"],
        },
        "contextRefs": [
            {
                "path": item["path"],
                "section": item.get("section"),
                "reason": item["reason"],
                "contentSha256": item["contentSha256"],
            }
            for item in payload["contextRefs"]
        ],
        "routing": payload["routing"],
        "sourceRevision": payload["project"]["head"],
        "sourceDigest": payload["project"]["workingTreeDigest"],
    }


def _render_harness_bootstrap(root: Path, payload: Dict[str, Any], target: str) -> str:
    route_hint = payload["routing"].get("claudeInvocation") if target == "claude" else payload["routing"].get("skillInvocation")
    hint = " Optional capability hint: %s." % route_hint if route_hint else ""
    return (
        "Continue app-factory task %s with the %s adapter. Project root: %s. "
        "Capsule: .factory/context/%s.json. First run `python3 scripts/factoryctl.py context audit %s`, "
        "then read only the capsule and its contextRefs. Goal: %s Next action: %s "
        "Evidence and success criteria are in the capsule. Do not expand scope or perform external writes "
        "without recorded approval.%s Packet digest: %s."
        % (
            payload["taskId"],
            target,
            root.resolve(),
            payload["capsuleId"],
            payload["capsuleId"],
            payload["task"]["objective"],
            payload["current"]["exactNextAction"],
            hint,
            payload["contract"]["packetDigest"],
        )
    )


def prepare_context_capsule(
    root: Path,
    task_id: str,
    target: str = "cli",
) -> Dict[str, Any]:
    target = _normalize_harness_target(target)
    _safe_identifier(task_id, "Task ID")
    state = load_state(root)
    task = _task_by_id(state, task_id)
    capability: Optional[Dict[str, Any]] = None
    if task.get("capabilityId"):
        capability = next(
            (item for item in load_capability_catalog(root)["capabilities"] if item["id"] == task["capabilityId"]),
            None,
        )
    refs = task.get("contextRefs") or (capability or {}).get("contextProfile", {}).get("refs", [])
    resolved_refs = [_context_ref(root, ref) for ref in refs]
    sequence = int(state.get("context", {}).get("handoffSequence", 0)) + 1
    revision = _source_revision(root)
    worktree_digest = _source_digest(root)
    capsule_id = "%s-%s" % (task_id, sequence)
    payload = {
        "schemaVersion": CONTEXT_CAPSULE_SCHEMA_VERSION,
        "contractType": "context_capsule",
        "capsuleId": capsule_id,
        "taskId": task_id,
        "project": {
            "root": str(root.resolve()),
            "branch": _source_branch(root),
            "head": revision,
            "workingTreeDigest": worktree_digest,
            "fingerprint": "%s@%s" % (root.resolve().name, revision[:10]),
        },
        "task": {
            "id": task_id,
            "capabilityId": task.get("capabilityId"),
            "objective": task.get("objective") or task.get("title"),
            "allowedPaths": task.get("allowedPaths", []),
            "forbiddenPaths": task.get("forbiddenPaths", []),
            "acceptance": task.get("acceptance", []),
            "validations": task.get("validations", []),
            "risk": task.get("risk", "local_write"),
            "approvalRequirements": task.get("approvalRequirements", []),
        },
        "current": {
            "milestone": state.get("phase"),
            "completedSummary": task.get("completedSummary", ""),
            "decisions": task.get("decisions", []),
            "openRisks": task.get("openRisks", []),
            "humanActions": [
                {"id": item["id"], "title": item["title"]}
                for item in state.get("humanActions", [])
                if item.get("status") == "open" and (not item.get("taskId") or item.get("taskId") == task_id)
            ],
            "evidenceRefs": [item["id"] for item in state.get("evidence", []) if item.get("taskId") == task_id],
            "exactNextAction": task.get("exactNextAction") or "Complete the task acceptance criteria and submit a receipt.",
        },
        "contextRefs": resolved_refs,
        "review": {
            "target": target,
        },
        "routing": {
            "selectedCapabilityId": task.get("capabilityId"),
            "skillInvocation": (capability or {}).get("skillInvocation"),
            "claudeInvocation": (capability or {}).get("claudeInvocation"),
            "toolRequirements": (capability or {}).get("toolRequirements", []),
        },
        "handoffSequence": sequence,
        "createdAt": utc_now(),
    }
    packet_digest = _digest_json(_canonical_task_packet(payload))
    payload["contract"] = {
        "target": target,
        "adapterVersion": HARNESS_ADAPTER_VERSION,
        "packetDigest": packet_digest,
    }
    bootstrap = _render_harness_bootstrap(root, payload, target)
    encoded = json.dumps(redact(payload), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    capsule_bytes = len(encoded)
    estimated_tokens = max(1, capsule_bytes // 4)
    contract_validation = validate_contract_payload(root, payload, "capsule")
    if not contract_validation["valid"]:
        raise FactoryError("Generated context capsule violates its contract: %s" % json.dumps(contract_validation["errors"]))
    path = context_dir(root) / (capsule_id + ".json")
    _atomic_json_write(path, payload)

    def mutation(run: Dict[str, Any]) -> None:
        selected = _task_by_id(run, task_id)
        selected["capsuleId"] = capsule_id
        selected["sourceDigest"] = worktree_digest
        selected["handoffSequence"] = sequence
        selected["exactNextAction"] = payload["current"]["exactNextAction"]
        run["context"] = {
            "health": "ready",
            "taskId": task_id,
            "capsuleId": capsule_id,
            "sourceDigest": worktree_digest,
            "handoffSequence": sequence,
            "exactNextAction": payload["current"]["exactNextAction"],
            "capsuleBytes": capsule_bytes,
            "estimatedTokens": estimated_tokens,
            "harnessStatus": "compatible",
            "harnessTarget": target,
            "adapterVersion": HARNESS_ADAPTER_VERSION,
            "packetDigest": packet_digest,
        }
        _event(run, "context_prepared", "Context capsule prepared", task_id)

    mutate_state(root, mutation)
    return {"capsule": payload, "path": str(path), "bootstrap": _redact_string(bootstrap)}


def audit_context_capsule(root: Path, capsule_id: str) -> Dict[str, Any]:
    _safe_identifier(capsule_id, "Capsule ID")
    path = context_dir(root) / (capsule_id + ".json")
    capsule = _read_json(path)
    errors: List[str] = []
    validation_errors: List[Dict[str, Any]] = []
    schema_version = capsule.get("schemaVersion")
    contract_status = "current" if schema_version == CONTEXT_CAPSULE_SCHEMA_VERSION else "invalid"
    if schema_version != CONTEXT_CAPSULE_SCHEMA_VERSION:
        errors.append("unsupported_schema")
    else:
        validation = validate_contract_payload(root, capsule, "capsule")
        validation_errors.extend(validation["errors"])
        errors.extend(item["code"] for item in validation["errors"])
        expected_packet = _digest_json(_canonical_task_packet(capsule))
        if capsule.get("contract", {}).get("packetDigest") != expected_packet:
            errors.append("packet_digest_mismatch")
            validation_errors.append(
                _contract_error(
                    "packet_digest_mismatch",
                    ("contract", "packetDigest"),
                    expected_packet,
                    capsule.get("contract", {}).get("packetDigest"),
                    retryable=False,
                    approval_impact="blocked",
                )
            )
    project = capsule.get("project", {})
    if project.get("head") != _source_revision(root):
        errors.append("stale_head")
    if project.get("workingTreeDigest") != _source_digest(root):
        errors.append("stale_worktree")
    with contextlib.suppress(FactoryError):
        state = load_state(root)
        current = state.get("context", {})
        current_sequence = int(current.get("handoffSequence", 0))
        capsule_sequence = int(capsule.get("handoffSequence", 0))
        if (
            current.get("capsuleId")
            and current.get("capsuleId") != capsule_id
            and current_sequence >= capsule_sequence
        ):
            errors.append("superseded_handoff")
    for ref in capsule.get("contextRefs", []):
        try:
            current = _context_ref(root, ref)
            if current["contentSha256"] != ref.get("contentSha256"):
                errors.append("stale_context:%s" % ref.get("path"))
        except FactoryError as exc:
            errors.append(str(exc))
    return {
        "capsuleId": capsule_id,
        "health": "ready" if not errors else "stale",
        "errors": errors,
        "validationErrors": validation_errors,
        "contractStatus": contract_status,
        "harness": capsule.get("contract", {}),
        "opaqueHarnessOverhead": "unknown",
    }


def inspect_context_capsule(root: Path, capsule_id: str) -> Dict[str, Any]:
    _safe_identifier(capsule_id, "Capsule ID")
    path = context_dir(root) / (capsule_id + ".json")
    capsule = _read_json(path)
    refs = capsule.get("contextRefs", [])
    identities = [(item.get("path"), item.get("section")) for item in refs if isinstance(item, dict)]
    unique_identities = set(identities)
    conflicting = 0
    for identity in unique_identities:
        hashes = {
            item.get("contentSha256")
            for item in refs
            if isinstance(item, dict) and (item.get("path"), item.get("section")) == identity
        }
        if len(hashes) > 1:
            conflicting += 1
    return {
        "schemaVersion": capsule.get("schemaVersion"),
        "capsuleId": capsule.get("capsuleId"),
        "taskId": capsule.get("taskId"),
        "project": capsule.get("project"),
        "task": capsule.get("task"),
        "current": capsule.get("current"),
        "contextRefs": capsule.get("contextRefs", []),
        "review": capsule.get("review"),
        "routing": capsule.get("routing", {}),
        "serializedCapsuleBytes": path.stat().st_size,
        "duplicateContextRefs": max(0, len(identities) - len(unique_identities)),
        "conflictingContextRefs": conflicting,
        "handoffCount": int(capsule.get("handoffSequence", 0)),
    }


def create_checkpoint(root: Path, phase: str, task_id: str, target: str = "other") -> Dict[str, Any]:
    if not re.fullmatch(r"[a-z][a-z0-9_-]*", phase):
        raise FactoryError("Checkpoint phase must be a lowercase identifier.")
    prepared = prepare_context_capsule(root, task_id, target)
    capsule = prepared["capsule"]

    def mutation(state: Dict[str, Any]) -> None:
        checkpoints = state.setdefault("checkpoints", [])
        checkpoints.append(
            {
                "id": "%s-%s" % (phase, len(checkpoints) + 1),
                "phase": phase,
                "taskId": task_id,
                "capsuleId": capsule["capsuleId"],
                "sourceDigest": capsule["project"]["workingTreeDigest"],
                "createdAt": utc_now(),
            }
        )
        state["phase"] = phase
        state.setdefault("context", {})["checkpointCount"] = len(checkpoints)
        _event(state, "checkpoint_created", "Checkpoint created for %s" % phase, task_id)

    state = mutate_state(root, mutation)
    return {"checkpoint": state["checkpoints"][-1], "bootstrap": prepared["bootstrap"]}


def init_android_run(root: Path, scope: str = "shipped", through: str = "internal") -> Dict[str, Any]:
    if scope not in ANDROID_SCOPES:
        raise FactoryError("Android scope must be one of: %s" % ", ".join(sorted(ANDROID_SCOPES)))
    if through not in ANDROID_DELIVERY_TARGETS:
        raise FactoryError(
            "Android delivery target must be one of: %s" % ", ".join(sorted(ANDROID_DELIVERY_TARGETS))
        )
    with state_lock(root, "android"):
        path = android_state_path(root)
        if path.exists():
            existing = load_android_state(root)
            raise FactoryError(
                "Android parity run %s already exists. Use `android resume`; never replace resumable state."
                % existing.get("runId", "unknown")
            )
        now = utc_now()
        state: Dict[str, Any] = {
            "schemaVersion": SCHEMA_VERSION,
            "runId": str(uuid.uuid4()),
            "phase": ANDROID_PHASES[0],
            "scope": scope,
            "through": through,
            "sourceRevision": _source_revision(root),
            "sourceDigest": _source_digest(root),
            "parity": {"total": 0, "pending": 0, "verified": 0, "exceptions": 0, "percent": 0},
            "tasks": [],
            "humanActions": [],
            "humanActiveMinutes": 0,
            "progress": calculate_progress([]),
            "evidence": [],
            "events": [],
            "startedAt": now,
            "updatedAt": now,
        }
        _event(state, "android_run_initialized", "Android parity run initialized")
        _save_state(root, state, "android")
        return state


def resume_android_run(
    root: Path,
    scope: Optional[str] = None,
    through: Optional[str] = None,
) -> Dict[str, Any]:
    if scope is not None and scope not in ANDROID_SCOPES:
        raise FactoryError("Android scope must be one of: %s" % ", ".join(sorted(ANDROID_SCOPES)))
    if through is not None and through not in ANDROID_DELIVERY_TARGETS:
        raise FactoryError(
            "Android delivery target must be one of: %s" % ", ".join(sorted(ANDROID_DELIVERY_TARGETS))
        )
    state = load_android_state(root)
    if scope is not None and scope != state["scope"]:
        raise FactoryError("Android scope is immutable; resume with --scope=%s." % state["scope"])
    if through is not None and through != state["through"]:
        raise FactoryError("Android delivery target is immutable; resume with --through=%s." % state["through"])
    return state


def set_android_phase(root: Path, phase: str) -> Dict[str, Any]:
    if phase not in ANDROID_PHASES:
        raise FactoryError("Android phase must be one of: %s" % ", ".join(ANDROID_PHASES))

    def mutation(state: Dict[str, Any]) -> None:
        current_index = ANDROID_PHASES.index(state["phase"])
        target_index = ANDROID_PHASES.index(phase)
        max_index = ANDROID_PHASES.index(ANDROID_MAX_PHASE[state["through"]])
        if target_index < current_index:
            raise FactoryError("Android phase cannot move backward from %s to %s." % (state["phase"], phase))
        if target_index > max_index:
            raise FactoryError("Android phase %s exceeds the %s delivery target." % (phase, state["through"]))
        if target_index == current_index:
            return
        state["phase"] = phase
        _event(state, "android_phase_changed", "Android phase changed to %s" % phase)

    return mutate_state(root, mutation, "android")


def set_android_parity(root: Path, total: int, verified: int, exceptions: int) -> Dict[str, Any]:
    if any(not isinstance(value, int) or isinstance(value, bool) or value < 0 for value in (total, verified, exceptions)):
        raise FactoryError("Android parity counts must be non-negative integers.")
    if verified + exceptions > total:
        raise FactoryError("Verified and exception parity counts cannot exceed total.")

    def mutation(state: Dict[str, Any]) -> None:
        state["parity"] = {
            "total": total,
            "pending": total - verified - exceptions,
            "verified": verified,
            "exceptions": exceptions,
            "percent": round(verified * 100 / total) if total else 0,
        }
        _event(state, "android_parity_updated", "Android parity counts updated")

    return mutate_state(root, mutation, "android")


def add_task(
    root: Path,
    task_id: str,
    title: str,
    dependencies: Sequence[str],
    execution_lane: str = "local",
    namespace: str = "run",
    capability_id: Optional[str] = None,
    objective: Optional[str] = None,
    allowed_paths: Sequence[str] = (),
    forbidden_paths: Sequence[str] = (),
    acceptance: Sequence[str] = (),
    validations: Sequence[str] = (),
) -> Dict[str, Any]:
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", task_id):
        raise FactoryError("Task IDs must use lowercase letters, digits, dot, underscore, or dash.")
    if task_id in dependencies:
        raise FactoryError("A task cannot depend on itself.")
    if execution_lane not in EXECUTION_LANES:
        raise FactoryError("Execution lane must be local or cloud_safe.")

    def mutation(state: Dict[str, Any]) -> None:
        existing_ids = {task["id"] for task in state.get("tasks", [])}
        if task_id in existing_ids:
            raise FactoryError("Task IDs and dependencies are immutable; %s already exists." % task_id)
        missing = [dependency for dependency in dependencies if dependency not in existing_ids]
        if missing:
            raise FactoryError("Dependencies must be added first: %s" % ", ".join(missing))
        now = utc_now()
        state.setdefault("tasks", []).append(
            {
                "id": task_id,
                "title": _redact_string(title),
                "status": "queued",
                "dependsOn": list(dict.fromkeys(dependencies)),
                "executionLane": execution_lane,
                "capabilityId": capability_id,
                "objective": _redact_string(objective or title),
                "allowedPaths": list(dict.fromkeys(allowed_paths)),
                "forbiddenPaths": list(dict.fromkeys(forbidden_paths)),
                "acceptance": [
                    {"id": "acceptance-%d" % (index + 1), "criterion": _redact_string(value)}
                    for index, value in enumerate(acceptance)
                ],
                "validations": [
                    {"id": "validation-%d" % (index + 1), "command": _redact_string(value)}
                    for index, value in enumerate(validations)
                ],
                "createdAt": now,
                "updatedAt": now,
            }
        )
        _event(state, "task_added", "Task queued: %s" % title, task_id)

    return mutate_state(root, mutation, namespace)


def _transition_task(
    root: Path,
    task_id: str,
    target: str,
    message: Optional[str] = None,
    human_action_id: Optional[str] = None,
    namespace: str = "run",
) -> Dict[str, Any]:
    if target not in TASK_STATUSES:
        raise FactoryError("Invalid task status: %s" % target)
    allowed = {
        "queued": {"running", "waiting_human", "blocked", "skipped", "failed"},
        "running": {"waiting_human", "blocked", "succeeded", "failed", "review_pending"},
        "waiting_human": {"running", "blocked", "skipped", "failed"},
        "blocked": {"running", "skipped", "failed"},
        "failed": {"running", "skipped"},
        "review_pending": {"needs_revision", "succeeded", "failed"},
        "needs_revision": {"running", "skipped", "failed", "review_pending"},
        "succeeded": set(),
        "skipped": set(),
    }

    def mutation(state: Dict[str, Any]) -> None:
        task = _task_by_id(state, task_id)
        current = task["status"]
        if target not in allowed[current]:
            raise FactoryError("Task %s cannot transition from %s to %s." % (task_id, current, target))
        if target == "running":
            incomplete = [
                dependency
                for dependency in task.get("dependsOn", [])
                if _task_by_id(state, dependency).get("status") not in DONE_STATUSES
            ]
            if incomplete:
                raise FactoryError("Task dependencies are not complete: %s" % ", ".join(incomplete))
            task["startedAt"] = task.get("startedAt") or utc_now()
        now = utc_now()
        task["status"] = target
        task["updatedAt"] = now
        task.pop("error", None)
        task.pop("waitingReason", None)
        task.pop("blockedReason", None)
        task.pop("humanActionId", None)
        if target == "succeeded" and namespace == "run" and state.get("schemaVersion") == RUN_SCHEMA_VERSION:
            if not task.get("acceptedReceiptId"):
                raise FactoryError("Task completion requires a submitted and accepted receipt; use `task submit` then `task accept`.")
        if target == "succeeded" and namespace == "android":
            # The android lane is an evidence-light convenience lane: it skips
            # capsules, receipts, and lead acceptance, but success still requires
            # at least one recorded evidence entry for the task.
            if not any(item.get("taskId") == task_id for item in state.get("evidence", [])):
                raise FactoryError(
                    "Android task %s cannot succeed without evidence; record it with `android evidence add %s PATH` first."
                    % (task_id, task_id)
                )
        if target in DONE_STATUSES:
            task["completedAt"] = now
        if target == "failed":
            task["error"] = _redact_string(message or "Task failed")
        elif target == "waiting_human":
            task["waitingReason"] = _redact_string(message or "Human action required")
            if human_action_id:
                action = _human_by_id(state, human_action_id)
                if action.get("status") != "open":
                    raise FactoryError("Human action is not open: %s" % human_action_id)
                task["humanActionId"] = human_action_id
        elif target == "blocked":
            task["blockedReason"] = _redact_string(message or "Task blocked")
        _event(state, "task_%s" % target, message or "Task %s" % target, task_id)

    return mutate_state(root, mutation, namespace)


def add_human_action(
    root: Path,
    action_id: str,
    title: str,
    instructions: str,
    task_id: Optional[str],
    url: Optional[str],
    namespace: str = "run",
) -> Dict[str, Any]:
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", action_id):
        raise FactoryError("Human action IDs must use lowercase letters, digits, dot, underscore, or dash.")
    if url and not re.match(r"^https://", url):
        raise FactoryError("Human action URLs must use https://")

    def mutation(state: Dict[str, Any]) -> None:
        if any(item.get("id") == action_id for item in state.get("humanActions", [])):
            raise FactoryError("Human action ID already exists: %s" % action_id)
        if task_id:
            _task_by_id(state, task_id)
        now = utc_now()
        action: Dict[str, Any] = {
            "id": action_id,
            "title": _redact_string(title),
            "instructions": _redact_string(instructions),
            "status": "open",
            "createdAt": now,
            "updatedAt": now,
        }
        if task_id:
            action["taskId"] = task_id
        if url:
            action["url"] = url
        state.setdefault("humanActions", []).append(action)
        _event(state, "human_action_added", "Human action added: %s" % title, task_id)

    return mutate_state(root, mutation, namespace)


def resolve_human_action(
    root: Path,
    action_id: str,
    active_minutes: float = 0,
    namespace: str = "run",
) -> Dict[str, Any]:
    if active_minutes < 0:
        raise FactoryError("Human active minutes cannot be negative.")

    def mutation(state: Dict[str, Any]) -> None:
        action = _human_by_id(state, action_id)
        if action.get("status") != "open":
            raise FactoryError("Human action is already resolved: %s" % action_id)
        action["status"] = "resolved"
        action["updatedAt"] = utc_now()
        action["resolvedAt"] = action["updatedAt"]
        action["activeMinutes"] = round(active_minutes, 2)
        state["humanActiveMinutes"] = round(
            sum(float(item.get("activeMinutes", 0)) for item in state.get("humanActions", [])), 2
        )
        _event(state, "human_action_resolved", "Human action resolved: %s" % action["title"], action.get("taskId"))

    return mutate_state(root, mutation, namespace)


def add_evidence(
    root: Path,
    task_id: str,
    path: str,
    kind: str,
    label: Optional[str],
    namespace: str = "run",
) -> Dict[str, Any]:
    project_root = root.resolve()
    candidate = Path(path)
    resolved = candidate.resolve() if candidate.is_absolute() else (project_root / candidate).resolve()
    if resolved != project_root and project_root not in resolved.parents:
        raise FactoryError("Evidence must stay inside the generated app root.")
    if not resolved.is_file():
        raise FactoryError("Evidence file does not exist: %s" % path)
    relative_path = str(resolved.relative_to(project_root))

    def mutation(state: Dict[str, Any]) -> None:
        _task_by_id(state, task_id)
        item = {
            "id": str(uuid.uuid4()),
            "taskId": task_id,
            "path": _redact_string(relative_path),
            "kind": kind,
            "label": _redact_string(label or resolved.name),
            "createdAt": utc_now(),
            "sha256": _sha256_file(resolved),
            "size": resolved.stat().st_size,
            "sourceRevision": _source_revision(root),
        }
        state.setdefault("evidence", []).append(item)
        _event(state, "evidence_added", "Evidence added: %s" % item["label"], task_id)

    return mutate_state(root, mutation, namespace)


def _resolve_project_file(root: Path, raw_path: str, label: str) -> Path:
    project_root = root.resolve()
    candidate = Path(raw_path)
    resolved = candidate.resolve() if candidate.is_absolute() else (project_root / candidate).resolve()
    if resolved != project_root and project_root not in resolved.parents:
        raise FactoryError("%s must stay inside the project root." % label)
    if not resolved.is_file():
        raise FactoryError("%s does not exist: %s" % (label, raw_path))
    return resolved


def validate_receipt(
    root: Path,
    raw_path: str,
    expected_task_id: Optional[str] = None,
    expected_source_digest: Optional[str] = None,
    expected_revision: Optional[str] = None,
) -> Dict[str, Any]:
    """Validate a receipt. By default the source fingerprint is compared to the
    live working tree; accept passes the digest recorded at submit time so that
    touching an unrelated file between submit and accept cannot strand the task
    (evidence hashes are still re-verified live — that is the tamper check)."""
    path = _resolve_project_file(root, raw_path, "Receipt")
    receipt = _read_json(path)
    errors: List[str] = []
    validation_errors: List[Dict[str, Any]] = []
    contract_status = "current" if receipt.get("schemaVersion") == RECEIPT_SCHEMA_VERSION else "invalid"
    if receipt.get("schemaVersion") != RECEIPT_SCHEMA_VERSION:
        errors.append("unsupported_schema")
        validation_errors.append(
            _contract_error("unsupported_schema", ("schemaVersion",), RECEIPT_SCHEMA_VERSION, receipt.get("schemaVersion"), False, "blocked")
        )
    else:
        contract_validation = validate_contract_payload(root, receipt, "receipt")
        validation_errors.extend(contract_validation["errors"])
        errors.extend(item["code"] for item in contract_validation["errors"])
    task_id = receipt.get("taskId")
    if not isinstance(task_id, str) or not task_id:
        errors.append("missing_task_id")
    if expected_task_id and task_id != expected_task_id:
        errors.append("task_id_mismatch")
    if not isinstance(receipt.get("resultSummary"), str) or not receipt.get("resultSummary", "").strip():
        errors.append("missing_result_summary")
    acceptance = receipt.get("acceptance")
    if not isinstance(acceptance, list) or not acceptance:
        errors.append("missing_acceptance")
    else:
        for item in acceptance:
            if not isinstance(item, dict) or item.get("status") not in {"pass", "skip"} or not item.get("id"):
                errors.append("invalid_acceptance")
                break
            if item.get("status") == "skip" and not item.get("note"):
                errors.append("skipped_acceptance_requires_note")
    validations = receipt.get("validations")
    if not isinstance(validations, list) or not validations:
        errors.append("missing_validations")
    elif any(not isinstance(item, dict) or item.get("status") != "pass" or not item.get("id") for item in validations):
        errors.append("validation_not_passed")
    changed_paths = receipt.get("changedPaths")
    if not isinstance(changed_paths, list):
        errors.append("missing_changed_paths")
        changed_paths = []
    elif any(not isinstance(value, str) or not value.strip() for value in changed_paths):
        errors.append("invalid_changed_paths")
    if not isinstance(receipt.get("unresolvedRisks"), list):
        errors.append("missing_unresolved_risks")
    if not isinstance(receipt.get("decisions"), list):
        errors.append("missing_decisions")
    if not isinstance(receipt.get("assumptions"), list):
        errors.append("missing_assumptions")
    if not isinstance(receipt.get("exactNextAction"), str) or not receipt.get("exactNextAction", "").strip():
        errors.append("missing_next_action")
    source = receipt.get("source", {})
    reference_revision = expected_revision or _source_revision(root)
    reference_digest = expected_source_digest or _source_digest(root)
    if not isinstance(source, dict) or not source.get("revision") or not source.get("workingTreeDigest"):
        errors.append("missing_source_fingerprint")
    elif source.get("revision") != reference_revision or source.get("workingTreeDigest") != reference_digest:
        errors.append("stale_source_fingerprint")
    if receipt.get("schemaVersion") == RECEIPT_SCHEMA_VERSION and isinstance(source, dict):
        capsule_id = source.get("capsuleId")
        capsule_path = context_dir(root) / (str(capsule_id) + ".json")
        if not capsule_id or not capsule_path.is_file():
            errors.append("missing_source_capsule")
            validation_errors.append(
                _contract_error("missing_source_capsule", ("source", "capsuleId"), "existing v2 capsule", capsule_id, False, "blocked")
            )
        else:
            capsule = _read_json(capsule_path)
            packet_digest = capsule.get("contract", {}).get("packetDigest")
            if source.get("packetDigest") != packet_digest:
                errors.append("packet_digest_mismatch")
                validation_errors.append(
                    _contract_error(
                        "packet_digest_mismatch",
                        ("source", "packetDigest"),
                        packet_digest,
                        source.get("packetDigest"),
                        False,
                        "blocked",
                    )
                )
    verified_evidence: List[Dict[str, Any]] = []
    try:
        state = load_state(root)
        task = _task_by_id(state, task_id) if task_id else None
        if task:
            allowed = [PurePosixPath(value) for value in task.get("allowedPaths", [])]
            forbidden = [PurePosixPath(value) for value in task.get("forbiddenPaths", [])]
            for raw_changed in changed_paths:
                if not isinstance(raw_changed, str):
                    continue
                changed = PurePosixPath(raw_changed)
                if changed.is_absolute() or ".." in changed.parts:
                    errors.append("changed_path_outside_project:%s" % raw_changed)
                    continue
                if allowed and not any(changed == base or base in changed.parents for base in allowed):
                    errors.append("changed_path_outside_scope:%s" % raw_changed)
                if any(changed == base or base in changed.parents for base in forbidden):
                    errors.append("changed_path_forbidden:%s" % raw_changed)
        evidence_by_id = {item.get("id"): item for item in state.get("evidence", [])}
        referenced = {
            evidence_id
            for group in (acceptance or []) + (validations or [])
            if isinstance(group, dict)
            for evidence_id in group.get("evidenceIds", [])
        }
        for evidence_id in referenced:
            evidence = evidence_by_id.get(evidence_id)
            if not evidence or evidence.get("taskId") != task_id:
                errors.append("unknown_evidence:%s" % evidence_id)
                continue
            evidence_path = root.resolve() / evidence["path"]
            if not evidence_path.is_file() or _sha256_file(evidence_path) != evidence.get("sha256"):
                errors.append("stale_evidence:%s" % evidence_id)
                continue
            verified_evidence.append(
                {
                    "id": evidence_id,
                    "path": evidence.get("path"),
                    "sha256": evidence.get("sha256"),
                    "size": evidence.get("size"),
                    "sourceRevision": evidence.get("sourceRevision"),
                }
            )
        if (acceptance or validations) and not referenced:
            errors.append("missing_evidence_references")
    except FactoryError as exc:
        errors.append(str(exc))
    validated_receipt = redact(receipt)
    validated_receipt["evidence"] = sorted(verified_evidence, key=lambda item: str(item["id"]))
    return {
        "valid": not errors,
        "errors": errors,
        "validationErrors": validation_errors,
        "contractStatus": contract_status,
        "receipt": validated_receipt,
        "path": str(path),
        "sha256": _sha256_file(path),
        "sourceRevision": reference_revision,
        "sourceDigest": reference_digest,
    }


def submit_task_receipt(root: Path, task_id: str, raw_path: str) -> Dict[str, Any]:
    validation = validate_receipt(root, raw_path, task_id)
    if validation["receipt"].get("schemaVersion") == 1:
        raise FactoryError("Receipt schema v1 is unsupported by kit 4; prepare a v2 capsule and submit a v2 receipt.")
    if not validation["valid"]:
        raise FactoryError("Receipt validation failed: %s" % ", ".join(validation["errors"]))
    receipt = validation["receipt"]
    receipt_id = receipt.get("receiptId") or "%s-%s" % (task_id, uuid.uuid4().hex[:12])
    _safe_identifier(receipt_id, "Receipt ID")
    stored = dict(receipt)
    stored["receiptId"] = receipt_id
    stored["submittedAt"] = utc_now()
    destination = receipts_dir(root) / (receipt_id + ".json")
    _atomic_json_write(destination, stored)

    def mutation(state: Dict[str, Any]) -> None:
        task = _task_by_id(state, task_id)
        if task.get("status") not in {"running", "needs_revision"}:
            raise FactoryError("Task %s must be running or needs_revision before receipt submission." % task_id)
        task["status"] = "review_pending"
        task["submittedReceiptId"] = receipt_id
        task["receiptStatus"] = "pending_review"
        task["submittedSourceDigest"] = validation["sourceDigest"]
        task["submittedRevision"] = validation["sourceRevision"]
        task["updatedAt"] = utc_now()
        state.setdefault("receipts", []).append(
            {"id": receipt_id, "taskId": task_id, "path": destination.relative_to(root.resolve()).as_posix(), "sha256": _sha256_file(destination), "status": "pending_review"}
        )
        state["context"] = {
            "health": "needs_evidence",
            "taskId": task_id,
            "capsuleId": task.get("capsuleId"),
            "sourceDigest": task.get("sourceDigest"),
            "handoffSequence": task.get("handoffSequence", 0),
            "exactNextAction": "Lead review must accept or reject the submitted receipt.",
        }
        _event(state, "task_submitted", "Task receipt submitted for lead review", task_id)

    return mutate_state(root, mutation)


def accept_task_receipt(root: Path, task_id: str) -> Dict[str, Any]:
    state = load_state(root)
    task = _task_by_id(state, task_id)
    receipt_id = task.get("submittedReceiptId")
    if task.get("status") != "review_pending" or not receipt_id:
        raise FactoryError("Task %s has no receipt waiting for review." % task_id)
    path = receipts_dir(root) / (receipt_id + ".json")
    validation = validate_receipt(
        root,
        str(path),
        task_id,
        expected_source_digest=task.get("submittedSourceDigest"),
        expected_revision=task.get("submittedRevision"),
    )
    if not validation["valid"]:
        raise FactoryError("Receipt is no longer valid: %s" % ", ".join(validation["errors"]))

    def mutation(run: Dict[str, Any]) -> None:
        selected = _task_by_id(run, task_id)
        selected["status"] = "succeeded"
        selected["acceptedReceiptId"] = receipt_id
        selected["receiptStatus"] = "accepted"
        selected["completedAt"] = utc_now()
        selected["updatedAt"] = selected["completedAt"]
        for item in run.get("receipts", []):
            if item.get("id") == receipt_id:
                item["status"] = "accepted"
                item["acceptedAt"] = selected["completedAt"]
        run["context"] = {
            "health": "ready",
            "taskId": task_id,
            "capsuleId": selected.get("capsuleId"),
            "sourceDigest": selected.get("sourceDigest"),
            "handoffSequence": selected.get("handoffSequence", 0),
            "exactNextAction": validation["receipt"]["exactNextAction"],
        }
        _event(run, "task_accepted", "Lead accepted the completion receipt", task_id)

    return mutate_state(root, mutation)


def complete_task_receipt(root: Path, task_id: str, raw_path: str, review: bool = False) -> Dict[str, Any]:
    """Solo-mode completion: submit and accept in one step. Validation runs once
    at submit; accept reuses the recorded submit-time source digest, so no work
    is duplicated. Pass review=True to stop at review_pending for a genuine
    lead/worker split (identical to `task submit`)."""
    state = submit_task_receipt(root, task_id, raw_path)
    if review:
        return state
    return accept_task_receipt(root, task_id)


def scaffold_receipt(root: Path, task_id: str, out: Optional[str] = None) -> Dict[str, Any]:
    """Pre-fill every mechanical receipt field (digests, capsule binding,
    evidence ids) so the agent only writes the claim fields it is actually
    asserting: statuses, resultSummary, changedPaths, decisions, assumptions,
    unresolvedRisks, exactNextAction."""
    state = load_state(root)
    task = _task_by_id(state, task_id)
    capsule_id = task.get("capsuleId")
    if not capsule_id:
        raise FactoryError(
            "Task %s has no capsule; run `context prepare %s` first." % (task_id, task_id)
        )
    capsule_path = context_dir(root) / (str(capsule_id) + ".json")
    if not capsule_path.is_file():
        raise FactoryError("Capsule %s is missing; re-run `context prepare %s`." % (capsule_id, task_id))
    capsule = _read_json(capsule_path)
    packet_digest = capsule.get("contract", {}).get("packetDigest")
    if not packet_digest:
        raise FactoryError("Capsule %s has no packetDigest; re-run `context prepare %s`." % (capsule_id, task_id))
    evidence_ids = [
        item["id"] for item in state.get("evidence", []) if item.get("taskId") == task_id
    ]
    draft = {
        "schemaVersion": RECEIPT_SCHEMA_VERSION,
        "contractType": "completion_receipt",
        "taskId": task_id,
        "resultSummary": "",
        "changedPaths": [],
        "acceptance": [
            {"id": item["id"], "status": "", "evidenceIds": list(evidence_ids)}
            for item in task.get("acceptance", [])
        ] or [{"id": "acceptance-1", "status": "", "evidenceIds": list(evidence_ids)}],
        "validations": [
            {"id": item["id"], "status": "", "evidenceIds": list(evidence_ids)}
            for item in task.get("validations", [])
        ] or [{"id": "validation-1", "status": "", "evidenceIds": list(evidence_ids)}],
        "decisions": [],
        "assumptions": [],
        "unresolvedRisks": [],
        "exactNextAction": "",
        "source": {
            "revision": _source_revision(root),
            "workingTreeDigest": _source_digest(root),
            "capsuleId": str(capsule_id),
            "packetDigest": packet_digest,
        },
    }
    if out:
        destination = root.resolve() / out
        if root.resolve() not in destination.resolve().parents and destination.resolve() != root.resolve():
            raise FactoryError("Receipt draft must stay inside the project root.")
    else:
        destination = receipts_dir(root) / "drafts" / ("%s.json" % task_id)
    destination.parent.mkdir(parents=True, exist_ok=True)
    _atomic_json_write(destination, draft)
    return {
        "path": str(destination),
        "taskId": task_id,
        "prefilled": ["source", "acceptance[].id", "validations[].id", "evidenceIds"],
        "fillBeforeSubmit": [
            "resultSummary",
            "acceptance[].status (pass|skip, skip needs note)",
            "validations[].status (pass)",
            "changedPaths",
            "decisions / assumptions / unresolvedRisks",
            "exactNextAction",
        ],
    }


def harness_render(root: Path, task_id: str, target: str) -> Dict[str, Any]:
    target = _normalize_harness_target(target)
    prepared = prepare_context_capsule(root, task_id, target)
    capsule = prepared["capsule"]
    return {
        "target": target,
        "adapterVersion": HARNESS_ADAPTER_VERSION,
        "canonicalTask": _canonical_task_packet(capsule),
        "packetDigest": capsule["contract"]["packetDigest"],
        "bootstrap": prepared["bootstrap"],
        "capsulePath": prepared["path"],
        "validation": validate_contract_payload(root, capsule, "capsule"),
    }


def _read_contract_file(root: Path, raw_path: str) -> Tuple[Optional[Path], Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    try:
        path = _resolve_project_file(root, raw_path, "Harness contract")
    except FactoryError as exc:
        return None, None, [_contract_error("missing_contract", (), "existing project file", str(exc), False, "blocked")]
    try:
        raw_payload = path.read_text(encoding="utf-8")
        payload = json.loads(raw_payload)
    except json.JSONDecodeError as exc:
        at_end = exc.pos >= max(0, len(raw_payload.rstrip()) - 1)
        truncated = at_end or "Unterminated" in exc.msg
        return path, None, [
            _contract_error(
                "truncated_output" if truncated else "malformed_json",
                (),
                "complete valid JSON object" if truncated else "valid JSON object",
                "line %s column %s" % (exc.lineno, exc.colno),
            )
        ]
    except OSError as exc:
        return path, None, [_contract_error("unreadable_contract", (), "readable JSON", str(exc), False, "blocked")]
    if not isinstance(payload, dict):
        return path, None, [_contract_error("type_mismatch", (), "object", type(payload).__name__)]
    return path, payload, []


def harness_validate_path(root: Path, raw_path: str, kind: str) -> Dict[str, Any]:
    path, payload, read_errors = _read_contract_file(root, raw_path)
    if read_errors:
        return {"valid": False, "kind": kind, "contractStatus": "invalid", "errors": read_errors, "path": str(path) if path else raw_path}
    assert payload is not None and path is not None
    if "refusal" in payload:
        return {
            "valid": False,
            "kind": kind,
            "contractStatus": "invalid",
            "errors": [
                _contract_error(
                    "model_refusal",
                    ("refusal",),
                    "factory-owned contract",
                    payload.get("refusal"),
                    False,
                    "blocked",
                )
            ],
            "path": str(path),
        }
    if payload.get("finishReason") in {"length", "max_tokens"}:
        return {
            "valid": False,
            "kind": kind,
            "contractStatus": "invalid",
            "errors": [
                _contract_error(
                    "truncated_output",
                    ("finishReason",),
                    "complete factory-owned contract",
                    payload.get("finishReason"),
                )
            ],
            "path": str(path),
        }
    validation = validate_contract_payload(root, payload, kind)
    errors = list(validation["errors"])
    if kind == "capsule" and not errors:
        audit = audit_context_capsule(root, str(payload.get("capsuleId", "")))
        errors.extend(audit.get("validationErrors", []))
        for code in audit.get("errors", []):
            if code not in {item["code"] for item in errors}:
                errors.append(_contract_error(code, (), "fresh capsule", code, False, "blocked"))
    elif kind == "receipt" and not errors:
        semantic = validate_receipt(root, str(path))
        errors.extend(semantic.get("validationErrors", []))
        for code in semantic.get("errors", []):
            if code not in {item["code"] for item in errors}:
                errors.append(_contract_error(code, (), "valid receipt semantics", code, False, "blocked"))
    elif kind == "workflow" and not errors:
        limits = payload["limits"]
        concurrent = limits["maxConcurrentAgents"]
        total = limits["maxTotalAgents"]
        if concurrent < 1 or total < 1 or concurrent > total:
            errors.append(
                _contract_error(
                    "invalid_workflow_limits",
                    ("limits",),
                    "1 <= maxConcurrentAgents <= maxTotalAgents",
                    limits,
                    False,
                    "blocked",
                )
            )
        if total > 20 and (
            limits.get("spendCeiling") is None or not payload.get("approvalRequirements")
        ):
            errors.append(
                _contract_error(
                    "workflow_approval_required",
                    ("limits", "maxTotalAgents"),
                    "exact scope approval and spend ceiling above 20 total agents",
                    total,
                    False,
                    "blocked",
                )
            )
        if payload["source"]["revision"] != _source_revision(root):
            errors.append(
                _contract_error(
                    "stale_head",
                    ("source", "revision"),
                    _source_revision(root),
                    payload["source"]["revision"],
                    False,
                    "blocked",
                )
            )
        if payload["source"]["workingTreeDigest"] != _source_digest(root):
            errors.append(
                _contract_error(
                    "stale_worktree",
                    ("source", "workingTreeDigest"),
                    _source_digest(root),
                    payload["source"]["workingTreeDigest"],
                    False,
                    "blocked",
                )
            )
    validation.update({"valid": not errors, "errors": errors, "path": str(path)})
    return validation


def harness_inspect(root: Path, task_id: str) -> Dict[str, Any]:
    state = load_state(root)
    task = _task_by_id(state, task_id)
    capsule_id = task.get("capsuleId")
    if not capsule_id:
        return {
            "taskId": task_id,
            "status": "blocked",
            "reason": "No context capsule is prepared.",
            "exactNextAction": "Run `factoryctl harness render %s --target=<agent>`." % task_id,
        }
    audit = audit_context_capsule(root, capsule_id)
    capsule = _read_json(context_dir(root) / (capsule_id + ".json"))
    return {
        "taskId": task_id,
        "status": "compatible" if audit["health"] == "ready" else "blocked",
        "contract": capsule.get("contract", {}),
        "audit": audit,
    }


def reject_task_receipt(root: Path, task_id: str, reason: str) -> Dict[str, Any]:
    def mutation(state: Dict[str, Any]) -> None:
        task = _task_by_id(state, task_id)
        if task.get("status") != "review_pending":
            raise FactoryError("Task %s has no receipt waiting for review." % task_id)
        task["status"] = "needs_revision"
        task["receiptStatus"] = "rejected"
        task["reviewReason"] = _redact_string(reason)
        task["updatedAt"] = utc_now()
        for item in state.get("receipts", []):
            if item.get("id") == task.get("submittedReceiptId"):
                item["status"] = "rejected"
        state["context"] = {
            "health": "needs_evidence",
            "taskId": task_id,
            "capsuleId": task.get("capsuleId"),
            "sourceDigest": task.get("sourceDigest"),
            "handoffSequence": task.get("handoffSequence", 0),
            "exactNextAction": "Address the lead review reason and submit a fresh receipt.",
        }
        _event(state, "task_rejected", reason, task_id)

    return mutate_state(root, mutation)


def record_blueprint_approval(root: Path, raw_path: str) -> Dict[str, Any]:
    path = _resolve_project_file(root, raw_path, "Blueprint approval input")
    payload = _read_json(path)
    required = ("mutationScope", "identifiers", "prices", "environments")
    missing = [key for key in required if key not in payload]
    if missing:
        raise FactoryError("Blueprint approval input is missing: %s" % ", ".join(missing))
    canonical = json.dumps(redact(payload), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = "sha256:%s" % hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def mutation(state: Dict[str, Any]) -> None:
        state["blueprintApproval"] = {
            "digest": digest,
            "sourcePath": path.relative_to(root.resolve()).as_posix(),
            "mutationScope": redact(payload["mutationScope"]),
            "identifiers": redact(payload["identifiers"]),
            "prices": redact(payload["prices"]),
            "environments": redact(payload["environments"]),
            "approvedAt": utc_now(),
            "status": "valid",
        }
        _event(state, "blueprint_approval_recorded", "Blueprint approval digest recorded")

    return mutate_state(root, mutation)


def audit_blueprint_approval(root: Path, raw_path: str) -> Dict[str, Any]:
    state = load_state(root)
    recorded = state.get("blueprintApproval")
    if not isinstance(recorded, dict):
        raise FactoryError("No blueprint approval digest is recorded.")
    path = _resolve_project_file(root, raw_path, "Blueprint approval input")
    payload = _read_json(path)
    canonical = json.dumps(redact(payload), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = "sha256:%s" % hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    valid = digest == recorded.get("digest")
    if not valid:
        def invalidate(run: Dict[str, Any]) -> None:
            approval = run.get("blueprintApproval")
            if not isinstance(approval, dict):
                return
            approval["status"] = "invalidated"
            approval["currentDigest"] = digest
            approval["invalidatedAt"] = utc_now()
            _event(run, "blueprint_approval_invalidated", "Blueprint approval scope changed")

        mutate_state(root, invalidate)
    return {
        "valid": valid,
        "recordedDigest": recorded.get("digest"),
        "currentDigest": digest,
        "status": "valid" if valid else "invalidated",
    }


def set_phase(root: Path, phase: str) -> Dict[str, Any]:
    if not re.fullmatch(r"[a-z][a-z0-9_-]*", phase):
        raise FactoryError("Phase must be a lowercase identifier.")

    def mutation(state: Dict[str, Any]) -> None:
        state["phase"] = phase
        _event(state, "phase_changed", "Phase changed to %s" % phase)

    return mutate_state(root, mutation)


def load_profile() -> Dict[str, Any]:
    path = profile_path()
    if not path.exists():
        return {"schemaVersion": SCHEMA_VERSION}
    try:
        with path.open("r", encoding="utf-8") as handle:
            profile = json.load(handle)
    except (json.JSONDecodeError, OSError) as exc:
        raise FactoryError("Operator profile is unreadable: %s" % exc) from exc
    if not isinstance(profile, dict):
        raise FactoryError("Operator profile root must be a JSON object.")
    return redact(profile)


def init_profile(values: Sequence[str]) -> Dict[str, Any]:
    profile = load_profile()
    profile["schemaVersion"] = SCHEMA_VERSION
    for assignment in values:
        if "=" not in assignment:
            raise FactoryError("Profile values must use key=value syntax.")
        key, value = assignment.split("=", 1)
        if key not in PROFILE_KEYS:
            if SECRET_KEY_RE.search(key):
                raise FactoryError("Secrets are forbidden in the operator profile: %s" % key)
            raise FactoryError("Unknown profile key %s. Allowed keys: %s" % (key, ", ".join(sorted(PROFILE_KEYS))))
        candidate = value.strip()
        if _redact_string(candidate) != candidate:
            raise FactoryError("Secret-shaped values are forbidden in the operator profile: %s" % key)
        profile[key] = candidate
    profile["updatedAt"] = utc_now()
    _atomic_json_write(profile_path(), profile)
    return profile


def _version_tuple(output: str) -> Optional[Tuple[int, int, int]]:
    match = VERSION_RE.search(output)
    return tuple(int(group) for group in match.groups()) if match else None


def _command_check(
    name: str,
    command: Sequence[str],
    minimum: Optional[Tuple[int, int, int]] = None,
    maximum: Optional[Tuple[int, int, int]] = None,
) -> Dict[str, Any]:
    executable = shutil.which(command[0])
    if not executable:
        return {"id": name, "status": "fail", "message": "%s is not installed" % command[0]}
    try:
        completed = subprocess.run(
            list(command), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=15, check=False
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"id": name, "status": "fail", "message": "%s check failed: %s" % (name, exc)}
    output = _redact_string(completed.stdout.strip().splitlines()[0] if completed.stdout.strip() else "")
    if completed.returncode != 0:
        return {"id": name, "status": "fail", "message": output or "%s returned an error" % name}
    version = _version_tuple(output)
    if minimum and (version is None or version < minimum):
        return {"id": name, "status": "fail", "message": "%s is too old (%s)" % (name, output or "unknown")}
    if maximum and version is not None and version >= maximum:
        return {"id": name, "status": "fail", "message": "%s is unsupported (%s)" % (name, output)}
    return {"id": name, "status": "pass", "message": output or "%s is available" % name}


def _ios_expert_skills_check(home: Optional[Path] = None) -> Dict[str, Any]:
    base = home or Path.home()
    required = ("swiftui-pro", "swift-concurrency-pro", "swift-testing-pro")
    missing = []
    for agent, directory in (
        ("codex", base / ".codex" / "skills"),
        ("claude", base / ".claude" / "skills"),
    ):
        for skill in required:
            if not (directory / skill / "SKILL.md").is_file():
                missing.append("%s:%s" % (agent, skill))
    return {
        "id": "ios-expert-skills",
        "status": "warn" if missing else "pass",
        "message": "Missing optional skills: %s" % ", ".join(missing)
        if missing
        else "Focused SwiftUI, concurrency, and testing skills are available for Claude and Codex",
    }


def _asc_agent_skills_check(home: Optional[Path] = None) -> Dict[str, Any]:
    base = home or Path.home()
    missing = []
    for agent, directory in (
        ("codex", base / ".codex" / "skills"),
        ("claude", base / ".claude" / "skills"),
    ):
        for skill in ASC_FACTORY_SKILLS:
            if not (directory / skill / "SKILL.md").is_file():
                missing.append("%s:%s" % (agent, skill))
    return {
        "id": "asc-agent-skills",
        "status": "warn" if missing else "pass",
        "message": "Missing selected ASC skills: %s" % ", ".join(missing)
        if missing
        else "Selected factory ASC skills are available for Claude and Codex",
    }


def _expo_agent_tools_check(root: Path) -> Dict[str, Any]:
    plugin = next((item for item in discover_codex_plugins() if item.get("title") == "expo"), None)
    mcp_ready = "expo" in _configured_mcp_names(root)
    if not _is_expo_project(root):
        return {
            "id": "expo-agent-tools",
            "status": "pass" if plugin and mcp_ready else "warn",
            "message": "Expo project not selected; plugin/MCP profile is %s/%s."
            % ("ready" if plugin else "missing", "configured" if mcp_ready else "missing"),
        }
    package_path = root.resolve() / "package.json"
    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        package = {}
    dependencies: Dict[str, Any] = {}
    if isinstance(package, dict):
        for field in ("dependencies", "devDependencies"):
            values = package.get(field, {})
            if isinstance(values, dict):
                dependencies.update(values)
    sdk_value = str(dependencies.get("expo", ""))
    sdk_match = re.search(r"(\d+)", sdk_value)
    sdk_major = int(sdk_match.group(1)) if sdk_match else None
    if sdk_major is None or sdk_major < 54:
        return {
            "id": "expo-agent-tools",
            "status": "fail",
            "message": "Expo SDK %s is below the SDK 54+ MCP gate; create an upgrade TODO before expo-mcp."
            % (sdk_major if sdk_major is not None else "unknown"),
            "sdkMajor": sdk_major,
        }
    missing = []
    if not plugin:
        missing.append("plugin:expo")
    if not mcp_ready:
        missing.append("mcp:expo")
    if "expo-mcp" not in dependencies:
        missing.append("devDependency:expo-mcp")
    return {
        "id": "expo-agent-tools",
        "status": "warn" if missing else "pass",
        "message": "Missing: %s" % ", ".join(missing) if missing else "Official Expo plugin, MCP, and SDK 54+ local dependency are ready",
        "sdkMajor": sdk_major,
    }


def _parse_version_bound(raw: str) -> Optional[Tuple[int, ...]]:
    match = re.fullmatch(r"(\d+)(?:\.(\d+))?(?:\.(\d+))?", raw.strip())
    if not match:
        return None
    return tuple(int(part) if part else 0 for part in match.groups())


def _pinned_tool_bounds(root: Path) -> Dict[str, Tuple[Optional[Tuple[int, ...]], Optional[Tuple[int, ...]]]]:
    """Read the asc/node version bounds from docs/pins.json (the pin manifest is
    the single source of truth). Falls back to the last-known bounds so a
    standalone factoryctl copy still works."""
    defaults: Dict[str, Tuple[Optional[Tuple[int, ...]], Optional[Tuple[int, ...]]]] = {
        "asc-cli": ((3, 1, 0), (4, 0, 0)),
        "node-runtime": ((22, 12, 0), None),
    }
    bounds = dict(defaults)
    try:
        payload = json.loads((root / "docs" / "pins.json").read_text(encoding="utf-8"))
        for pin in payload.get("pins", []):
            if pin.get("id") not in defaults:
                continue
            minimum: Optional[Tuple[int, ...]] = None
            maximum: Optional[Tuple[int, ...]] = None
            for clause in str(pin.get("pin", "")).split(","):
                clause = clause.strip()
                if clause.startswith(">="):
                    minimum = _parse_version_bound(clause[2:])
                elif clause.startswith("<"):
                    maximum = _parse_version_bound(clause[1:])
            if minimum:
                bounds[pin["id"]] = (minimum, maximum)
    except (OSError, ValueError, KeyError, json.JSONDecodeError):
        pass
    return bounds


def doctor_checks(root: Path, run_auth: bool = True) -> Dict[str, Any]:
    tool_bounds = _pinned_tool_bounds(root)
    asc_min, asc_max = tool_bounds["asc-cli"]
    node_min, _node_max = tool_bounds["node-runtime"]
    checks = [
        _command_check("asc", ["asc", "version"], asc_min, asc_max),
        _command_check("firebase", ["firebase", "--version"]),
        _command_check("wrangler", ["wrangler", "--version"]),
        _command_check("xcode", ["xcodebuild", "-version"]),
        _command_check("git", ["git", "--version"]),
        _command_check("node", ["node", "--version"], node_min),
        _command_check("npm", ["npm", "--version"]),
        _command_check("swiftc", ["swiftc", "--version"]),
        _command_check("imagemagick", ["magick", "-version"]),
        _command_check("maestro", ["maestro", "--version"]),
    ]
    for name, command in (
        ("fastlane-fallback", ["fastlane", "--version"]),
        ("eas-expo", ["eas", "--version"]),
    ):
        optional = _command_check(name, command)
        if optional["status"] == "fail":
            optional["status"] = "warn"
        checks.append(optional)
    checks.append(_ios_expert_skills_check())
    checks.append(_asc_agent_skills_check())
    checks.append(_expo_agent_tools_check(root))
    if run_auth:
        for name, command, dependency in (
            ("asc-auth", ["asc", "auth", "doctor"], "asc"),
            ("firebase-auth", ["firebase", "login:list"], "firebase"),
            ("wrangler-auth", ["wrangler", "whoami"], "wrangler"),
        ):
            dependency_ok = any(check["id"] == dependency and check["status"] == "pass" for check in checks)
            if dependency_ok:
                checks.append(_command_check(name, command))
    profile = load_profile()
    required_profile = {
        "appleTeamId",
        "testerEmail",
        "testerGroup",
        "supportEmail",
        "firebaseAccount",
        "cloudflareAccountId",
    }
    missing_profile = sorted(key for key in required_profile if not profile.get(key))
    checks.append(
        {
            "id": "operator-profile",
            "status": "fail" if missing_profile else "pass",
            "message": "Missing: %s" % ", ".join(missing_profile) if missing_profile else "Required non-secret fields are present",
        }
    )
    try:
        usage = shutil.disk_usage(root.resolve())
        free_gib = usage.free / (1024 ** 3)
        if free_gib >= 60:
            status = "pass"
        elif free_gib >= 30:
            status = "warn"
        else:
            status = "fail"
        checks.append(
            {
                "id": "disk",
                "status": status,
                "message": "%.1f GiB free; 60 GiB recommended, 30 GiB minimum" % free_gib,
                "freeGiB": round(free_gib, 1),
            }
        )
    except OSError as exc:
        checks.append({"id": "disk", "status": "fail", "message": "Disk check failed: %s" % exc})
    return {
        "ok": not any(check["status"] == "fail" for check in checks),
        "checks": checks,
        "checkedAt": utc_now(),
    }


def _json_output(value: Any) -> None:
    sys.stdout.write(json.dumps(redact(value), ensure_ascii=False, indent=2) + "\n")


def _summary_output(state: Dict[str, Any]) -> None:
    progress = state.get("progress", {})
    lines = [
        "Run: %s" % state.get("runId", "unknown"),
        "Phase: %s" % state.get("phase", "unknown"),
        "Progress: %(completed)s/%(total)s (%(percent)s%%)" % progress,
    ]
    current = [task for task in state.get("tasks", []) if task.get("status") == "running"]
    if current:
        lines.append("Running: " + ", ".join(task["title"] for task in current))
    open_actions = [action for action in state.get("humanActions", []) if action.get("status") == "open"]
    if open_actions:
        lines.append("Human actions: " + ", ".join(action["title"] for action in open_actions))
    sys.stdout.write("\n".join(lines) + "\n")


def _android_summary_output(state: Dict[str, Any]) -> None:
    progress = state.get("progress", {})
    parity = state.get("parity", {})
    lines = [
        "Android run: %s" % state.get("runId", "unknown"),
        "Phase: %s" % state.get("phase", "unknown"),
        "Scope: %s · through: %s" % (state.get("scope", "unknown"), state.get("through", "unknown")),
        "Tasks: %(completed)s/%(total)s (%(percent)s%%)" % progress,
        "Parity: %(verified)s/%(total)s verified · %(pending)s pending · %(exceptions)s exceptions" % parity,
    ]
    open_actions = [action for action in state.get("humanActions", []) if action.get("status") == "open"]
    if open_actions:
        lines.append("Human actions: " + ", ".join(action["title"] for action in open_actions))
    sys.stdout.write("\n".join(lines) + "\n")


def _capability_summary_output(result: Dict[str, Any]) -> None:
    items = result.get("capabilities", [])
    if result.get("stage"):
        sys.stdout.write("Capabilities for %s:\n" % result["stage"])
    else:
        sys.stdout.write("Capabilities:\n")
    for item in items:
        sys.stdout.write("- %s [%s] %s\n" % (item["id"], item["availability"], item["claudeInvocation"]))
    extras = result.get("extras", [])
    if extras:
        sys.stdout.write("Available extras:\n")
        for item in extras:
            sys.stdout.write("- %s\n" % item["skillInvocation"])


def _recommendation_summary_output(state: Dict[str, Any]) -> None:
    sys.stdout.write("Lifecycle stage: %s\n" % state.get("lifecycleStage", "unknown"))
    suggested = [item for item in state.get("recommendations", []) if item.get("status") == "suggested"][:3]
    todos = sorted(
        (item for item in state.get("recommendations", []) if item.get("status") == "todo"),
        key=_queue_sort_key,
    )[:10]
    if suggested:
        sys.stdout.write("Recommended now:\n")
        for item in suggested:
            suffix = " · parallelizable" if item.get("executionLane") == "cloud_safe" else ""
            sys.stdout.write("- %s: %s%s\n  %s\n" % (item["id"], item["title"], suffix, item["reason"]))
    unlock = state.get("unlockNext", [])[:1]
    if unlock:
        item = unlock[0]
        sys.stdout.write("Unlock next:\n- %s: %s\n  %s\n" % (item["capabilityId"], item["title"], item["reason"]))
    if todos:
        sys.stdout.write("Queued TODOs:\n")
        for item in todos:
            placement = item.get("queuePlacement", "after_milestone").replace("_", "-")
            blocked = " · waiting on %s" % ", ".join(item.get("blockedBy", [])) if item.get("blockedBy") else ""
            sys.stdout.write("- %s [%s]: %s%s\n" % (item["id"], placement, item["title"], blocked))


def register_project(root: Path) -> Dict[str, Any]:
    project_root = root.resolve()
    if not (project_root / "scripts" / "factoryctl.py").is_file() or not capabilities_path(project_root).is_file():
        raise FactoryError("Project registration requires an app-factory project root.")
    path = projects_path()
    payload: Dict[str, Any] = {"schemaVersion": 1, "projects": []}
    if path.is_file():
        try:
            current = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(current, dict) and current.get("schemaVersion") == 1 and isinstance(current.get("projects"), list):
                payload = current
        except (json.JSONDecodeError, OSError):
            pass
    projects = [item for item in payload["projects"] if isinstance(item, dict) and item.get("path") != str(project_root)]
    name = project_root.name
    try:
        product = (project_root / "PRODUCT.md").read_text(encoding="utf-8")
        heading = re.search(r"(?m)^#\s+(.+?)\s*$", product)
        if heading and "{{" not in heading.group(1):
            name = heading.group(1).strip()
    except OSError:
        pass
    projects.insert(0, {"id": hashlib.sha256(str(project_root).encode()).hexdigest()[:16], "name": name, "path": str(project_root), "lastOpenedAt": utc_now()})
    payload["projects"] = projects[:20]
    payload["updatedAt"] = utc_now()
    _atomic_json_write(path, payload)
    return payload


# --- Knowledge index, skills inventory, session bootstrap, feature registry ---

# Curated extra routing triggers for high-value docs. The index itself is
# generated from the docs tree so a new doc can never be silently lost; this map
# only improves recall for vocabulary the derived tokens miss.
KNOWLEDGE_EXTRA_TRIGGERS = {
    "docs/playbooks/design.md": ["ui", "visual", "tokens", "hierarchy", "polish", "screen"],
    "docs/playbooks/apple-hig.md": ["hig", "apple", "human", "interface"],
    "docs/playbooks/seo-fundamentals.md": ["seo", "keyword", "serp", "intent", "rank", "crawl"],
    "docs/playbooks/seo-content.md": ["seo", "content", "sitemap", "schema", "index"],
    "docs/playbooks/store-listing.md": ["aso", "screenshot", "metadata", "listing", "copywriting"],
    "docs/playbooks/app-store-growth.md": ["aso", "cpp", "ppo", "growth", "experiment"],
    "docs/playbooks/context-engineering.md": ["context", "capsule", "receipt", "handoff", "memory", "session"],
    "docs/playbooks/skill-discovery.md": ["skill", "discover", "install", "catalog"],
    "docs/playbooks/skill-management.md": ["skill", "inventory", "health", "manage"],
    "docs/playbooks/model-routing.md": ["model", "cost", "route", "delegate", "flash", "astra", "cheap", "orchestrate", "subagent", "worker", "dispatch", "effort", "parallel"],
    "docs/playbooks/ai-media.md": ["fal", "media", "provider", "image", "video", "credential"],
    "docs/playbooks/media-models.md": ["image", "video", "gpt-image-2.5", "minimax", "h3", "fal", "camera-controls", "reference-to-video", "text-to-video"],
    "docs/playbooks/dynamic-workflows.md": ["workflow", "fan-out", "parallel", "verification", "tournament"],
    "docs/playbooks/game-dev.md": ["game", "gameplay", "player", "level", "physics", "water"],
    "docs/playbooks/web-3d.md": ["three", "webgl", "webgpu", "shader", "3d", "scene"],
    "docs/playbooks/ios-simulator-ai.md": ["simulator", "xcode", "simctl", "evidence"],
    "docs/checklists/performance.md": ["performance", "frame", "fps", "jank", "startup", "memory"],
    "docs/playbooks/paywall.md": ["paywall", "purchase", "trial", "pricing"],
    "docs/playbooks/onboarding.md": ["onboarding", "activation", "permission", "personalization"],
}


def knowledge_index_path(root: Path) -> Path:
    return root.resolve() / "docs" / "knowledge-index.json"


def features_registry_path(root: Path) -> Path:
    return root.resolve() / "docs" / "features.md"


def session_path(root: Path) -> Path:
    return factory_dir(root) / "session.json"


def _atomic_text_write(path: Path, text: str, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".%s." % path.name, suffix=".tmp", dir=str(path.parent))
    temporary_path = Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary_path, mode)
        os.replace(temporary_path, path)
    finally:
        with contextlib.suppress(FileNotFoundError):
            temporary_path.unlink()


def _knowledge_doc_paths(root: Path) -> List[Path]:
    docs = root.resolve() / "docs"
    if not docs.is_dir():
        return []
    return [
        path
        for path in sorted(docs.rglob("*.md"))
        if not path.relative_to(root.resolve()).as_posix().startswith("docs/contracts/")
    ]


def _knowledge_title(text: str) -> str:
    match = re.search(r"(?m)^#\s+(.+?)\s*$", text)
    return match.group(1).strip() if match else ""


def _knowledge_when(text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("*Read "):
            return stripped.strip("*").strip()
    return ""


def _knowledge_entry(root: Path, path: Path) -> Dict[str, Any]:
    relative = path.relative_to(root.resolve()).as_posix()
    text = ""
    with contextlib.suppress(OSError, UnicodeError):
        text = path.read_text(encoding="utf-8")
    title = _knowledge_title(text) or Path(relative).stem.replace("-", " ").title()
    when = _knowledge_when(text)
    summary = when
    if not summary:
        for paragraph in text.split("\n\n"):
            cleaned = " ".join(paragraph.split())
            if cleaned and not cleaned.startswith(("#", "*", "|", "<!--")):
                summary = cleaned
                break
    if len(summary) > 240:
        summary = summary[:237].rstrip() + "..."
    tokens: List[str] = []
    for token in _tokenize("%s %s %s" % (Path(relative).stem, title, when)) + KNOWLEDGE_EXTRA_TRIGGERS.get(relative, []):
        if token and token not in tokens:
            tokens.append(token)
    parts = relative.split("/")
    return {
        "id": relative.removeprefix("docs/").removesuffix(".md").replace("/", "-"),
        "path": relative,
        "title": title,
        "summary": summary,
        "when": when,
        "docType": parts[1] if len(parts) >= 3 else "doc",
        "triggers": tokens[:14],
    }


def build_knowledge_index(root: Path) -> Dict[str, Any]:
    entries = [_knowledge_entry(root, path) for path in _knowledge_doc_paths(root)]
    return {"schemaVersion": KNOWLEDGE_INDEX_SCHEMA_VERSION, "entries": entries}


def knowledge_reindex(root: Path) -> Dict[str, Any]:
    payload = build_knowledge_index(root)
    _atomic_text_write(
        knowledge_index_path(root),
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
    )
    return {
        "schemaVersion": KNOWLEDGE_INDEX_SCHEMA_VERSION,
        "path": "docs/knowledge-index.json",
        "count": len(payload["entries"]),
    }


def load_knowledge_index(root: Path) -> Dict[str, Any]:
    path = knowledge_index_path(root)
    if not path.is_file():
        raise FactoryError(
            "Knowledge index is missing; regenerate it with `factoryctl knowledge index`."
        )
    payload = _read_json(path)
    if payload.get("schemaVersion") != KNOWLEDGE_INDEX_SCHEMA_VERSION:
        raise FactoryError("Unsupported knowledge index schema.")
    if not isinstance(payload.get("entries"), list):
        raise FactoryError("Knowledge index has no entries list.")
    return payload


def knowledge_list(root: Path, doc_type: Optional[str] = None) -> Dict[str, Any]:
    index = load_knowledge_index(root)
    entries = [entry for entry in index["entries"] if not doc_type or entry.get("docType") == doc_type]
    return {"schemaVersion": KNOWLEDGE_INDEX_SCHEMA_VERSION, "count": len(entries), "entries": entries}


def knowledge_search(root: Path, intent: str) -> Dict[str, Any]:
    if not intent.strip():
        raise FactoryError("Knowledge intent cannot be empty.")
    index = load_knowledge_index(root)
    intent_tokens = set(_tokenize(intent))
    lowered = intent.lower()
    ranked: List[Dict[str, Any]] = []
    for entry in index["entries"]:
        searchable = " ".join(
            [entry["id"], entry["title"], entry.get("summary", ""), entry.get("when", "")]
            + entry.get("triggers", [])
        )
        candidate_tokens = set(_tokenize(searchable))
        overlap = intent_tokens & candidate_tokens
        score = len(overlap) * 2
        score += sum(3 for trigger in entry.get("triggers", []) if len(trigger) > 3 and trigger in lowered)
        if entry["id"] in lowered:
            score += 6
        if score <= 0:
            continue
        ranked.append(
            {
                "id": entry["id"],
                "path": entry["path"],
                "title": entry["title"],
                "summary": entry["summary"],
                "docType": entry.get("docType", "doc"),
                "score": score,
                "matchedTerms": sorted(overlap)[:8],
            }
        )
    ranked.sort(key=lambda item: (-item["score"], item["id"]))
    candidates = ranked[:3]
    confidence = "low"
    selected = None
    if candidates and candidates[0]["score"] >= 6:
        confidence = "high"
        selected = candidates[0]["id"]
    return {
        "schemaVersion": KNOWLEDGE_INDEX_SCHEMA_VERSION,
        "intentDigest": "sha256:%s" % hashlib.sha256(intent.encode("utf-8")).hexdigest(),
        "confidence": confidence,
        "selected": selected,
        "candidates": candidates,
        "telemetry": {"indexEntries": len(index["entries"]), "candidateCount": len(candidates)},
    }


def _relative(root: Path, path: Path) -> str:
    return path.relative_to(root.resolve()).as_posix()


def skills_inventory(root: Path) -> Dict[str, Any]:
    project_root = root.resolve()
    commands_dir = project_root / ".claude" / "commands"
    skills_dir = project_root / ".agents" / "skills"
    skills: List[Dict[str, Any]] = []
    known_dirs = set()
    for command_file in sorted(commands_dir.glob("*.md")) if commands_dir.is_dir() else []:
        command_id = command_file.stem
        external = command_id == "find-skills"
        skill_dir = skills_dir / ("find-skills" if external else "source-command-%s" % command_id)
        known_dirs.add(skill_dir.name)
        source = None
        source_path = skill_dir / "SOURCE.json"
        if source_path.is_file():
            with contextlib.suppress(FactoryError):
                meta = _read_json(source_path)
                source = {
                    "source": meta.get("source"),
                    "revision": meta.get("revision"),
                    "license": meta.get("license"),
                }
        skills.append(
            {
                "id": command_id,
                "kind": "external" if external else "first_party",
                "commandPath": _relative(root, command_file),
                "skillPath": _relative(root, skill_dir / "SKILL.md") if (skill_dir / "SKILL.md").is_file() else None,
                "hasSkillManifest": (skill_dir / "agents" / "openai.yaml").is_file(),
                "external": external,
                "source": source,
            }
        )
    orphans = (
        sorted(path.name for path in skills_dir.iterdir() if path.is_dir() and path.name not in known_dirs)
        if skills_dir.is_dir()
        else []
    )
    return {
        "schemaVersion": 1,
        "count": len(skills),
        "skills": skills,
        "orphanSkillDirs": orphans,
    }


def skills_health(root: Path) -> Dict[str, Any]:
    inventory = skills_inventory(root)
    issues: List[str] = []
    for skill in inventory["skills"]:
        if not skill["skillPath"]:
            issues.append("%s: missing SKILL.md" % skill["id"])
        if skill["kind"] == "first_party" and not skill["hasSkillManifest"]:
            issues.append("%s: missing agents/openai.yaml" % skill["id"])
    for orphan in inventory["orphanSkillDirs"]:
        issues.append("%s: skill directory has no matching command" % orphan)
    return {
        "schemaVersion": 1,
        "ok": not issues,
        "count": inventory["count"],
        "issues": issues,
    }


def _app_name(root: Path) -> str:
    product = root.resolve() / "PRODUCT.md"
    if product.is_file():
        with contextlib.suppress(OSError, UnicodeError):
            heading = _knowledge_title(product.read_text(encoding="utf-8"))
            for prefix in ("PRODUCT — ", "PRODUCT - ", "PRODUCT: "):
                heading = heading.removeprefix(prefix)
            if heading and "{{" not in heading:
                return heading.strip()
    return root.resolve().name


def _file_sha(root: Path, relative: str) -> Optional[str]:
    path = root.resolve() / relative
    return _sha256_file(path) if path.is_file() else None


def _session_baseline(root: Path) -> Dict[str, Any]:
    return {
        "head": _source_revision(root),
        "workingTreeDigest": _source_digest(root),
        "productSha256": _file_sha(root, "PRODUCT.md"),
        "featuresSha256": _file_sha(root, "docs/features.md"),
        "readmeSha256": _file_sha(root, "README.md"),
    }


def _safe_load_run(root: Path) -> Optional[Dict[str, Any]]:
    with contextlib.suppress(FactoryError):
        return load_state(root)
    return None


def session_start(root: Path) -> Dict[str, Any]:
    run = _safe_load_run(root)
    try:
        capability_state = load_capability_state(root, allow_missing=True)
    except FactoryError:
        capability_state = {}
    stage = capability_state.get("lifecycleStage") or "setup"
    run_summary = None
    if run:
        progress = run.get("progress", {})
        run_summary = {
            "runId": run.get("runId"),
            "phase": run.get("phase"),
            "completed": progress.get("completed"),
            "total": progress.get("total"),
        }
    recommendations: List[Dict[str, Any]] = []
    with contextlib.suppress(FactoryError):
        state = refresh_recommendations(root)
        recommendations = [
            {"id": item["id"], "title": item["title"], "reason": item.get("reason", "")}
            for item in state.get("recommendations", [])
            if item.get("status") == "suggested"
        ][:3]
    baseline = _session_baseline(root)
    session = {
        "schemaVersion": SESSION_SCHEMA_VERSION,
        "startedAt": utc_now(),
        "finishedAt": None,
        "app": _app_name(root),
        "stage": stage,
        "baseline": baseline,
    }
    _atomic_json_write(session_path(root), session)
    return {
        "schemaVersion": SESSION_SCHEMA_VERSION,
        "app": session["app"],
        "stage": stage,
        "run": run_summary,
        "recommendations": recommendations,
        "canonicalDocs": [
            "PRODUCT.md",
            "docs/mvp-plan.md",
            "docs/features.md",
            "docs/architecture.md",
            "docs/stack.md",
        ],
        "baseline": baseline,
        "nextAction": "Run `factoryctl context route --intent-stdin` for the task, then update docs/features.md (and README) before `session finish`.",
    }


def session_finish(root: Path) -> Dict[str, Any]:
    path = session_path(root)
    if not path.is_file():
        raise FactoryError("No session is active; run `factoryctl session start` first.")
    session = _read_json(path)
    if session.get("schemaVersion") != SESSION_SCHEMA_VERSION:
        raise FactoryError("Unsupported session schema; run `factoryctl session start` again.")
    baseline = session.get("baseline", {})
    current = _session_baseline(root)
    code_changed = (
        baseline.get("head") != current.get("head")
        or baseline.get("workingTreeDigest") != current.get("workingTreeDigest")
    )
    features_updated = baseline.get("featuresSha256") != current.get("featuresSha256")
    readme_updated = baseline.get("readmeSha256") != current.get("readmeSha256")
    memory_update_suggested = code_changed and not features_updated and not readme_updated
    session["finishedAt"] = utc_now()
    _atomic_json_write(path, session)
    return {
        "schemaVersion": SESSION_SCHEMA_VERSION,
        "app": session.get("app"),
        "codeChanged": code_changed,
        "featuresRegistryUpdated": features_updated,
        "readmeUpdated": readme_updated,
        "memoryUpdateSuggested": memory_update_suggested,
        "hint": (
            "Code changed but docs/features.md and README.md did not. Record the shipped feature or run `factoryctl features add`."
            if memory_update_suggested
            else "Memory looks consistent with this session."
        ),
    }


FEATURES_TABLE_HEADER = "| Feature | Screens / routes | Analytics events | String namespace | Since |"


def _features_rows(root: Path) -> Tuple[str, List[Dict[str, str]]]:
    path = features_registry_path(root)
    if not path.is_file():
        raise FactoryError("docs/features.md is missing; create it from the kit template.")
    text = path.read_text(encoding="utf-8")
    rows: List[Dict[str, str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") or set(stripped) <= {"|", "-", " "}:
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) < 5 or cells[0] in ("Feature", ""):
            continue
        if cells[0].startswith("<!--"):
            continue
        rows.append(
            {
                "feature": cells[0],
                "screens": cells[1],
                "analytics": cells[2],
                "namespace": cells[3],
                "since": cells[4],
            }
        )
    return text, rows


def features_list(root: Path) -> Dict[str, Any]:
    _, rows = _features_rows(root)
    return {"schemaVersion": 1, "count": len(rows), "features": rows}


def features_check(root: Path) -> Dict[str, Any]:
    text, rows = _features_rows(root)
    header_present = FEATURES_TABLE_HEADER in text
    return {
        "schemaVersion": 1,
        "ok": header_present,
        "count": len(rows),
        "headerPresent": header_present,
    }


def features_add(
    root: Path,
    feature: str,
    screens: str,
    analytics: str,
    namespace: str,
    since: str,
) -> Dict[str, Any]:
    for label, value in (("feature", feature),):
        if not value.strip():
            raise FactoryError("Feature %s must be a non-empty string." % label)
    text, rows = _features_rows(root)
    cells = [feature, screens, analytics, namespace, since]
    if any("|" in cell for cell in cells):
        raise FactoryError("Feature registry cells must not contain '|'.")
    row = "| %s |" % " | ".join(cells)
    if not text.endswith("\n"):
        text += "\n"
    text += row + "\n"
    _atomic_text_write(features_registry_path(root), text)
    return {"schemaVersion": 1, "added": dict(zip(("feature", "screens", "analytics", "namespace", "since"), cells)), "count": len(rows) + 1}


def _knowledge_summary_output(result: Dict[str, Any], command: str) -> None:
    if command == "list":
        sys.stdout.write("Knowledge index: %d docs\n" % result.get("count", 0))
        for entry in result.get("entries", []):
            sys.stdout.write("- %s [%s] %s\n" % (entry["id"], entry.get("docType", "doc"), entry["title"]))
        return
    if command == "index":
        sys.stdout.write("Indexed %d docs into %s\n" % (result.get("count", 0), result.get("path")))
        return
    sys.stdout.write("Knowledge route (%s confidence)\n" % result.get("confidence", "low"))
    for candidate in result.get("candidates", []):
        sys.stdout.write("- %s [%d] %s\n  %s\n" % (candidate["path"], candidate["score"], candidate["title"], candidate["summary"]))


def _skills_summary_output(result: Dict[str, Any]) -> None:
    if "issues" in result:
        if result["ok"]:
            sys.stdout.write("Skills health: OK (%d skills)\n" % result.get("count", 0))
        else:
            sys.stdout.write("Skills health: %d issue(s)\n" % len(result["issues"]))
            for issue in result["issues"]:
                sys.stdout.write("- %s\n" % issue)
        return
    sys.stdout.write("Skills: %d\n" % result.get("count", 0))
    for skill in result.get("skills", []):
        source = " (external %s)" % (skill["source"] or {}).get("revision", "unknown") if skill["external"] else ""
        sys.stdout.write("- %s [%s]%s\n" % (skill["id"], skill["kind"], source))
    for orphan in result.get("orphanSkillDirs", []):
        sys.stdout.write("- orphan: %s\n" % orphan)


def _session_summary_output(result: Dict[str, Any], command: str) -> None:
    if command == "start":
        sys.stdout.write("Session start: %s · %s\n" % (result.get("app"), result.get("stage")))
        run = result.get("run")
        if run:
            sys.stdout.write("Run: %s · phase %s (%s/%s)\n" % (run.get("runId"), run.get("phase"), run.get("completed"), run.get("total")))
        for item in result.get("recommendations", []):
            sys.stdout.write("- %s: %s\n" % (item["id"], item["title"]))
        sys.stdout.write("%s\n" % result.get("nextAction", ""))
        return
    sys.stdout.write("Session finish: code changed=%s · features updated=%s · readme updated=%s\n" % (result["codeChanged"], result["featuresRegistryUpdated"], result["readmeUpdated"]))
    if result.get("memoryUpdateSuggested"):
        sys.stdout.write("WARNING: %s\n" % result["hint"])
    else:
        sys.stdout.write("%s\n" % result["hint"])


def _features_summary_output(result: Dict[str, Any]) -> None:
    if "added" in result:
        sys.stdout.write("Feature registered: %s (now %d)\n" % (result["added"]["feature"], result["count"]))
        return
    if "headerPresent" in result:
        sys.stdout.write("Feature registry: %d feature(s) · header %s\n" % (result["count"], "ok" if result["headerPresent"] else "missing"))
        return
    sys.stdout.write("Features: %d\n" % result.get("count", 0))
    for feature in result.get("features", []):
        sys.stdout.write("- %s (%s)\n" % (feature["feature"], feature["since"]))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage a local app-factory run without storing secrets.")
    parser.add_argument("--root", default=".", help="Generated app root (default: current directory)")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON")
    subparsers = parser.add_subparsers(dest="command", required=True)

    doctor = subparsers.add_parser("doctor", help="Check required local tools and disk space")
    doctor.add_argument("--skip-auth", action="store_true", help="Skip asc auth doctor")

    profile = subparsers.add_parser("profile", help="Manage the non-secret operator profile")
    profile_sub = profile.add_subparsers(dest="profile_command", required=True)
    profile_sub.add_parser("show")
    profile_init = profile_sub.add_parser("init")
    profile_init.add_argument("values", nargs="*", metavar="key=value")

    project = subparsers.add_parser("project", help="Manage the secret-free recent-project registry")
    project_sub = project.add_subparsers(dest="project_command", required=True)
    project_sub.add_parser("register")
    project_sub.add_parser("list")

    run = subparsers.add_parser("run", help="Manage a factory run")
    run_sub = run.add_subparsers(dest="run_command", required=True)
    run_init = run_sub.add_parser("init")
    run_init.add_argument("--source", required=True)
    run_init.add_argument("--locales", choices=sorted(LOCALE_PROFILES), default="launch")
    run_sub.add_parser("resume")
    run_phase = run_sub.add_parser("phase")
    run_phase.add_argument("phase")
    run_stage = run_sub.add_parser("stage")
    run_stage.add_argument("stage", choices=sorted(LIFECYCLE_STAGES))

    android = subparsers.add_parser("android", help="Manage an independent native Android parity run")
    android_sub = android.add_subparsers(dest="android_command", required=True)
    android_init = android_sub.add_parser("init")
    android_init.add_argument("--scope", choices=sorted(ANDROID_SCOPES), default="shipped")
    android_init.add_argument("--through", choices=sorted(ANDROID_DELIVERY_TARGETS), default="internal")
    android_resume = android_sub.add_parser("resume")
    android_resume.add_argument("--scope", choices=sorted(ANDROID_SCOPES))
    android_resume.add_argument("--through", choices=sorted(ANDROID_DELIVERY_TARGETS))
    android_sub.add_parser("status")
    android_phase = android_sub.add_parser("phase")
    android_phase.add_argument("phase", choices=ANDROID_PHASES)

    android_parity = android_sub.add_parser("parity")
    android_parity_sub = android_parity.add_subparsers(dest="android_parity_command", required=True)
    android_parity_set = android_parity_sub.add_parser("set")
    android_parity_set.add_argument("--total", type=int, required=True)
    android_parity_set.add_argument("--verified", type=int, required=True)
    android_parity_set.add_argument("--exceptions", type=int, required=True)

    android_task = android_sub.add_parser("task")
    android_task_sub = android_task.add_subparsers(dest="android_task_command", required=True)
    android_task_add = android_task_sub.add_parser("add")
    android_task_add.add_argument("id")
    android_task_add.add_argument("title")
    android_task_add.add_argument("--depends-on", action="append", default=[])
    android_task_add.add_argument("--lane", choices=sorted(EXECUTION_LANES), default="local")
    for name in ("start", "done", "skip"):
        command = android_task_sub.add_parser(name)
        command.add_argument("id")
    android_task_fail = android_task_sub.add_parser("fail")
    android_task_fail.add_argument("id")
    android_task_fail.add_argument("--error", required=True)
    android_task_wait = android_task_sub.add_parser("wait")
    android_task_wait.add_argument("id")
    android_task_wait.add_argument("--reason", required=True)
    android_task_wait.add_argument("--human-action-id")
    android_task_block = android_task_sub.add_parser("block")
    android_task_block.add_argument("id")
    android_task_block.add_argument("--reason", required=True)

    android_human = android_sub.add_parser("human")
    android_human_sub = android_human.add_subparsers(dest="android_human_command", required=True)
    android_human_add = android_human_sub.add_parser("add")
    android_human_add.add_argument("id")
    android_human_add.add_argument("title")
    android_human_add.add_argument("--instructions", required=True)
    android_human_add.add_argument("--task-id")
    android_human_add.add_argument("--url")
    android_human_resolve = android_human_sub.add_parser("resolve")
    android_human_resolve.add_argument("id")
    android_human_resolve.add_argument("--active-minutes", type=float, default=0)

    android_evidence = android_sub.add_parser("evidence")
    android_evidence_sub = android_evidence.add_subparsers(dest="android_evidence_command", required=True)
    android_evidence_add = android_evidence_sub.add_parser("add")
    android_evidence_add.add_argument("task_id")
    android_evidence_add.add_argument("path")
    android_evidence_add.add_argument("--kind", default="file")
    android_evidence_add.add_argument("--label")

    task = subparsers.add_parser("task", help="Define or transition tasks")
    task_sub = task.add_subparsers(dest="task_command", required=True)
    task_add = task_sub.add_parser("add")
    task_add.add_argument("id")
    task_add.add_argument("title")
    task_add.add_argument("--depends-on", action="append", default=[])
    task_add.add_argument("--lane", choices=sorted(EXECUTION_LANES), default="local")
    task_add.add_argument("--capability")
    task_add.add_argument("--objective")
    task_add.add_argument("--allow-path", action="append", default=[])
    task_add.add_argument("--forbid-path", action="append", default=[])
    task_add.add_argument("--acceptance", action="append", default=[])
    task_add.add_argument("--validate", action="append", default=[])
    for name in ("start", "done", "skip", "accept"):
        command = task_sub.add_parser(name)
        command.add_argument("id")
    task_submit = task_sub.add_parser("submit")
    task_submit.add_argument("id")
    task_submit.add_argument("--receipt", required=True)
    task_complete = task_sub.add_parser("complete", help="Submit and accept a receipt in one step (solo mode)")
    task_complete.add_argument("id")
    task_complete.add_argument("--receipt", required=True)
    task_complete.add_argument("--review", action="store_true", help="Stop at review_pending for a separate lead review")
    task_reject = task_sub.add_parser("reject")
    task_reject.add_argument("id")
    task_reject.add_argument("--reason", required=True)
    task_fail = task_sub.add_parser("fail")
    task_fail.add_argument("id")
    task_fail.add_argument("--error", required=True)
    task_wait = task_sub.add_parser("wait")
    task_wait.add_argument("id")
    task_wait.add_argument("--reason", required=True)
    task_wait.add_argument("--human-action-id")
    task_block = task_sub.add_parser("block")
    task_block.add_argument("id")
    task_block.add_argument("--reason", required=True)

    human = subparsers.add_parser("human", help="Manage human-only action cards")
    human_sub = human.add_subparsers(dest="human_command", required=True)
    human_add = human_sub.add_parser("add")
    human_add.add_argument("id")
    human_add.add_argument("title")
    human_add.add_argument("--instructions", required=True)
    human_add.add_argument("--task-id")
    human_add.add_argument("--url")
    human_resolve = human_sub.add_parser("resolve")
    human_resolve.add_argument("id")
    human_resolve.add_argument("--active-minutes", type=float, default=0)

    evidence = subparsers.add_parser("evidence", help="Attach a local evidence path")
    evidence_sub = evidence.add_subparsers(dest="evidence_command", required=True)
    evidence_add = evidence_sub.add_parser("add")
    evidence_add.add_argument("task_id")
    evidence_add.add_argument("path")
    evidence_add.add_argument("--kind", default="file")
    evidence_add.add_argument("--label")

    context_command = subparsers.add_parser("context", help="Route, prepare, and audit bounded task context")
    context_sub = context_command.add_subparsers(dest="context_command", required=True)
    context_route = context_sub.add_parser("route")
    context_input = context_route.add_mutually_exclusive_group(required=True)
    context_input.add_argument("--intent")
    context_input.add_argument("--intent-stdin", action="store_true")
    context_prepare = context_sub.add_parser("prepare")
    context_prepare.add_argument("task_id")
    context_prepare.add_argument("--target", choices=("codex", "claude", "cli", "grok", "other"), default="cli")
    for name in ("audit", "inspect"):
        command = context_sub.add_parser(name)
        command.add_argument("capsule_id")

    receipt = subparsers.add_parser("receipt", help="Scaffold or validate a completion receipt")
    receipt_sub = receipt.add_subparsers(dest="receipt_command", required=True)
    receipt_validate = receipt_sub.add_parser("validate")
    receipt_validate.add_argument("path")
    receipt_scaffold = receipt_sub.add_parser("scaffold", help="Pre-fill the mechanical receipt fields for a task")
    receipt_scaffold.add_argument("task_id")
    receipt_scaffold.add_argument("--out", help="Draft path relative to the project root")

    harness = subparsers.add_parser("harness", help="Render, validate, and inspect agent handoff contracts")
    harness_sub = harness.add_subparsers(dest="harness_command", required=True)
    harness_render_parser = harness_sub.add_parser("render")
    harness_render_parser.add_argument("task_id")
    harness_render_parser.add_argument("--target", choices=("codex", "claude", "cli"), required=True)
    harness_validate_parser = harness_sub.add_parser("validate")
    harness_validate_parser.add_argument("path")
    harness_validate_parser.add_argument("--kind", choices=sorted(HARNESS_CONTRACT_KINDS), required=True)
    harness_inspect_parser = harness_sub.add_parser("inspect")
    harness_inspect_parser.add_argument("task_id")

    approval = subparsers.add_parser("approval", help="Record or audit approval digests")
    approval_sub = approval.add_subparsers(dest="approval_command", required=True)
    blueprint = approval_sub.add_parser("blueprint")
    blueprint_sub = blueprint.add_subparsers(dest="blueprint_command", required=True)
    for name in ("record", "audit"):
        command = blueprint_sub.add_parser(name)
        command.add_argument("--file", required=True)

    checkpoint = subparsers.add_parser("checkpoint", help="Create a resumable phase checkpoint")
    checkpoint_sub = checkpoint.add_subparsers(dest="checkpoint_command", required=True)
    checkpoint_create = checkpoint_sub.add_parser("create")
    checkpoint_create.add_argument("task_id")
    checkpoint_create.add_argument("--phase", required=True)
    checkpoint_create.add_argument("--target", choices=("codex", "claude", "cli", "grok", "other"), default="cli")

    capability = subparsers.add_parser("capability", help="Discover the stage-aware capability catalog")
    capability_sub = capability.add_subparsers(dest="capability_command", required=True)
    capability_list = capability_sub.add_parser("list")
    capability_list.add_argument("--stage", choices=sorted(LIFECYCLE_STAGES))
    capability_list.add_argument("--available-only", action="store_true")

    recommend = subparsers.add_parser("recommend", help="Refresh and manage project recommendations")
    recommend_sub = recommend.add_subparsers(dest="recommend_command", required=True)
    recommend_sub.add_parser("refresh")
    recommend_sub.add_parser("list")
    for name in ("todo", "dismiss", "done"):
        recommend_transition = recommend_sub.add_parser(name)
        recommend_transition.add_argument("id")
        if name == "todo":
            recommend_transition.add_argument(
                "--placement",
                choices=("after-current", "after-milestone", "later"),
                default="after-milestone",
            )
        elif name == "done":
            recommend_transition.add_argument("--task-id", required=False)
    recommend_move = recommend_sub.add_parser("move")
    recommend_move.add_argument("id")
    recommend_move_target = recommend_move.add_mutually_exclusive_group(required=True)
    recommend_move_target.add_argument("--before")
    recommend_move_target.add_argument("--after")

    knowledge = subparsers.add_parser("knowledge", help="Search and maintain the kit knowledge index")
    knowledge_sub = knowledge.add_subparsers(dest="knowledge_command", required=True)
    knowledge_sub.add_parser("list")
    knowledge_sub.add_parser("index")
    knowledge_search_parser = knowledge_sub.add_parser("search")
    knowledge_input = knowledge_search_parser.add_mutually_exclusive_group(required=True)
    knowledge_input.add_argument("--query")
    knowledge_input.add_argument("--intent-stdin", action="store_true")

    skills = subparsers.add_parser("skills", help="Inventory first-party and installed skills")
    skills_sub = skills.add_subparsers(dest="skills_command", required=True)
    skills_sub.add_parser("list")
    skills_sub.add_parser("health")

    session = subparsers.add_parser("session", help="Start or finish a context-bounded work session")
    session_sub = session.add_subparsers(dest="session_command", required=True)
    session_sub.add_parser("start")
    session_sub.add_parser("finish")

    features = subparsers.add_parser("features", help="Maintain the shipped-feature registry")
    features_sub = features.add_subparsers(dest="features_command", required=True)
    features_sub.add_parser("list")
    features_sub.add_parser("check")
    features_add_parser = features_sub.add_parser("add")
    features_add_parser.add_argument("--feature", required=True)
    features_add_parser.add_argument("--screens", default="")
    features_add_parser.add_argument("--analytics", default="")
    features_add_parser.add_argument("--namespace", default="")
    features_add_parser.add_argument("--since", default="")

    subparsers.add_parser("status", help="Show the current factory run")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    root = Path(args.root)
    try:
        if args.command == "doctor":
            result = doctor_checks(root, not args.skip_auth)
            _json_output(result)
            return 0 if result["ok"] else 1
        if args.command == "profile":
            result = load_profile() if args.profile_command == "show" else init_profile(args.values)
            _json_output(result)
            return 0
        if args.command == "project":
            if args.project_command == "register":
                result = register_project(root)
            else:
                path = projects_path()
                if not path.is_file():
                    result = {"schemaVersion": 1, "projects": []}
                else:
                    try:
                        result = json.loads(path.read_text(encoding="utf-8"))
                    except (json.JSONDecodeError, OSError) as exc:
                        raise FactoryError("Recent-project registry is unreadable: %s" % exc) from exc
            _json_output(result)
            return 0
        if args.command == "run":
            if args.run_command == "init":
                result = init_run(root, args.source, args.locales)
                set_lifecycle_stage(root, "discovery")
            elif args.run_command == "phase":
                result = set_phase(root, args.phase)
                stage_by_phase = {
                    "research": "discovery",
                    "strategy": "planning",
                    "blueprint": "planning",
                    "build": "build",
                    "backend_web": "build",
                    "localization_assets": "build",
                    "release": "release",
                    "post_launch": "post_launch",
                }
                if args.phase in stage_by_phase:
                    set_lifecycle_stage(root, stage_by_phase[args.phase])
            elif args.run_command == "stage":
                result = set_lifecycle_stage(root, args.stage)
                _json_output(result) if args.json else _recommendation_summary_output(result)
                return 0
            else:
                result = load_state(root)
            _json_output(result) if args.json else _summary_output(result)
            return 0
        if args.command == "android":
            if args.android_command == "init":
                result = init_android_run(root, args.scope, args.through)
            elif args.android_command == "resume":
                result = resume_android_run(root, args.scope, args.through)
            elif args.android_command == "status":
                result = load_android_state(root)
            elif args.android_command == "phase":
                result = set_android_phase(root, args.phase)
            elif args.android_command == "parity":
                result = set_android_parity(root, args.total, args.verified, args.exceptions)
            elif args.android_command == "task":
                if args.android_task_command == "add":
                    result = add_task(root, args.id, args.title, args.depends_on, args.lane, "android")
                elif args.android_task_command == "start":
                    result = _transition_task(root, args.id, "running", namespace="android")
                elif args.android_task_command == "done":
                    result = _transition_task(root, args.id, "succeeded", namespace="android")
                elif args.android_task_command == "fail":
                    result = _transition_task(root, args.id, "failed", args.error, namespace="android")
                elif args.android_task_command == "wait":
                    result = _transition_task(
                        root,
                        args.id,
                        "waiting_human",
                        args.reason,
                        args.human_action_id,
                        "android",
                    )
                elif args.android_task_command == "block":
                    result = _transition_task(root, args.id, "blocked", args.reason, namespace="android")
                else:
                    result = _transition_task(root, args.id, "skipped", namespace="android")
            elif args.android_command == "human":
                if args.android_human_command == "add":
                    result = add_human_action(
                        root,
                        args.id,
                        args.title,
                        args.instructions,
                        args.task_id,
                        args.url,
                        "android",
                    )
                else:
                    result = resolve_human_action(root, args.id, args.active_minutes, "android")
            else:
                result = add_evidence(root, args.task_id, args.path, args.kind, args.label, "android")
            _json_output(result) if args.json else _android_summary_output(result)
            return 0
        if args.command == "task":
            if args.task_command == "add":
                result = add_task(
                    root,
                    args.id,
                    args.title,
                    args.depends_on,
                    args.lane,
                    "run",
                    args.capability,
                    args.objective,
                    args.allow_path,
                    args.forbid_path,
                    args.acceptance,
                    args.validate,
                )
            elif args.task_command == "start":
                result = _transition_task(root, args.id, "running")
            elif args.task_command == "done":
                result = _transition_task(root, args.id, "succeeded")
            elif args.task_command == "submit":
                result = submit_task_receipt(root, args.id, args.receipt)
            elif args.task_command == "complete":
                result = complete_task_receipt(root, args.id, args.receipt, args.review)
            elif args.task_command == "accept":
                result = accept_task_receipt(root, args.id)
            elif args.task_command == "reject":
                result = reject_task_receipt(root, args.id, args.reason)
            elif args.task_command == "fail":
                result = _transition_task(root, args.id, "failed", args.error)
            elif args.task_command == "wait":
                result = _transition_task(root, args.id, "waiting_human", args.reason, args.human_action_id)
            elif args.task_command == "block":
                result = _transition_task(root, args.id, "blocked", args.reason)
            else:
                result = _transition_task(root, args.id, "skipped")
            _json_output(result) if args.json else _summary_output(result)
            return 0
        if args.command == "human":
            if args.human_command == "add":
                result = add_human_action(root, args.id, args.title, args.instructions, args.task_id, args.url)
            else:
                result = resolve_human_action(root, args.id, args.active_minutes)
            _json_output(result) if args.json else _summary_output(result)
            return 0
        if args.command == "evidence":
            result = add_evidence(root, args.task_id, args.path, args.kind, args.label)
            _json_output(result) if args.json else _summary_output(result)
            return 0
        if args.command == "context":
            if args.context_command == "route":
                intent = sys.stdin.read() if args.intent_stdin else args.intent
                result = route_context(root, intent)
            elif args.context_command == "prepare":
                result = prepare_context_capsule(root, args.task_id, args.target)
            elif args.context_command == "audit":
                result = audit_context_capsule(root, args.capsule_id)
            else:
                result = inspect_context_capsule(root, args.capsule_id)
            _json_output(result)
            return 0
        if args.command == "receipt":
            if args.receipt_command == "scaffold":
                result = scaffold_receipt(root, args.task_id, args.out)
                _json_output(result)
                return 0
            result = validate_receipt(root, args.path)
            _json_output(result)
            return 0 if result["valid"] else 1
        if args.command == "harness":
            if args.harness_command == "render":
                result = harness_render(root, args.task_id, args.target)
            elif args.harness_command == "validate":
                result = harness_validate_path(root, args.path, args.kind)
            else:
                result = harness_inspect(root, args.task_id)
            _json_output(result)
            if args.harness_command == "validate":
                return 0 if result["valid"] else 1
            return 0
        if args.command == "approval":
            if args.blueprint_command == "record":
                result = record_blueprint_approval(root, args.file)
            else:
                result = audit_blueprint_approval(root, args.file)
            _json_output(result)
            return 0 if result.get("valid", True) else 1
        if args.command == "checkpoint":
            result = create_checkpoint(root, args.phase, args.task_id, args.target)
            _json_output(result)
            return 0
        if args.command == "capability":
            result = list_capabilities(root, args.stage, args.available_only)
            _json_output(result) if args.json else _capability_summary_output(result)
            return 0
        if args.command == "recommend":
            if args.recommend_command == "refresh":
                result = refresh_recommendations(root)
            elif args.recommend_command == "list":
                result = load_capability_state(root, allow_missing=False)
            elif args.recommend_command == "move":
                relation = "before" if args.before else "after"
                result = move_recommendation(root, args.id, args.before or args.after, relation)
            else:
                placement = args.placement if args.recommend_command == "todo" else None
                task_id = args.task_id if args.recommend_command == "done" else None
                result = transition_recommendation(root, args.id, args.recommend_command, placement, task_id)
            _json_output(result) if args.json else _recommendation_summary_output(result)
            return 0
        if args.command == "knowledge":
            if args.knowledge_command == "index":
                result = knowledge_reindex(root)
            elif args.knowledge_command == "search":
                intent = sys.stdin.read() if args.intent_stdin else args.query
                result = knowledge_search(root, intent)
            else:
                result = knowledge_list(root)
            _json_output(result) if args.json else _knowledge_summary_output(result, args.knowledge_command)
            return 0
        if args.command == "skills":
            result = skills_inventory(root) if args.skills_command == "list" else skills_health(root)
            _json_output(result) if args.json else _skills_summary_output(result)
            return 0 if result.get("ok", True) else 1
        if args.command == "session":
            result = session_start(root) if args.session_command == "start" else session_finish(root)
            _json_output(result) if args.json else _session_summary_output(result, args.session_command)
            return 0
        if args.command == "features":
            if args.features_command == "add":
                result = features_add(root, args.feature, args.screens, args.analytics, args.namespace, args.since)
            elif args.features_command == "check":
                result = features_check(root)
            else:
                result = features_list(root)
            _json_output(result) if args.json else _features_summary_output(result)
            return 0
        result = load_state(root)
        _json_output(result) if args.json else _summary_output(result)
        return 0
    except FactoryError as exc:
        sys.stderr.write("factoryctl: %s\n" % exc)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
