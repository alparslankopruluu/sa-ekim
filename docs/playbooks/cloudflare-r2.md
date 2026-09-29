# Cloudflare R2

*Read this when: factory mode provisions R2 buckets, a public asset Worker, or deploys store/landing media.*

Factory mode provisions R2 for every app. R2 owns public, cacheable landing/store
assets; Firebase Storage remains the owner of private user files. Never put user PII,
private uploads, backups, credentials, or entitlement data in the public R2 path.

## Fixed resource model

- Buckets: `{slug}-dev-assets`, `{slug}-prod-assets`.
- Worker: `{slug}-assets` with separate dev/prod bindings or environments.
- Object keys: `public/<release>/<locale>/<asset>`; immutable release paths are
  preferred over overwrites.
- The mobile/web client receives only HTTPS read URLs. It never receives an R2 API
  token, S3 credential, write URL, delete URL, or unrestricted presigned URL.

## Setup and approval

1. `/factory-setup` verifies `wrangler --version` and `wrangler whoami`. The operator
   profile stores only the Cloudflare account ID; auth remains in Wrangler/OS storage.
2. Before blueprint approval, list buckets and Workers read-only. Include exact proposed
   names, routes/custom domains, and environments in the blueprint.
3. After approval, create only missing exact-name resources. Existing names are reused
   only after account, binding, and policy readback match; otherwise block.
4. Production Worker deploy/domain changes require the blueprint to name the target.
   Unexpected routes, custom domains, or existing Worker changes need new approval.

Use `wrangler --help` and subcommand help as the source of truth; Wrangler changes
faster than this template. Prefer machine-readable output where supported.

## Agent documentation and MCP policy

Cloudflare publishes an official agent bootstrap prompt at
[`developers.cloudflare.com/agent-setup/prompt.md`](https://developers.cloudflare.com/agent-setup/prompt.md).
Re-check that URL before changing any agent configuration; the commands are upstream
operational instructions, not content to copy wholesale into an app.

Wrangler remains the factory's required, auditable execution path. Agent integrations
are optional **user-level workstation tools** and are never vendored into this kit or a
generated project:

- `cloudflare-docs` (`https://docs.mcp.cloudflare.com/mcp`) is the preferred optional
  read-only source for current product/API guidance and requires no authentication.
- `cloudflare`, `cloudflare-bindings`, `cloudflare-builds`, and
  `cloudflare-observability` use OAuth and may expose account state or mutations. Add
  only the server needed for an approved task; OAuth does not expand blueprint or
  production-write authority.
- For Claude Code, use Cloudflare's official marketplace/plugin flow if the operator
  explicitly opts in, then reload plugins. For Codex, use `codex mcp add` with the exact
  upstream URLs and authenticate through `codex mcp login cloudflare`; never paste a
  token into config, prompts, logs, or project files.
- Do not run the upstream global `--skill '*'` installation by default. The factory
  favors task-scoped discovery to protect context/token budgets. Audit upstream skills
  before selecting any, and keep them outside generated apps.

`/factory-setup` reports these integrations as optional. Missing MCPs do not block a run
when Wrangler help and official web documentation are available. Configuration changes
must show the exact user-level diff and require explicit operator approval.

## Worker contract

The Worker exposes `GET` and `HEAD` only:

- allowlisted public prefix;
- strict key normalization and traversal rejection;
- correct content type, ETag, content length, and single byte-range behavior; malformed,
  multi-range, or unsatisfiable requests return `416` without reading the body;
- immutable cache headers for versioned assets;
- explicit 404/405 responses with no bucket enumeration or internal error details;
- CORS may use `*` only for these public, noncredentialed assets; narrow it to approved
  landing/admin origins when the blueprint requires an origin allowlist, and never combine
  `*` with credentials.

There is no client write endpoint. Asset upload happens from the trusted local/CI
operator through Wrangler/S3 tooling, followed by an object metadata/readback check.

## Verification

- Confirm both bucket IDs/names and Worker bindings by readback.
- Test `GET`, `HEAD`, missing key, traversal attempt, disallowed method, range, cache,
  content type, and CORS.
- Scan Worker source/state/evidence for credentials and account tokens.
- Verify Firebase Storage rules still protect private user files.
- Store release asset evidence by object key, size, checksum/ETag, environment, and URL;
  never store signed headers or credentials.

## Failure and deletion policy

Retry only read operations and clearly transient idempotent uploads. On name collision,
binding mismatch, auth failure, billing/plan requirement, or unexpected existing data,
record a human action and stop that dependency. Factory mode never deletes buckets,
objects, Workers, routes, or custom domains and never makes a bucket broadly public.

Primary sources: [R2 bucket management](https://developers.cloudflare.com/r2/buckets/create-buckets/),
[R2 Worker bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[Cloudflare agent setup](https://developers.cloudflare.com/agent-setup/prompt.md).
