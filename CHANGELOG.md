# Changelog

All notable changes to LocaleLab are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## Unreleased

Nothing yet.

## 0.1.0 - 2026-11-14

First release.

### Added

- `localelab run <url>`: captures a page under one or more browser profiles (locale, timezone, viewport, colour scheme) with Playwright and Chromium.
- Eight built-in profiles (`en-US`, `en-GB`, `de-DE`, `fr-FR`, `ja-JP`, `ar-SA`, `hi-IN`, `es-ES`) and ad-hoc profiles written as `<locale>@<IANA timezone>`.
- Nine deterministic rules: `page-horizontal-overflow`, `text-clipping`, `unresolved-copy`, `untranslated-text`, `format-date`, `format-number`, `format-currency`, `document-language-mismatch`, `rtl-direction-missing`.
- Opt-in markers: `data-localelab-date`, `data-localelab-number`, `data-localelab-currency`, `data-localelab-style`, `data-localelab-translate`, `data-localelab-ignore`, `data-localelab-id`.
- Offline HTML report with per-profile screenshots, evidence tables and a rule legend; `findings.json` and `run.json`; a generated Playwright spec.
- `localelab demo`: serves a deliberately broken storefront fixture and runs against it.
- `localelab benchmark`: scores the rules against a 16-observation truth matrix and writes `benchmark.json`. Current result 16/16, 0 false positives, 0 false negatives.
- `--vision`: optional, advisory screenshot review through a local Ollama vision model.
- `--fail-on` threshold and documented exit codes for CI.
- Programmatic API exported from the package root.
