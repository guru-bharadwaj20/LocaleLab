# LocaleLab

LocaleLab opens one URL in several browser "realities" (locale, timezone, text direction, viewport), takes a screenshot of each, and runs a small set of deterministic checks over what the browser rendered. The output is an offline HTML report with the screenshots and evidence next to each finding, a JSON file for tooling, and a generated Playwright spec you can keep.

It runs on your machine. Nothing is uploaded anywhere.

```
$ localelab run https://shop.example --profiles en-US,de-DE,ja-JP,ar-SA

Capturing US English (en-US, America/New_York)
  ok en-US: 36 text elements, 7 marked values, 837 ms
Capturing German (de-DE, Europe/Berlin)
  ok de-DE: 36 text elements, 7 marked values, 832 ms
...
  error   de-DE  format-date       Date rendered as "Nov 11, 2026" but the browser locale formats it as "11.11.2026".
  error   de-DE  text-clipping     "Kostenloser Versand ab 50 $ Bestellwert" is clipped horizontally by 89 px.
  error   ar-SA  untranslated-text "Sign in" is marked for translation but matches the en-US baseline.
16 findings (16 errors, 0 warnings, 0 info). Report: localelab-report/index.html
```

## What it checks

Each profile is a real Chromium context with `locale`, `timezoneId`, `viewport` and colour scheme set through Playwright. A script runs inside the page and collects plain data: visible text elements with their layout numbers, the document's `lang` and resolved `direction`, page width, and any element carrying a LocaleLab marker. The rules then work on that data, so the same rule can be unit tested without a browser.

| Rule | Severity | What it means |
| --- | --- | --- |
| `page-horizontal-overflow` | warning | The page is wider than the viewport. |
| `text-clipping` | warning, error if marked for translation | An element hides its own overflowing text (`overflow: hidden` or `text-overflow: ellipsis`). |
| `unresolved-copy` | error (warning for TODO and lorem ipsum) | Placeholders like `{{name}}`, `%s`, ICU `{count, plural, ...}`, raw keys like `checkout.cta.label`, `SOME_CONSTANT_KEY`, or "missing translation" markers are visible. |
| `untranslated-text` | error for marked text, warning for the heuristic | Text is identical to the baseline profile in a profile with another language. The heuristic only fires on strings that look like English sentences. |
| `format-date` | error | A marked date does not match what the browser's own `Intl.DateTimeFormat` produces for that locale and timezone. |
| `format-number` | error | Same for numbers. |
| `format-currency` | error | Same for currency amounts. |
| `document-language-mismatch` | warning, info if `lang` is missing | `<html lang>` disagrees with the profile's language. |
| `rtl-direction-missing` | error | A right-to-left profile renders the document left-to-right. |

The format rules compare against the browser's Intl output, computed inside the same page, so they use the same CLDR data the user's browser would. Where several renderings are acceptable (a date without an explicit style, a currency with a symbol or a code), any of them passes.

Treat a finding as something to go and look at. Every finding carries the numbers or strings it was based on, and the report lists each rule's known weak spot.

## Install

Node.js 20 or newer.

```
npm install
npx playwright install chromium
npm run build
```

Or, as a dependency of another project:

```
npm install localelab
npx playwright install chromium
```

## Commands

```
localelab run <url> [options]      Capture, analyse and write a report
localelab demo [options]           Serve the bundled storefront fixture and run against it
localelab benchmark [options]      Score the rules against the fixture's planted defects
localelab profiles                 List built-in profiles
localelab help
localelab version
```

Options:

| Option | Default | Purpose |
| --- | --- | --- |
| `-p, --profiles <list>` | `en-US,de-DE,ja-JP,ar-SA` | Comma-separated profile ids. The first one is the baseline for cross-profile comparisons. Ad-hoc profiles take the form `<locale>@<IANA timezone>`, for example `pt-BR@America/Sao_Paulo`. |
| `-o, --out <dir>` | `./localelab-report` | Where the report goes. |
| `--viewport <WxH>` | `1365x900` | One viewport for every profile. |
| `-t, --timeout <ms>` | `20000` | Navigation and selector timeout per profile. |
| `--wait-for <css>` | | Wait for a selector before capturing. Useful for client-rendered pages. |
| `--headed` | | Show the browser window. |
| `--fail-on <level>` | `error` | Exit with status 1 when findings at or above this level exist. One of `error`, `warning`, `info`, `none`. |
| `--quiet` | | Print only the summary line. |
| `--vision` | | For `demo` and `benchmark`: ask a local vision model to look at the screenshots too. See below. |

Built-in profiles: `en-US`, `en-GB`, `de-DE`, `fr-FR`, `ja-JP`, `ar-SA`, `hi-IN`, `es-ES`.

Exit codes: 0 clean, 1 findings at the `--fail-on` level, 2 bad arguments, 3 the run itself failed.

## What ends up in the report folder

```
localelab-report/
  index.html                     Offline report. Open it directly in a browser.
  screenshots/<profile>.png      Full-page screenshot per profile.
  findings.json                  Findings plus a summary, for CI or dashboards.
  run.json                       Everything the run collected, including raw evidence.
  localelab.generated.spec.ts    Playwright test, one describe block per profile.
```

Keep `screenshots/` beside `index.html`; the report links to it with relative paths and loads nothing from the network.

The generated spec re-creates each profile's browser context and asserts the facts LocaleLab observed: the emulation took effect, the page did not overflow, `lang` and direction are right, and each marked value renders as the locale expects. Install `@playwright/test`, then run `npx playwright test localelab-report/localelab.generated.spec.ts`. The URL can be overridden with `LOCALELAB_URL`.

## Markers: telling LocaleLab what you meant

LocaleLab never guesses what a number on your page was supposed to be. You opt in with data attributes, and only marked values are checked.

```html
<time data-localelab-date="2026-11-11T12:00:00Z" data-localelab-style="long">November 11, 2026</time>
<span data-localelab-number="1234567.89">1,234,567.89</span>
<span data-localelab-currency="EUR:1234.56">€1,234.56</span>

<a href="/login" data-localelab-translate data-localelab-id="signin">Sign in</a>
<footer data-localelab-ignore>© 2026 Example</footer>
```

| Attribute | Meaning |
| --- | --- |
| `data-localelab-date="<ISO 8601>"` | The instant or calendar date this element shows. A bare `YYYY-MM-DD` is treated as a calendar date and never shifts across timezones. Optional `data-localelab-style` is one of `full`, `long`, `medium`, `short`; without it, any of the four passes. |
| `data-localelab-number="<number>"` | The numeric value. |
| `data-localelab-currency="<CODE>:<amount>"` | ISO 4217 code and amount. Symbol, narrow symbol, code and name renderings all pass. |
| `data-localelab-translate` | This element (and its subtree) must differ from the baseline in profiles with another language. Clipping inside it is an error rather than a warning. |
| `data-localelab-ignore` | Skip this subtree entirely. |
| `data-localelab-id="<id>"` | A stable id for matching the same element across profiles when the DOM path differs. Also used by the benchmark. |

Pages without markers still get the layout, copy, language and direction checks.

## Demo and benchmark

```
npm run demo
npm run benchmark
```

The demo serves a small storefront from `fixtures/storefront/` on a random local port and runs the default four profiles against it. The page translates itself from `navigator.language` and sets `lang` and `dir` properly, so most of it is healthy. Six defects are planted on purpose and marked in the HTML with comments:

1. The sale date is hard-coded in US format.
2. A statistic is hard-coded with US digit grouping.
3. A price is hard-coded as `$1,234.56`.
4. The "free shipping" badge is sized for English and clips longer translations.
5. The checkout button's translation key is missing from every dictionary, so the raw key shows.
6. The "Sign in" link is marked as needing translation and never gets one.

The benchmark runs the same capture and scores the findings against a truth matrix of 16 (profile, rule, element) observations. You might expect 6 defects times 3 non-baseline profiles. The real count follows what the browser's locale data does: `ja-JP` groups numbers and places the dollar sign exactly like `en-US`, so a hard-coded US number or price is not wrong there and must not be flagged; the raw key leaks in all four profiles including the baseline; the badge clips in German and Arabic but Japanese is shorter and fits.

The current result on this fixture:

```
Expected checks detected   16 / 16
Injected defect types      6 / 6
False positives            0
False negatives            0
Deterministic precision: 1.000  |  Deterministic recall: 1.000
```

Read that carefully. It is one synthetic page that was written alongside the rules. A perfect score means the rules catch the cases the fixture plants without flagging anything else on that page. It says nothing about precision or recall on real sites, where the copy heuristics will sometimes be wrong and clipping will sometimes be intentional. The benchmark exists so a change to a rule cannot silently break a known catch.

### Optional vision pass

`--vision` sends each screenshot to a local [Ollama](https://ollama.com) server and asks a vision model what it suspects. Nothing it says enters the score or the findings; the suggestions are printed and stored in `benchmark.json` so you can compare them with the deterministic results.

```
ollama pull qwen2.5vl:7b
node dist/cli.js benchmark --vision
```

Defaults are `http://localhost:11434` and `qwen2.5vl:7b`; override with `LOCALELAB_OLLAMA_URL` and `LOCALELAB_VISION_MODEL`. If Ollama is not running or the model is missing, the pass is skipped with a one-line reason and the rest of the run is unaffected. On the fixture the model has, so far, found less than the rules and once reported a correct German date as wrong, which is a fair summary of why it is advisory.

## Using it from code

```ts
import { runLocaleLab, resolveProfiles } from "localelab";

const { result, outputs } = await runLocaleLab({
  url: "https://shop.example",
  profiles: resolveProfiles("en-US,de-DE,ar-SA"),
  outDir: "report",
  viewport: { width: 1365, height: 900 },
  timeoutMs: 20_000,
});

console.log(result.findings.length, outputs.html);
```

`runRules(captures)` and the render functions are exported separately, so you can run the rules over saved `run.json` data or render a report from another capture source.

## What browser emulation does not prove

Setting `locale` and `timezoneId` on a Playwright context changes what `navigator.language`, `Intl` and the `Accept-Language` header report. It does not change your IP address, your account's saved preferences, geo-fenced content, or server-side decisions made before the page reaches the browser. If a site picks its language from the IP, LocaleLab will show you the same language four times and the `document-language-mismatch` rule will tell you so. Pass the localized URL directly in that case.

Other limits worth knowing:

- Only visible elements with their own text are inspected. Text in canvas, images, shadow roots or iframes is not.
- Clipping is measured from `scrollWidth` against `clientWidth` on elements that hide overflow. A deliberately truncated label looks identical to a broken one; mark it `data-localelab-ignore` or treat the warning as such.
- The English heuristic in `untranslated-text` needs an English baseline and at least three Latin words with two common function words. It will miss short strings and may flag brand copy that happens to read like English.
- One viewport per run. Run twice for mobile and desktop.
- Profiles run one after another in one browser. Four profiles on a normal page take a few seconds.

## Development

```
npm test          # build, then node:test over dist/test
npm run typecheck
npm run benchmark
```

Tests do not need a browser except the demo-server test, which only talks to the local fixture server. The benchmark does need Chromium.

Project layout:

```
src/
  cli.ts               command line entry
  run.ts               capture -> rules -> outputs
  capture.ts           Playwright contexts, screenshots, in-page extraction
  extractor.ts         the function that runs inside the page
  intl.ts              expectation helpers shared by Node and the page
  profiles.ts          built-in profiles and ad-hoc parsing
  rules/               one file per rule, pure functions over evidence
  report/              HTML and JSON writers
  export/              Playwright spec generator
  benchmark/           truth matrix, scoring, optional vision pass
  demo.ts              static server for the fixture
fixtures/storefront/   the deliberately broken demo page
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add a rule or a profile, [SECURITY.md](SECURITY.md) for reporting problems, and [CHANGELOG.md](CHANGELOG.md) for what changed.

## License

[MIT](LICENSE). Copyright 2026 Guru Bharadwaj.
