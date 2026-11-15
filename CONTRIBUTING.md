# Contributing

Thanks for looking. Bug reports with a URL and a profile id are the most useful thing you can send; a failing test is second best.

## Setup

```
git clone https://github.com/guru-bharadwaj20/localelab
cd localelab
npm install
npx playwright install chromium
npm test
npm run benchmark
```

`npm test` builds and runs the unit tests under `dist/test`. The benchmark needs Chromium and takes a few seconds.

## Adding a rule

1. Create `src/rules/<rule-id>.ts` exporting a `Rule` object with an `id`, a one-sentence `description`, an honest `caveat` describing when the rule is wrong, and a `run(context)` function. Rules are pure: they read `context.capture.evidence` (and `context.baseline` for cross-profile checks) and return `Finding[]`. No I/O, no browser.
2. Add the id to the `RuleId` union in `src/types.ts` and the rule to `RULES` in `src/rules/index.ts`.
3. Put the measurements the rule used into `finding.evidence`. A reader should be able to check the finding from the report without re-running anything.
4. Write tests in `src/test/` using the fake captures from `src/test/fixtures.ts`. Cover at least one case that must not fire.
5. Run `npm run benchmark`. If the new rule fires on the fixture, either the fixture has a real defect (add it to the truth matrix in `src/benchmark/truth.ts` and explain why in `why`) or the rule has a false positive to fix. The benchmark must stay at zero false positives.

Severity guide: `error` when the page is wrong for that locale and a human would agree on sight, `warning` when it is probably wrong but can be intentional, `info` when LocaleLab could not check something (unparseable marker, missing `lang`).

## Adding a profile

Add a line to `BUILT_IN_PROFILES` in `src/profiles.ts`. The `language` field is the primary subtag; `direction` is `rtl` for right-to-left languages. Keep the default profile list at four unless there is a good reason: every extra default adds a capture to every run.

## Changing the extractor

`extractEvidence` in `src/extractor.ts` and `computeExpectation` in `src/intl.ts` are serialised with `Function.prototype.toString()` and evaluated inside the page. They cannot reference anything outside their own body: no imports, no module-level constants, no helper functions defined elsewhere. The TypeScript compiler will not catch a violation; the page will throw at runtime. Run the demo after touching either file.

## Pull requests

- One change per pull request. Rule changes and refactors go separately.
- Keep `npm test` green and the benchmark at 16/16 with 0 false positives, or explain in the description why the matrix changed.
- Add a line to `CHANGELOG.md` under "Unreleased".
- Plain prose in docs and comments. Say what the code does and when it is wrong.

## Style

TypeScript, strict mode, ES modules, no runtime dependencies beyond Playwright. Two-space indentation, double quotes, trailing commas, as `.editorconfig` and the existing files show. There is no linter configured; `npm run typecheck` is the gate.
