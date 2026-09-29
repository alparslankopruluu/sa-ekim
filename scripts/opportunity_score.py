#!/usr/bin/env python3
"""Deterministic app-factory opportunity scoring (stdlib only)."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from typing import Dict, Mapping, Sequence


DIMENSIONS: Dict[str, int] = {
    "problem_urgency": 15,
    "retention_potential": 15,
    "monetization": 15,
    "distribution": 15,
    "differentiation": 15,
    "technical_feasibility": 10,
    "trust_review_feasibility": 10,
    "defensibility": 5,
}
CRITICAL_DIMENSIONS = ("monetization", "distribution", "differentiation")


class ScoreError(ValueError):
    pass


@dataclass(frozen=True)
class Evaluation:
    total: int
    decision: str
    reasons: tuple[str, ...]
    scores: Mapping[str, int]

    def as_dict(self) -> dict:
        return {
            "total": self.total,
            "decision": self.decision,
            "reasons": list(self.reasons),
            "scores": dict(self.scores),
            "weights": dict(DIMENSIONS),
        }


def evaluate(scores: Mapping[str, int], critical_risk: bool = False) -> Evaluation:
    if set(scores) != set(DIMENSIONS):
        missing = sorted(set(DIMENSIONS) - set(scores))
        extra = sorted(set(scores) - set(DIMENSIONS))
        raise ScoreError(f"Scores must match dimensions; missing={missing}, extra={extra}")

    normalized: Dict[str, int] = {}
    for name, maximum in DIMENSIONS.items():
        value = scores[name]
        if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= maximum:
            raise ScoreError(f"{name} must be an integer from 0 to {maximum}")
        normalized[name] = value

    total = sum(normalized.values())
    reasons = []
    weak = [name for name in CRITICAL_DIMENSIONS if normalized[name] < 8]
    if critical_risk:
        reasons.append("critical_risk")
    if weak:
        reasons.append("weak_critical_dimension:" + ",".join(weak))

    if critical_risk or weak or total < 60:
        decision = "no_go"
        if total < 60:
            reasons.append("total_below_60")
    elif total < 75:
        decision = "reposition"
        reasons.append("total_below_75")
    else:
        decision = "go"
        reasons.append("go_threshold_met")

    return Evaluation(total, decision, tuple(reasons), normalized)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)
    score = sub.add_parser("score", help="evaluate one evidence-backed opportunity score")
    for name, maximum in DIMENSIONS.items():
        score.add_argument("--" + name.replace("_", "-"), type=int, required=True, metavar=f"0-{maximum}")
    score.add_argument("--critical-risk", action="store_true")
    score.add_argument("--json", action="store_true")
    return root


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        values = {name: getattr(args, name) for name in DIMENSIONS}
        result = evaluate(values, critical_risk=args.critical_risk)
    except ScoreError as exc:
        print(f"opportunity_score: {exc}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(result.as_dict(), indent=2, sort_keys=True))
    else:
        print(f"{result.decision} {result.total}/100 — {', '.join(result.reasons)}")
    return 0 if result.decision == "go" else 3


if __name__ == "__main__":
    raise SystemExit(main())
