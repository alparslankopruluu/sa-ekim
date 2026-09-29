# Product Map — {{APP_NAME}}

*Canonical owner for planned user journeys, screen inventory, UI states, and testable acceptance criteria. Keep it compact; implementation detail belongs in code and architecture.*

## Core job and loop

- **Job to be done:** {{USER_JOB}}
- **Trigger → action → result → repeat:** {{CORE_LOOP}}
- **Activation moment:** {{ACTIVATION_MOMENT}}
- **Gotcha/billboard screen:** {{GOTCHA_SCREEN}} <!-- the one screen designed to be watched inside someone else's phone video; see docs/playbooks/product-strategy.md -->
- **Real-device quality proof:** {{DEVICE_PROOF}}

## Journey

```text
{{PRIMARY_JOURNEY}}
```

## Screen inventory

| Screen / route | User value | Entry → exit | Primary action | Required states | Motion / feedback | Analytics | Accessibility | Acceptance evidence |
|---|---|---|---|---|---|---|---|---|
| {{SCREEN}} | {{VALUE}} | {{ENTRY_EXIT}} | {{ACTION}} | loading · empty · error · offline · permission/paywall as applicable | {{MOTION_FEEDBACK}} | {{EVENT}} | {{A11Y}} | {{ACCEPTANCE}} |

Mark exactly one row as the gotcha screen; acquires/retains classification stays at
milestone level (`docs/mvp-plan.md`), not per screen.
Required states must be explicit for every core, onboarding, result, paywall, settings,
and necessary helper screen. Mark a state `N/A` only with a short reason.
Document motion/haptic intent only where it helps feedback or understanding; repeated
actions may explicitly say `instant/subtle`.

## Scope integrity

- Every M1 task maps to a row above and a measurable user outcome.
- Any screen not required by the approved core journey goes to `docs/backlog.md`.
- No mandatory login unless the core value or cross-device ownership requires it.
- Store screenshot claims must map to shipped rows in `docs/features.md` and the uploaded build.
