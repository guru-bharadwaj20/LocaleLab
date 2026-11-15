# Rules

Every rule is a pure function in `src/rules/` that reads the evidence from one capture (and the baseline capture, for cross-profile checks) and returns findings. Each finding stores the measurements it was based on. This page lists what each rule checks, the severity it assigns, and the caveat it ships with.

## Layout

### `page-horizontal-overflow`

Fires when the document's scroll width is larger than the viewport width. The wider of `html` and `body` is used.

- Severity: warning
- Evidence: `scrollWidth`, `viewportWidth`, overflow in px
- Caveat: a horizontal canvas or wide data grid may be intentional.

### `text-clipping`

Fires on an element that hides its own overflowing text: `overflow-x` is `hidden` or `clip`, or `text-overflow` is `ellipsis`, and `scrollWidth` exceeds `clientWidth`. Vertical clipping is checked the same way against `clientHeight`.

- Severity: warning; error when the element or an ancestor carries `data-localelab-translate`
- Evidence: the text, `scrollWidth`, `clientWidth`, overflow styles, clipped px
- Caveat: intentionally truncated labels and scrollable controls can be flagged. Mark them `data-localelab-ignore`.

## Copy

### `unresolved-copy`

Fires when visible text looks like something that was meant to be replaced: `{{name}}`, `${name}`, `%s`, `%1$d`, ICU `{count, plural, one {...} other {...}}`, dotted keys such as `checkout.cta.label`, `SOME_CONSTANT_KEY`, `[missing translation]`, `TODO` and lorem ipsum.

- Severity: error; warning for `TODO` and lorem ipsum
- Evidence: the text, which pattern matched, the matched substring
- Caveat: the patterns may occasionally match legitimate sample text or technical identifiers.

### `untranslated-text`

Two paths. The marker path fires when an element with `data-localelab-translate` has the same text as its counterpart in the baseline, in a profile whose language differs from the baseline's. The heuristic path fires when unmarked text matches the baseline, the baseline is English, and the text reads like an English sentence: at least three Latin words including two common function words.

- Severity: error (marker), warning (heuristic)
- Evidence: the text, the baseline profile, how the element was matched (`data-localelab-id` or DOM path), which path fired
- Caveat: the heuristic misses short strings and may flag brand copy that happens to read like English. Heuristic findings need review.

## Format

These three rules only look at elements carrying a marker. The expected rendering is computed inside the captured page with its own `Intl` objects, so it reflects the browser's CLDR data for that locale and timezone.

### `format-date`

Compares the element's text with `Intl.DateTimeFormat(locale, { dateStyle, timeZone })` for the value in `data-localelab-date`. With `data-localelab-style` set, only that style is accepted; without it, any of `full`, `long`, `medium`, `short` passes. A bare `YYYY-MM-DD` is treated as a calendar date and never shifts across timezones.

- Severity: error; info when the marker cannot be parsed
- Evidence: rendered text, accepted renderings, locale, timezone, style

### `format-number`

Compares with `Intl.NumberFormat(locale)` for the value in `data-localelab-number`. Whitespace variants (regular, no-break, narrow no-break) are normalised before comparison.

- Severity: error; info on an unparseable marker
- Evidence: rendered text, expected text, locale

### `format-currency`

Compares with `Intl.NumberFormat(locale, { style: "currency", currency })` for `data-localelab-currency="CODE:amount"`. Symbol, narrow symbol, code and name displays all pass.

- Severity: error; info on an unparseable marker
- Evidence: rendered text, accepted renderings, currency, locale
- Caveat for all three: only marked values are checked. Unmarked text is never compared, so a hard-coded price without a marker goes unnoticed.

## Document

### `document-language-mismatch`

Compares the primary subtag of `<html lang>` with the profile's language.

- Severity: warning; info when `lang` is missing
- Evidence: `lang`, expected language
- Caveat: a site may intentionally keep one language for every browser locale, or omit `lang` entirely. If a site picks its language from the IP, this rule will fire in every non-matching profile.

### `rtl-direction-missing`

For profiles whose direction is `rtl`, fires when the document's resolved direction is `ltr`.

- Severity: error
- Evidence: resolved direction, `dir` attribute, profile direction
- Caveat: only checked for RTL profiles; a site that stays in an LTR language for every locale will be flagged.

## Severity guide

- `error`: the page is wrong for that locale and a person would agree on sight.
- `warning`: probably wrong, but can be intentional.
- `info`: LocaleLab could not check something.

`--fail-on` decides which of these make the exit code 1. The default is `error`.
