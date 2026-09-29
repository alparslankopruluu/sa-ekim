# Browser game development

*Read when: building or extending a playable browser game — `docs/playbooks/web-3d.md`
owns the renderer, skill packs, and asset-generation keys; this playbook owns the game
build loop.*

## 1. Start from the experience

Describe what the player must be able to do in plain language before naming an
architecture, and state the constraints the experience imposes. For a solar-system
explorer those constraints were "everything visible is reachable" and "real distances made
playable through speed and scale."

- Write the player-facing capability list first.
- Let the agent propose the architecture under those constraints, then review the proposal
  against the experience — not against novelty.
- A domain model chosen before the experience is a guess; expect to revise it.

## 2. Lock the look before building much

- Use image generation for concept art, then iterate against explicit rejection criteria:
  "too realistic / too simplistic" until the middle ground reads right.
- Save approved images as visual references, one per state the player sees — orbital,
  flight, atmospheric entry, landing.
- The references are contracts: later modeling, materials, and UI are judged against them,
  not against taste in the moment.

## 3. Give the agent a way to inspect and play

Expose a small JavaScript state interface the agent can read from the console or a test:

| Read | Purpose |
|---|---|
| Current body / flight mode | Where the player is and which rules apply |
| Terrain readiness | Whether collision and hazard data exist yet |
| Camera / controls state | What the player is actually driving |
| Draw calls / triangles | Frame cost at the point of interest |
| Queued jobs | Whether a stall is loading or simulation |

- Provide named deterministic test scenes, not one free-play default.
- Browser tests must drive the real controls and record positions and state; a screenshot
  alone hides collision-not-ready and teleport bugs.
- Keep the task frame lean per `docs/playbooks/context-engineering.md`; feed the agent the
  failing state, not the whole log.

## 4. Represent the universe at several scales

- Use large integer cells plus local offsets; subtract the observer position before
  rendering so float precision survives the scale.
- Evaluate analytic orbits at the same simulation time so positions agree across systems.
- Share one terrain-sampling function between coarse and fine meshes; two samplers drift.

## 5. Make transitions continuous

- Use LOD/quadtree terrain; keep the distant proxy until all coarse faces are ready, and
  keep a tile until its children are ready.
- Blend the handoff with complementary pixel masks so neither level pops.
- Let atmosphere and clouds bridge the orbital-to-ground gap.
- Landing requires visible ground, collision, and hazard data produced by the same
  generation and ready together; one without the others is a fall-through bug.

## 6. Measure the work behind a slow frame

Instrument before optimizing, and separate loading policy from frame rate:

- Draw calls, triangles, geometries, and textures.
- 90-frame interval percentiles rather than a single average; compare before and after.
- Pixel-diff with an effect on and off.
- Count discarded terrain jobs — churn is work even when it is not rendered.

State plainly that these are test-environment numbers, not GPU frame-rate benchmarks. Apply
`docs/checklists/performance.md` to the frame budget.

## 7. Turn concept art into assets

- Generate reference views (front and rear) and pick the approved silhouette before
  modeling.
- Build or import the authored 3D asset against that silhouette.
- Keep exported triangle and material budgets under control; an asset that fits the look
  but not the budget is not finished.

## 8. Procedural environment, authored vehicle

Keep the world procedural and the hero asset authored. One shared wave/water model can
drive both the visuals and the physics — buoyancy and combat — so the two never disagree.

## 9. State the limits honestly

Heightfields cannot represent caves, overhangs, or destructible tunnels. Say so before
someone builds a feature on the assumption that they can; an honest boundary is cheaper
than a promised feature that cannot ship.

## 10. Sharing

Static/browser deployment is enough to share a small game; publishing and store approval
stay gated behind the kit's normal approval path. Do not imply a release commitment from a
playable build.
