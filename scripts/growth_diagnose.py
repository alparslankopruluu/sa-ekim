#!/usr/bin/env python3
"""Pure, aggregate-only funnel comparison for app-factory growth-loop."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Mapping, Optional, Sequence, Tuple


STAGES: Dict[str, Tuple[str, str]] = {
    "impression_to_page": ("product_page_views", "impressions"),
    "page_to_download": ("downloads", "product_page_views"),
    "download_to_activation": ("activations", "downloads"),
    "paywall_to_trial": ("trials", "paywall_views"),
    "trial_to_paid": ("trial_paid", "trials"),
    "d1_retention": ("d1_retained", "d1_eligible"),
    "d7_retention": ("d7_retained", "d7_eligible"),
}
RETENTION_STAGES = {"d1_retention", "d7_retention"}
ACQUISITION_STAGES = {"impression_to_page", "page_to_download", "download_to_activation"}


class GrowthError(ValueError):
    pass


def _count(period: Mapping[str, object], key: str) -> Optional[int]:
    value = period.get(key)
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise GrowthError(f"{key} must be a non-negative integer or null")
    return value


def _rate(period: Mapping[str, object], numerator: str, denominator: str) -> Optional[float]:
    top = _count(period, numerator)
    bottom = _count(period, denominator)
    if top is None or bottom in (None, 0):
        return None
    if top > bottom:
        raise GrowthError(f"{numerator} cannot exceed {denominator}")
    return top / bottom


def sufficient(pair: Mapping[str, object]) -> bool:
    for label in ("current", "previous"):
        period = pair.get(label)
        if not isinstance(period, Mapping):
            return False
        downloads = _count(period, "downloads")
        paywalls = _count(period, "paywall_views")
        if downloads is None or downloads < 100 or paywalls is None or paywalls < 20:
            return False
    return True


def choose_window(payload: Mapping[str, object], requested: str) -> Tuple[str, Mapping[str, object]]:
    windows = payload.get("windows")
    if not isinstance(windows, Mapping):
        raise GrowthError("windows must be an object containing 7d and/or 28d")
    if requested in ("7d", "28d"):
        pair = windows.get(requested)
        if not isinstance(pair, Mapping):
            raise GrowthError(f"missing requested window: {requested}")
        return requested, pair
    if requested != "auto":
        raise GrowthError("window must be auto, 7d, or 28d")
    seven = windows.get("7d")
    if isinstance(seven, Mapping) and sufficient(seven):
        return "7d", seven
    twenty_eight = windows.get("28d")
    if not isinstance(twenty_eight, Mapping):
        raise GrowthError("auto requires 28d data when 7d is missing/insufficient")
    return "28d", twenty_eight


def diagnose(payload: Mapping[str, object], requested: str = "auto") -> dict:
    window, pair = choose_window(payload, requested)
    current = pair.get("current")
    previous = pair.get("previous")
    if not isinstance(current, Mapping) or not isinstance(previous, Mapping):
        raise GrowthError("each window requires current and previous objects")

    quality = payload.get("quality", {})
    if not isinstance(quality, Mapping):
        raise GrowthError("quality must be an object")
    blockers = []
    if quality.get("trackingValid") is not True:
        blockers.append("tracking_unverified_or_invalid")
    if quality.get("cohortsComparable") is not True:
        blockers.append("cohorts_unverified_or_not_comparable")
    if quality.get("overlappingExperiment") is not False:
        blockers.append("experiment_overlap_unverified_or_active")

    stages = {}
    regressions = []
    for name, (numerator, denominator) in STAGES.items():
        current_rate = _rate(current, numerator, denominator)
        previous_rate = _rate(previous, numerator, denominator)
        relative_change = None
        if current_rate is not None and previous_rate not in (None, 0):
            relative_change = (current_rate - previous_rate) / previous_rate
            if relative_change < 0:
                regressions.append((relative_change, name))
        stages[name] = {
            "current": current_rate,
            "previous": previous_rate,
            "relativeChange": relative_change,
        }

    is_sufficient = sufficient(pair)
    if blockers:
        status = "measurement_repair"
        bottleneck = None
    elif not is_sufficient:
        status = "insufficient_sample"
        bottleneck = None
    elif regressions:
        status = "bottleneck_verified"
        # Retention is the single most important growth ingredient: a verified
        # D1/D7 retention regression outranks acquisition-stage regressions
        # regardless of magnitude (fixing acquisition while retention leaks is
        # the classic wasted year). Monetization stages still compete on size.
        if any(name in RETENTION_STAGES for _, name in regressions):
            candidates = [
                item for item in regressions if item[1] not in ACQUISITION_STAGES
            ]
        else:
            candidates = regressions
        bottleneck = min(candidates)[1]
    else:
        status = "no_verified_regression"
        bottleneck = None

    return {
        "window": window,
        "sufficient": is_sufficient,
        "status": status,
        "blockers": blockers,
        "verifiedBottleneck": bottleneck,
        "stages": stages,
    }


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    root.add_argument("input", type=Path, help="aggregate JSON with current/previous windows")
    root.add_argument("--window", choices=("auto", "7d", "28d"), default="auto")
    return root


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        payload = json.loads(args.input.read_text())
        if not isinstance(payload, Mapping):
            raise GrowthError("input root must be an object")
        print(json.dumps(diagnose(payload, args.window), indent=2, sort_keys=True))
    except (OSError, json.JSONDecodeError, GrowthError) as exc:
        print(f"growth_diagnose: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
