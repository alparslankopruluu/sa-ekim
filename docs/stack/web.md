# Stack: Web (Next.js App Router)

*Read this when: every session (via CLAUDE.md §0). Conventions, bans, and commands for this stack. Core-flow quality also follows engineering, performance, and accessibility checklists.*

Page craft and anti-generic design live in `docs/playbooks/web-design.md`; organic search
architecture in `docs/playbooks/seo-content.md`; 3D/WebGL work in `docs/playbooks/web-3d.md`.
They supplement, never replace, this stack contract.

**This document is the framework decision** that `docs/playbooks/post-launch.md` requires
before replacing the default Vite surface. When the product IS the website, the Next.js app
owns `/`, `/support`, `/privacy`, and `/terms`, and `templates/factory-infrastructure/web`
is not rendered — its Functions and R2 worker still are. A mobile-first app that only needs
a marketing/legal site keeps the Vite template and never reads this file.

## Conventions

- Next.js (App Router) + TypeScript `strict: true` + Tailwind. React Server Components are the default; `'use client'` is an opt-in for a leaf that genuinely needs state, effects, or browser APIs.
- **Rendering is a per-route decision, logged in `docs/decisions.md`:** static/ISR for anything that must rank (content, catalog, answers), SSR for per-request or auth-gated pages, client-only for tools that never need indexing. A page that must be indexable never gets its primary content from a client fetch.
- Data access stays in `src/server/` — Server Components and Route Handlers read Firestore through the Admin SDK; the browser SDK is for auth state and realtime only. Never expose a service account to the client bundle.
- State: server state via RSC/`fetch` cache; client state via zustand only where a client island truly needs it. No global store for data a server component can pass down.
- Provider/change boundaries use typed service façades in `src/server/services/`; do not add generic layers without a test/change reason.
- **Reuse rule:** before writing a new component/hook/util, check `src/components`, `src/hooks`, `src/lib`, and the current route's own `_components/`. The moment something is needed by a 2nd route, **promote** it into `src/` — never fork a near-duplicate.

```
src/
├── app/                     # App Router
│   ├── layout.tsx           # root — fonts, tokens, providers; no heavy client init
│   ├── (marketing)/         # static/ISR, indexable
│   ├── (tools)/             # interactive; client islands inside server shells
│   │   └── <tool>/_components/   # components used ONLY by this route
│   ├── api/                 # Route Handlers (server-only secrets live here)
│   ├── sitemap.ts · robots.ts · opengraph-image.tsx
├── components/              # shared, reusable (2+ routes)
├── hooks/ · lib/            # shared hooks / pure helpers, formatters
├── server/
│   ├── firebase-admin.ts    # Admin SDK singleton
│   └── services/            # <domain>.ts, moderation.ts, analytics.ts
├── styles/tokens.css        # design tokens — the token home for this stack
├── messages/tr.json         # tr is the schema — see localization playbook
.env.example                 # committed; real .env* gitignored
```

## Baseline dependencies

`next` · `react` · `typescript` · `tailwindcss` · `firebase` (browser: auth, app-check) + `firebase-admin` (server) · `next-intl` · `zod` (every Route Handler and form validates its input) · `@vercel/og` or `next/og` for social cards. Motion and 3D libraries are added only when `web-design.md` / `web-3d.md` call for them. Anything else: plan approval.

## Auth, App Check, and secrets

- **The mobile ladder does not apply here.** Anonymous-first sign-in and Sign in with Apple exist for App Review 5.1.1/4.8 — there is no App Review on the web. Web default: email link or email+password, phone/OTP where a Turkish audience expects it, plus Google. Ask for an account only at a data-worth-saving moment.
- App Check uses the **reCAPTCHA Enterprise** provider (App Attest is iOS-only). Enforce it on every callable and Route Handler that touches user data or a paid API.
- Account deletion must be reachable from an **Account**-labelled section, not buried under Privacy — the discoverability rule in `docs/checklists/security.md` is a product rule here, not just a store rule.
- Secrets live in server env / Secret Manager. `NEXT_PUBLIC_*` is a public bundle value by definition — never a key.

## Search

Start with Firestore composite indexes plus denormalized lowercase/prefix fields for exact and faceted lookups; that covers filters (make, model, year, city, price) without new infrastructure. Real full-text ranking is a separate, logged decision when a measured query pattern needs it — evaluate Typesense Cloud or Algolia via the Firestore extension, and never ship a client-side scan over a growing collection.

## User-generated content

Any UGC surface ships report/block, a server-side moderation queue, and rate limits **in the same milestone as the surface itself** — not later. State changes happen server-side only; a client never writes a moderation verdict. Rules validate shape (`keys().hasOnly([...])`) and require `serverTimestamp()`, per `docs/playbooks/firebase.md`.

## Analytics taxonomy

The mobile funnel (`onboarding_start` → `paywall_view` → `trial_start`) does not describe a web product. Baseline events: `organic_landing` (with entry path), `search_performed`, `tool_started`, `tool_completed` (the core action), `content_view`, `answer_posted`, `signup_started`, `signup_completed`, `outbound_click`. Name the one `tool_completed` variant that is the core action in PRODUCT.md.

## Forbidden patterns (stack-specific)

```tsx
// ❌ NEXT_PUBLIC_FAL_KEY=…                     → ✅ Route Handler / Function proxy (security S1)
// ❌ 'use client' on an indexable page          → ✅ server component + client island leaf
// ❌ <h1>Ne alıyorum?</h1>                      → ✅ {t('hero.title')} // key in messages/tr.json
// ❌ style={{ padding: 17, color: '#1b7f4a' }}  → ✅ token classes / var(--color-…)
// ❌ dangerouslySetInnerHTML={{__html: userText}} → ✅ sanitize server-side, render as text
// ❌ firebase-admin imported into a client file → ✅ src/server/ only, never in the bundle
// ❌ useEffect(() => fetch('/api/list'))        → ✅ fetch in the server component
// ❌ JSON-LD for a fact the page cannot prove   → ✅ mark up verified facts only (seo-content.md)
// ❌ copy-pasting a near-duplicate component    → ✅ reuse/extend, or promote into src/components
```

## Commands

```bash
npm run dev
npm run build                      # must pass before any deploy
npm run typecheck                  # tsc --noEmit
npm run lint
npm test
npx @lhci/cli autorun              # Core Web Vitals — see performance checklist "Web"
firebase deploy --only hosting,functions   # never bare `firebase deploy`
```

## Testing

- Unit: pure helpers and server services (node:test or vitest), Firestore rules via the emulator suite.
- Route Handlers: schema-rejection cases as well as happy paths.
- The core action gets one end-to-end browser test (Playwright): landing → tool → result, on desktop and a mobile viewport.
- Evidence for a shipped route: build passes, clean browser console, screenshot of the real rendered page, Lighthouse/CWV numbers, and a keyboard-only pass.
