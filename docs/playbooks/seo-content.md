# SEO and content architecture

*Read when organic search is a real distribution channel for the product — a content, catalog, Q&A, or tool site — before designing URLs, page templates, or structured data.*

Fundamentals and vocabulary: `docs/playbooks/seo-fundamentals.md` — this document assumes them.

`docs/playbooks/post-launch.md` owns the single marketing landing page and its social card;
that block stays canonical for one-page briefs. This document owns the case where the product
is many indexable pages and search is how users arrive. Rendering rules live in
`docs/stack/web.md`; page craft in `docs/playbooks/web-design.md`.

## Search is a channel, not a checklist

Score it like any other channel in `docs/growth-plan.md`: organic search is slow to start,
compounds, and is not owned — a ranking is borrowed, never a moat. The moat is the
underlying corpus and the tool that uses it. Treat rankings as `unknown` until Search Console
shows impressions; never model traffic from a keyword-volume estimate, and never present an
estimate as evidence (`docs/playbooks/product-strategy.md` labeling rule applies unchanged).

## One page per real query intent

- Every indexable URL answers **one question a real person types**. If two pages would answer the same intent, they are one page.
- A page ships only when it has substance a reader could not get from the title alone. A template filled with three fields is a thin page — it dilutes the whole site, and mass-producing them is the fastest way to lose the corpus's credibility.
- URL slugs are readable, stable, and lowercase; a changed slug ships a 301. Never let a filter combination mint an indexable URL — facets are `noindex` unless a specific combination is itself a real intent.
- Internal links are the site's spine: every page links up to its category and sideways to its 3–5 nearest siblings. Orphan pages do not get crawled.
- Canonical on every page. Paginated and parameterized variants point at the canonical.

## Indexability

- Primary content is present in the server-rendered HTML. A page whose body arrives from a client fetch is a page search engines may never see — see the rendering rule in `docs/stack/web.md`.
- `sitemap.xml` is generated from the same source of truth as the routes, not hand-maintained. `robots.txt` blocks admin, API, and preview surfaces only.
- Turkish-first products declare `lang="tr"`; add `hreflang` only when a second locale genuinely exists and each variant is fully translated — a half-translated variant is worse than none.
- Titles and meta descriptions are written per page, from the page's own content. Never templated to the point of duplication.

## Structured data

Mark up **only facts the page itself proves**. Structured data that claims a rating, price,
availability, author, or review the product cannot substantiate is a truthfulness failure
first and a manual-action risk second — the same rule that governs store metadata in
`docs/playbooks/store-listing.md`.

| Page type | Types |
|---|---|
| Question with community answers | `QAPage` + `Question` + `Answer` (`acceptedAnswer` only when one truly is) |
| Editorial answer to a recurring question | `FAQPage` |
| Any nested page | `BreadcrumbList` |
| Article/guide | `Article` with a real author and dates |
| Catalog entry with a real, verifiable offer | `Product` + `Offer` — never for an estimate |
| The site itself | `Organization` / `WebSite` |

Validate every template with Google's Rich Results Test before it ships, and re-validate when
the template changes.

## Never

Doorway pages, cloaking, keyword-stuffed copy, scraped or wholesale-copied third-party
content, mass-generated pages with no verified substance, fake authors, invented review counts,
hidden text, and paid links. Beyond the policy risk, each one contradicts the kit's evidence
doctrine. Content mined from public sources follows the review-mining method in
`docs/playbooks/product-strategy.md`: extract, resolve, rank, and **cite** — link and date every
source, never copy it wholesale.

## Measurement

Verify Search Console at launch. Track `organic_landing` with entry path, plus the funnel from
landing to the core action (`docs/stack/web.md` taxonomy). Review monthly: impressions,
clicks, and average position by page cluster; pages with impressions but no clicks have a
title/intent mismatch; pages with neither are thin or unlinked. Record what changed and the
next measurement date in `docs/growth-plan.md` — one change at a time, like any experiment.

## Automation split

| Agent automates | Human does |
|---|---|
| IA and URL design, templates, sitemap/robots generation, structured-data implementation and validation, internal-link wiring, copy drafts, Search Console analysis | Verifies Search Console ownership, approves the content corpus and its sources, judges whether a page has real substance, approves any claim marked up as fact |
