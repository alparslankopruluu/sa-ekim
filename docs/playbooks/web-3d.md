# Web 3D, Three.js, and browser games

*Read when the product needs a real-time 3D scene, WebGL/WebGPU rendering, a browser
game, or a 3D product configurator — via `/web-3d` or when routing selects `web-3d`.*

For a full browser-game build, `docs/playbooks/game-dev.md` owns the game build loop; this playbook owns the render stack and skill packs.

The kit's product and security contracts are authoritative. External Three.js skills are
focused implementation experts; they never expand scope, approve dependencies, perform
provider writes, or publish.

## When 3D earns its place

3D is a feature, not decoration. Legitimate uses: a landing-page hero that demonstrates
the actual product, a 3D product configurator, a playable marketing game, or data made
legible only in three dimensions. If a static render or a screen recording tells the same
story, ship that instead — it is faster, cheaper, offline-safe, and reviewable. Before
committing, pass the mobile-first gate: the experience must hold its frame budget on a
mid-range phone GPU, not only on the development machine. Never gate core product value
behind WebGL/WebGPU support; provide a static fallback.

## Curated skill packs

Three audited upstream packs cover this domain. Classify the job first, then install only
the smallest matching subset per the install doctrine below.

### Scene, materials, and effects work

Source `CloudAI-X/threejs-skills` (MIT), audited commit
`b1c623076c661fc9b03dac19292e825a5d106823`. Ten focused skills mirror the official
Three.js documentation areas (r160+, `three/addons/` import paths).
Scene subset: `threejs-fundamentals`, `threejs-geometry`, `threejs-materials`,
`threejs-lighting`, `threejs-textures`, `threejs-animation`, `threejs-loaders`,
`threejs-shaders`, `threejs-postprocessing`, `threejs-interaction`.
Pick per task: scene/camera/renderer setup → fundamentals; meshes and instancing →
geometry + materials; GLTF/Draco loading → loaders; custom GLSL → shaders; bloom/DOF →
postprocessing; raycasting/controls → interaction.

### Complete browser game

Source `majidmanzarpour/threejs-game-skills` (MIT), audited commit
`7221c1f4a6d2ae189a4d85d058d24f3228499d46`. The entry point is `threejs-game-director`,
which routes the specialist skills itself — never ask the user to choose one.
Game subset: `threejs-game-director`, `threejs-gameplay-systems`,
`threejs-aaa-graphics-builder`, `threejs-game-ui-designer`, `threejs-debug-profiler`,
`threejs-qa-release`, `threejs-3d-generator`, `threejs-image-generator`,
`threejs-audio-generator`.
The pack ships a Vite + TypeScript scaffold with deterministic test hooks, a seeded RNG,
Playwright smoke/visual-regression/bot-playtest templates, and a canvas-inspection
script — use them as the QA harness instead of inventing one.

### WebGPU renderer and TSL

Source `dgreenheck/webgpu-claude-skill` (MIT), audited commit
`af2319bd01bb7cc881267a9ef42cafdaf5e9029d`.
WebGPU subset: `webgpu-threejs-tsl`.
Never install a pack outside the classified subset. This skill exists because TSL and
the WebGPU renderer churn across Three.js releases (imports moved to `three/tsl`,
r171/r178/r183 renames), so model training data is stale; treat the pinned skill as the
current-API source of truth for node materials, compute shaders, and `wgslFn()` work,
and verify against current Three.js release notes when the pin ages.

## Install doctrine

Follow `docs/playbooks/skill-discovery.md` exactly: approval of the exact source, skill,
and destination before any install; prefer project-local; never install with `-g` — the
upstream game-pack README suggests `-g -y`, and the kit doctrine overrides it. Install
each approved skill with the subset form, for example:

```bash
npx skills add CloudAI-X/threejs-skills --skill threejs-fundamentals
```

Record source/revision for each installed skill in the operator report. If an upstream
HEAD no longer matches the audited commit above, stop for review before installing;
`scripts/check_pins.py` reports drift.

## Asset generation keys (optional)

`TRIPO_API_KEY` (Tripo text/image-to-3D models), `GEMINI_API_KEY` (concept/texture
images), and `ELEVENLABS_API_KEY` (SFX/ambience/voice) power the game pack's optional
generator skills. They follow the paid-API rule in `docs/checklists/security.md`: keys
live only in a trusted server/Function or the developer workstation shell — never in
client bundles, committed `.env*`, `EXPO_PUBLIC_*`, or Vite client env. A missing key
downgrades to procedural or placeholder assets and never blocks the build.

## Evidence expectations

3D work claims completion only with: a passing production build; a local browser run
with a clean console; a screenshot during active interaction (not an idle first frame);
a canvas non-blank-pixel check with measured metrics; a mobile-viewport pass; an
interaction check on the main control path; and a performance snapshot against the
frame budget (draw calls, triangle count, texture memory) from
`docs/checklists/performance.md` thinking applied to the GPU. Games additionally verify
seeded-RNG determinism and run the pack's bot-playtest before any release-ready claim.
Premium visual claims need active-play evidence, never a static placeholder scene.

## Automation split

| Agent automates | Human does |
|---|---|
| Job classification, subset install after approval, scaffold/build, scene and gameplay code, QA harness runs, screenshots, canvas/perf metrics, drift checks | Approves each skill install, provides optional generator keys in their own shell/console, approves new dependencies, judges final visual quality |
