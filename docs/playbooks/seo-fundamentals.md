# SEO Fundamentals

*Read when: learning or teaching the vocabulary behind organic search — the crawl/index/rank model, intent, SERP reading, keyword research, and keyword placement. Companion to `docs/playbooks/seo-content.md`, which owns implementation for a many-page site.*

This is a curriculum, not a checklist. Implementation lives in `docs/playbooks/seo-content.md`;
the channel is scored in `docs/growth-plan.md`. Rankings are `unknown` until Search Console
shows impressions. Never model traffic from a keyword-volume estimate, and label every estimate
as an estimate (`docs/playbooks/product-strategy.md` labeling rule).

## 1. How Google works

Three distinct stages, in order. A page can pass one and fail the next.

| Stage | What happens | Typical failure |
|---|---|---|
| Crawl | Googlebot fetches the URL | blocked, orphaned, no internal link |
| Index | Parsed, stored, eligible to appear | `noindex`, canonicalized elsewhere, thin/duplicate |
| Ranking | Ordered against others for a query | outranked by a better-matching page |

- Crawling is discovery plus fetching. An orphan page with no internal link path is rarely found.
- Site architecture and internal linking decide what gets crawled and how authority flows.
- Not every crawled page is indexed: `noindex`, a canonical pointing elsewhere, weak content, duplicate or thin pages, and simple newness all keep a page out.
- "Crawled" and "indexed" are not the same claim. Never call a page ranking-eligible just because it was fetched.

## 2. Indexing status

The two common "not indexed" reasons differ:

| Status | Meaning |
|---|---|
| `Discovered - currently not indexed` | Google knows the URL but has not fetched/processed it yet |
| `Crawled - currently not indexed` | Google fetched it and chose not to index it — usually quality, duplication, or canonical |

- URL Inspection in Search Console is the canonical check for one URL.
- `site:` is only a fast, approximate signal; it is not an index count.
- Observed case: an aggressive sitemap cache (long TTL / stale `lastmod`) delayed indexing on a fast-publishing site; new URLs were not announced promptly. Sitemap freshness matters when publishing cadence is high.

## 3. Ranking

Google weighs many signals together; no single metric is the lever.

- Wrong question: "which metric is higher than my competitor's?"
- Right question: "why does Google rank the competitor above me for this query?"
- Loop: observe the SERP → form a hypothesis → apply one change → measure in Search Console.

## 4. Search intent

| Intent | The searcher wants | Typical shape |
|---|---|---|
| Informational | to learn | how-to, guide |
| Navigational | a specific site or page | brand + login |
| Commercial | to compare before buying | best X, X vs Y |
| Transactional | to act or buy now | buy, price, download |

- One keyword can carry more than one intent.
- Intent changes over time; pre-launch and post-launch queries for the same product differ.
- Never answer the wrong intent and then blame page quality. Match the intent first.

## 5. SERP analysis

Read the results page as Google's interpretation of the query. Before writing, record:

- Page **types** ranking: home, category, product, article, forum, video.
- Content **formats**: "top 10" list, how-to, comparison, Q&A, video.
- **Freshness**: are the top results old or recent?
- **Who ranks**: small focused sites can beat big brands on a specific query.
- **SERP features** present: images, videos, maps, shopping, featured snippet, People Also Ask.
- **Ads vs organic**: the paid block is not the organic result.

## 6. Search operators

Free signals from Google search itself:

| Operator | Action | Example |
|---|---|---|
| `"..."` | exact phrase | `"invoice generator"` |
| `-` | exclude a term | `seo -agency` |
| `site:` | limit to a site | `site:example.com` |
| `filetype:` | narrow to a file type | `filetype:pdf invoice` |
| `before:` / `after:` | date range | `after:2024-01-01` |
| `inurl:` | term in the URL | `inurl:login` |
| `intitle:` | term in the title | `intitle:"seo guide"` |

- Combine them for competitor and content-gap research, e.g. `site:competitor.com intitle:guide`.
- These give quick signals, not a definitive index count. Use Search Console for that.

## 7. Keyword research

- A **keyword** is the researched term; a **search query** is what a user actually typed.
- Users' words differ from the business's words, and differ by country/locale. Never just translate a keyword list.
- One page can target a cluster of related queries; do not force one query per page.
- Volume is an estimate and differs by tool. Label it.
- Low volume can be higher-value: a B2B query with few daily visitors can still drive high-ticket sales.
- Check seasonality with Google Trends.
- Evaluate volume for the target country, not the tool's default.
- Do not naively sum near-synonyms; they overlap.

## 8. Keyword difficulty

- KD is a tool-computed estimate, not a number Google provides.
- Each tool computes it differently; numbers are not comparable across tools.
- High KD does not always mean "don't try" — a niche sub-term can be winnable.
- Low KD does not always mean easy — the SERP may still be strong.
- KD never decides. Judge volume + intent + KD + the real SERP together.

## 9. Finding ideas for free from Google

- Google Autocomplete: what users type as they type.
- People Also Ask: adjacent questions on the results page.
- Related Searches: neighbours at the bottom of the SERP.
- These surface long-tail queries users already google.
- Not every suggestion becomes a page; most are evidence, not a backlog.

## 10. Placing keywords

- Keyword mapping: one intent per page.
- One page or a new page? Test: would the same searcher be satisfied on one page? If yes, keep one page.
- Build topic clusters: a hub page plus supporting pages, linked both ways.
- Find content gaps against competitors with the operators in section 6.
- Internal links carry the structure; every page links up to its hub and sideways to siblings.
- The output of keyword research is site architecture, not a spreadsheet.
