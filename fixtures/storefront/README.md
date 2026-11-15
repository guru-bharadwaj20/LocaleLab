# Storefront fixture

A single-page shop, "Northwind Outdoor", used by `localelab demo` and `localelab benchmark`. It translates itself on load from `navigator.language` using the dictionaries in `i18n.js`, sets `<html lang>` and `dir`, and formats most prices, counts and dates through `Intl`. That makes the page mostly healthy under every profile, which is the point: the rules should stay quiet on the healthy parts.

Six defects are planted. Each is marked in `index.html` with a `DEFECT` comment and has a `data-localelab-id` so the benchmark can find it.

| Id | Defect | Caught by |
| --- | --- | --- |
| `promo-ends` | Sale end date hard-coded in US format | `format-date` |
| `reviews-count` | Review count hard-coded with US digit grouping | `format-number` |
| `hero-price` | Price hard-coded as `$1,234.56` | `format-currency` |
| `shipping-badge` | Badge has `max-width: 190px`, `nowrap`, `overflow: hidden`, `text-overflow: ellipsis`; longer translations clip | `text-clipping` |
| `checkout-cta` | Translation key `checkout.cta.label` is missing from every dictionary, so the raw key shows | `unresolved-copy` |
| `signin` | Marked `data-localelab-translate` and never translated | `untranslated-text` |

Which profiles each defect fires in is recorded in `src/benchmark/truth.ts`, with a reason per entry. The short version: Japanese formats numbers and US dollars the same way as US English, so two of the hard-coded values are correct there, and the Japanese badge text is short enough to fit.

## Editing the fixture

- Keep the page static: no build step, no external requests. The server only serves this directory.
- If you add or move a defect, update `truth.ts` and run `npm run benchmark`. The matrix must come out with zero false positives and zero false negatives.
- New dictionary strings go into all four languages. A missing key becomes a visible raw key and a new finding.
