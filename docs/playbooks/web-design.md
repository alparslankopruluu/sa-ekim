# Web design — page craft that does not look generated

*Read when building or restyling any web page, landing page, or marketing surface — via `/web-design` or when routing selects `web-design`.*

`docs/playbooks/design.md` owns native screens (HIG, Liquid Glass, thumb-zone, 44pt). This
document owns the web. `docs/playbooks/web-3d.md` owns Three.js/WebGPU; page craft is here.
The stack contract is `docs/stack/web.md`.

## The subject principle

Generated web design has a recognizable smell because models reach for the same defaults
regardless of brief. The fix is not "more taste" — it is grounding every choice in the
actual domain. **The subject's own world — its materials, instruments, artifacts, and
vernacular — is where distinctive choices come from.** A page about used-car inspection
draws from micron gauges, inspection diagrams, and workshop vocabulary; a page about
woodworking draws from timber, jigs, and joinery. If the brief has no direction, define the
concrete subject, audience, and job before touching a color.

## Forbidden defaults

These three are the recognizable generated-design signatures. Each is legitimate for *some*
brief, but reaching for one without a subject-grounded reason means it is a default rather
than a choice — and the kit treats it as a defect:

1. Warm cream background (`#F4F1EA`) with a serif display face and a terracotta accent.
2. Near-black background with a single acid-green or vermilion highlight.
3. Broadsheet layout — hairline rules, zero border-radius, dense justified columns.

Also banned by the same logic: stock gradient-orb hero backgrounds, unexplained glassmorphism,
and a "3 feature cards with generic line icons" section that no reader asked for.

## Two-pass workflow

Never build on the first idea.

1. **Plan.** Write the token system before any markup: 4–6 named hex values with the domain
   reason for each, a display and a body typeface chosen deliberately (not a system default),
   the spacing/type scale, and **one signature element** the page will be remembered by.
2. **Critique.** Test the plan against the brief and revise anything that reads as a default
   rather than a choice made for *this* project. Name what you changed and why. Only then build.

Record the resulting direction in the app's design docs so later pages stay consistent.

## Web layout doctrine

Rules `design.md` does not cover because they do not exist on a phone:

- **Breakpoints are content-driven**, not device-driven: add one where the layout actually breaks. Verify 360, 768, 1280, and 1680 minimum.
- **Desktop earns density.** A phone layout stretched to 1440px with one column of centered text is a wasted viewport; use the width for comparison, reference, and navigation.
- **Keyboard is a first-class input.** Every interactive element reachable by Tab in DOM order, a visible focus ring that is not the browser default, a skip link, and no focus trap outside a modal.
- **Hover is an enhancement, never the only affordance** — it does not exist on touch.
- **Type scale:** set a modular scale and use `clamp()` for fluid headings; body text 16px minimum, measure 60–75 characters.
- **Numeric data uses tabular figures** (`font-variant-numeric: tabular-nums`) so columns of measurements, prices, and dates align.
- **Motion is orchestrated, not sprinkled**: a few purposeful moments beat effects on every element, and everything respects `prefers-reduced-motion`.

## Curated skill packs

Two audited upstream sources. Classify the job, then install only the smallest matching subset
per the install doctrine below.

### Anti-generic design discipline

Source `anthropics/claude-plugins-official` (Apache-2.0), audited commit
`f8f7402b0ff3b88bf311d2efedeb6aad5841d0bb`.
Design skill: `frontend-design`.
Install it before any new page or restyle; it carries the fuller version of the doctrine above.

### Page craft and motion technique

Source `MengTo/Skills` (MIT), audited commit
`22bacc4c4b5094001462d639df553a49a7642770`.
Craft subset: `landing-page`, `pricing-page`, `build-awwwards-quality-sites`,
`animation-systems`, `animation-on-scroll`, `gsap`, `tailwindcss`.
Style presets are not installed — see the exclusion rule below.

**Why only this subset.** The upstream library also ships ~70 named *look* skills
(beige light mode, orange paper SaaS, dark glass, purple tech, and so on). Those are prefab
appearances — exactly the "default rather than a choice" failure this playbook exists to
prevent. Installing one would hand the product someone else's brief. The craft skills teach
page architecture, motion systems, and CSS technique that survive any visual direction; the
look skills do not. Do not install them, and do not copy a look wholesale from a reference site.

**Reference-only sources.** `MengTo/kage` grants no license for reuse or redistribution of its
code or artwork. Study it for how a scroll-driven world is structured; never vendor, copy, or
adapt its files.

## Install doctrine

Follow `docs/playbooks/skill-discovery.md` exactly: approval of the exact source, skill, and
destination before any install; prefer project-local; never install with `-g`; record
source/revision for each installed skill in the report. If an upstream HEAD no longer matches
the audited commit above, stop for review before installing — `scripts/check_pins.py` reports drift.

```bash
npx skills add MengTo/Skills --skill landing-page
```

## Evidence expectations

A page is not done on a screenshot of the hero. Required: production build passes; clean
browser console; full-page screenshot at 360 and 1280; a keyboard-only pass through the primary
flow; Core Web Vitals and WCAG numbers from the "Web" sections of
`docs/checklists/performance.md` and `docs/checklists/accessibility.md`; and a written answer to
"which choice here is grounded in the subject, and which is a default?" for the palette,
the typefaces, and the signature element. Copy is material: it is reviewed with the layout,
in active voice, specific, and never invents a testimonial, rating, award, or metric.

## Automation split

| Agent automates | Human does |
|---|---|
| Subject research, token plan and critique pass, subset install after approval, markup/styles/motion, responsive and keyboard passes, CWV and a11y measurement, screenshots | Approves each skill install, approves new dependencies, supplies real brand assets and proof, judges final visual quality |
