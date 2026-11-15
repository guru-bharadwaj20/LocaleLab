# Architecture

LocaleLab is a pipeline with five stages. Each stage hands plain data to the next, so every stage after capture can be tested without a browser.

```
Profile  ->  Capture  ->  Evidence  ->  Rules  ->  Findings  ->  Report / JSON / Spec
```

## Profile

A profile (`src/profiles.ts`) is a name plus the browser settings that make up one "reality": BCP 47 locale, IANA timezone, primary language subtag and text direction. Eight are built in. Anything else is written as `<locale>@<timezone>` on the command line and resolved at parse time. The first profile in the list is the baseline that cross-profile rules compare against.

## Capture

`src/capture.ts` opens one Chromium browser and, for each profile, a fresh `BrowserContext` with `locale`, `timezoneId`, `viewport`, `colorScheme`, `reducedMotion` and `bypassCSP`. It navigates, optionally waits for a selector, takes a full-page screenshot, and runs the extractor inside the page. Contexts are closed after each profile so cookies and storage never leak between realities.

## Evidence

`src/extractor.ts` exports `extractEvidence`, which is serialised with `Function.prototype.toString()` and passed to `page.evaluate`. It walks the DOM and returns plain JSON: visible text elements with layout numbers (`clientWidth`, `scrollWidth`, overflow styles), the document's `lang` and resolved `direction`, page and viewport widths, and every element carrying a `data-localelab-*` marker. For marked values it also computes the expected rendering with the page's own `Intl` objects, using `computeExpectation` from `src/intl.ts`, which is serialised the same way.

Because both functions run inside the page they must be self-contained. No imports, no closures over module scope. The TypeScript compiler cannot enforce this; the demo run is the check.

## Rules

Each file in `src/rules/` exports a `Rule`: an id, a description, a caveat and a pure `run(context)` that returns `Finding[]`. The context carries the current capture, the baseline capture and the profile. Rules never touch the browser or the filesystem. `src/rules/index.ts` runs all nine over every capture and `summariseFindings` counts them by severity.

Severity is fixed per rule and situation: `error` when the page is wrong for the locale and a person would agree on sight, `warning` when it is probably wrong, `info` when the rule could not check something.

## Outputs

`src/run.ts` assembles a `RunResult` and writes four things through `src/report/` and `src/export/`:

- `index.html`, a self-contained report with screenshots referenced by relative path.
- `findings.json` and `run.json`.
- `localelab.generated.spec.ts`, a Playwright test that re-asserts the observed facts.

## Side commands

`src/demo.ts` serves `fixtures/storefront/` from a loopback HTTP server and runs the pipeline against it. `src/benchmark/` runs the same capture, scores the findings against the truth matrix in `truth.ts`, and optionally asks a local Ollama vision model for a second opinion (`vision.ts`), which is printed but never scored.
