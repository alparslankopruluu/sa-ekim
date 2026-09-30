# Name screen — "Kök" (2026-09-30)

*Risk screen from public web sources only. Not legal clearance: TÜRKPATENT, USPTO, WIPO and TMview
did not return results to automated queries, so a trademark attorney must run a full clearance
before launch.*

## Findings

- **App Store:** the exact name "KÖK" is taken (Shopping app, Turkmenistan retail chain,
  id1637440040). App Store names are unique, so ship as **"Kök: Hair Transplant Tracker"** (or a
  localized equivalent), never bare "Kök".
- **Google Play:** "KÖK" (`com.clearylabs.kok`, shopping) and "Kök" (`com.zihinkodu.kok`, category
  unconfirmed). No Kök/Kok app in health, beauty or hair was found.
- **Closest concept competitor:** "Hair Regrowth – Root" (Health & Fitness).
- **Türkiye legal risk:** clinics say "saç kökü" and advertise "kök hücre" treatments, so a plain
  word mark "KÖK" is likely descriptive in class 44. File a **combined word + logo** mark in
  classes 9, 42, 44 (and 3 if cosmetics ever follow).
- **Existing Kök brands** (Kök Group holding, Kök Projekt accelerator, Grup Kök band) operate
  outside hair/medical apps: low direct confusion, crowded word.

## Language check (launch locales)

| Locale | Note | Risk |
|---|---|---|
| en | The ASCII form "Kok" is read like the vulgar "cock" | **High for "Kok"**, low for "Kök" |
| sv | "kök" = kitchen; search collides with cooking apps | Medium |
| hi | "Koka Shastra" is a known erotic text | Low–medium (uncertain) |
| tr | "root", fits; idioms "kökünü kurutmak" are negative but rare in branding | Low |
| nl / ru / pl / ja / ko / th / fr / id / vi / de / pt-BR / ar / es / it / zh | cook, bun, poke, flavour, faucet, rooster etc.; nothing vulgar confirmed | Low (ar, vi, de, pt-BR: native check) |

## Rules adopted (D-018)

1. The brand always carries the diacritic: **Kök**. "Kok" is never customer-facing in English
   markets (bundle id `com.techtactoe.kok` and URL scheme `kok` stay internal).
2. Store name pattern: `Kök: <descriptive subtitle>` per locale (e.g. "Kök: Hair Transplant
   Tracker", "Kök: Saç Ekimi Takibi").
3. Before the first store submission: attorney clearance for TR, US, EU; Turkish combined mark
   filing; native-speaker check for ar, vi, de, pt-BR, hi.
4. Domains: `getkok.app` did not resolve (likely free, verify at a registrar); `kok.app` and
   `kok.com` are parked for sale; `kokapp.com` appears registered.

## Fallback names if a global single brand is required

| Name | Quick check | Risk |
|---|---|---|
| Rootline | No hair app; "Rootline" plant-care and game apps exist | Medium |
| Graftline | No app; close to GRAFTLIFE (class 3 hair care) | Medium |
| Regrowly | No exact app; "Regrow" space crowded and descriptive | Medium |
| Folliq, Tuftly | Taken | Rejected |

## Sources

apps.apple.com/tr/app/k%C3%B6k/id1637440040 · play.google.com/store/search?q=K%C3%B6k&c=apps ·
itunes.apple.com/search?term=kok&entity=software&country=us ·
itunes.apple.com/search?term=K%C3%B6k&entity=software&country=se · en.wikipedia.org/wiki/K%C3%B6k ·
en.wikipedia.org/wiki/Kok · crunchbase.com/organization/k%C3%B6k-projekt ·
turkpatent.gov.tr/arastirma-yap?form=trademark · tmsearch.uspto.gov · branddb.wipo.int · tmdn.org/tmview

## Store-visibility check and final decision (D-019)

App Store Search API, 2026-09-30, top 50 results per term:

| Term | US | TR | SA | Reading |
|---|---|---|---|---|
| rootline / graftline / regrowly | 30 / 3 / 1, no hair apps | 2 / 0 / 0 | 3 / 0 / 0 | no demand for these words |
| regrow | 24 of 29 hair apps | 19 of 23 | 19 of 23 | real hair term, already used by "Regrow: Hair Transplant Care" and "Regrow AI" |
| kök / kok | unrelated mega-apps | math/Quran apps | unrelated | brand word brings no search traffic; "kok" does not match "Kök" |
| hair transplant / saç ekimi / زراعة الشعر | 47 of 47 hair | 43 of 47 hair | 10 hair apps, ~0 ratings | this is where visibility comes from |

Decision: keep **Kök** and spend the name field on the top term per locale
(`metadata/store-names.json`); put `kok` in every keyword field so users without "ö" find it.
