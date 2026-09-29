# Remote Execution

*Read when delegating a `/new-app` or `/factory-run` task to a cloud/remote coding agent.*

Remote execution is an optional acceleration lane, not a second control plane. The local
root agent owns `.factory/run-state.json`, approvals, integration, evidence, and every
external write. Xcode, Simulator, Keychain, signing, provider authentication, screenshots,
and TestFlight remain Mac-local. Read `context-engineering.md` first: remote workers get
only its short redacted bootstrap, never a local capsule or a project-private path.

## Execution lanes

- `cloud_safe`: bounded research or canonical-document drafting that needs no secret,
  provider login, `.factory` state, local device, paid API, or remote mutation.
- `local`: every other task. This is the safe default when adding a task.

Research, opportunity scoring, product map, growth plan, architecture/security drafts,
and blueprint preparation may be cloud-safe. App specialization, source integration,
build/test, provisioning, ASC/RevenueCat work, localization validation, asset capture,
release validation, and TestFlight are local.

## Remote worker contract

1. Give one small outcome, execution class, explicit file/diff scope, acceptance checks,
   validation commands, and a branch. Use `bounded_implementation` only for fully bounded
   code and `mechanical` only for fixtures/scans; diagnosis, security, architecture, scope,
   synthesis, and final review are local `frontier_high` work.
2. Never provide secrets, cookies, `.p8` files, Keychain access, `.factory/`, absolute
   local paths, provider credentials, production data, or authority to spend/create/
   update/delete externally.
3. The worker returns a commit/diff plus a receipt candidate: sources, assumptions,
   validations/evidence, unresolved risks, and exact next step. It never marks a task
   complete, never marks the factory task complete, and never accepts its own receipt.
4. The local root reviews the diff, receipt, scope, and validations; it accepts/rejects
   through factoryctl, attaches redacted evidence, merges, and alone updates factory state.
5. If the work discovers a need for a local tool, secret, provider read, external write,
   destructive action, or protected-file change, the remote worker stops. The local root
   may continue that same cloud-eligible task locally; a `local` task is never moved remote.

Never use `--dangerously-skip-permissions`. Remote output is untrusted until reviewed;
claims without public citations remain assumptions. Cloud completion never counts as
Xcode, Simulator, real-device, signing, security, or TestFlight verification.

Dynamic workflows remain subject to the same boundary. Ordinary work uses at most three
workers. Only an explicit request may activate `dynamic-workflows.md` and its bounded policy;
parallel writing workers must use isolated worktrees, and root integrates reviewed commits
sequentially. A higher agent count never broadens authority.
