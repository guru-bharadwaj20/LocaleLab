# Security

## Reporting a problem

Email gururb20@gmail.com with "LocaleLab security" in the subject. Please include the version, how to reproduce the issue, and what you think the impact is. Do not open a public issue for anything that could be exploited before a fix exists.

You will get an acknowledgement within three working days. Fixes for the current minor version ship as a patch release, with credit in the changelog unless you prefer otherwise.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | yes |

## What LocaleLab does, so you can judge the risk

- It launches Chromium through Playwright and navigates to the URL you give it. Any page you point it at runs its own JavaScript in that browser, as it would in yours. Use the same judgement you would when opening the page.
- It injects one function into each page to read text, layout numbers and marker attributes. The function does not send data anywhere; the result travels back to the Node process over Playwright's local connection.
- `bypassCSP` is enabled on the capture context so the extractor can run on sites with strict content security policies. This weakens the page's own CSP for the duration of the capture, in a throwaway context that is closed afterwards.
- The report embeds page text and screenshots. Treat the report folder as you would treat the page: if the page shows account data, so will the report. All interpolated text is HTML-escaped, so page content cannot run script inside the report.
- `localelab demo` and `localelab benchmark` start an HTTP server bound to 127.0.0.1 on a random port. It serves only `fixtures/storefront/` and refuses paths that resolve outside that directory. It stops when the command finishes.
- `--vision` posts screenshots to the Ollama URL you configure, `http://localhost:11434` by default. Point it at a remote host only if you are happy for those screenshots to leave the machine.
- There is no telemetry and no network access other than the target URL, its own resources, and the optional Ollama endpoint.

## Dependencies

The only runtime dependency is `playwright`. Dependabot or `npm audit` output for dev dependencies is welcome as a pull request.
