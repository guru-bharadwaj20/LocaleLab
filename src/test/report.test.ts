import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderHtmlReport } from "../report/html.js";
import { buildFindingsDocument } from "../report/json.js";
import { renderPlaywrightSpec } from "../export/playwright-spec.js";
import type { Finding, RunResult } from "../types.js";
import { capture, markedValue, textElement } from "./fixtures.js";

function sampleResult(findings: Finding[] = []): RunResult {
  const en = capture("en-US", {
    title: "Fixture <script>alert(1)</script>",
    textElements: [textElement({ text: "Sign in", path: "a", mustTranslate: true })],
    markedValues: [markedValue({ kind: "currency", marker: "USD:349", rendered: "$349.00", expected: "$349.00" })],
  });
  const ar = capture("ar-SA", {
    markedValues: [
      markedValue({ kind: "currency", marker: "USD:349", rendered: "$349.00", expected: "٣٤٩٫٠٠ US$" }),
    ],
  });
  const broken = { ...capture("ja-JP"), error: "net::ERR_CONNECTION_REFUSED" };
  return {
    version: "0.1.0",
    url: "http://127.0.0.1:4000/?a=1&b=<x>",
    startedAt: "2026-11-11T12:00:00.000Z",
    finishedAt: "2026-11-11T12:00:09.500Z",
    viewport: { width: 1365, height: 900 },
    baselineProfileId: "en-US",
    captures: [en, ar, broken],
    findings,
  };
}

const finding: Finding = {
  rule: "format-currency",
  profileId: "ar-SA",
  severity: "error",
  message: 'Currency rendered as "$349.00" <b>not</b> expected',
  path: "main > p",
  elementId: "price",
  evidence: { rendered: "$349.00", expected: "US$ 349", empty: "", nothing: null },
};

test("escapeHtml neutralises markup and quotes", () => {
  assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  assert.equal(escapeHtml(42), "42");
});

test("HTML report is self-contained and escapes everything it interpolates", () => {
  const html = renderHtmlReport(sampleResult([finding]));
  assert.ok(html.startsWith("<!doctype html>"));
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)/);
  assert.match(html, /&lt;b&gt;not&lt;\/b&gt;/);
  assert.doesNotMatch(html, /https?:\/\/(?!127\.0\.0\.1)/, "no external resources");
  assert.match(html, /screenshots\/en-US\.png/);
  assert.match(html, /Capture failed: net::ERR_CONNECTION_REFUSED/);
  assert.match(html, /<td>rendered<\/td>/);
  assert.doesNotMatch(html, /<td>empty<\/td>|<td>nothing<\/td>/, "blank evidence rows are dropped");
  assert.match(html, /format-currency/);
  assert.match(html, /Rules and caveats/);
  assert.match(html, /<b>1<\/b> errors/);
});

test("HTML report says so when there is nothing to report", () => {
  const html = renderHtmlReport(sampleResult([]));
  assert.match(html, /No findings/);
});

test("findings document carries a summary and one row per profile", () => {
  const doc = buildFindingsDocument(sampleResult([finding]));
  assert.deepEqual(doc.summary, { error: 1, warning: 0, info: 0 });
  assert.equal(doc.profiles.length, 3);
  assert.equal(doc.profiles[2]?.error, "net::ERR_CONNECTION_REFUSED");
  assert.equal(doc.findings[0]?.elementId, "price");
});

test("generated Playwright spec covers only captured profiles and re-checks markers", () => {
  const spec = renderPlaywrightSpec(sampleResult([finding]));
  assert.match(spec, /import \{ test, expect \} from "@playwright\/test"/);
  assert.match(spec, /test\.describe\("US English \(en-US\)"/);
  assert.match(spec, /test\.describe\("Arabic \(Saudi Arabia\) \(ar-SA\)"/);
  assert.doesNotMatch(spec, /ja-JP/, "failed captures produce no test");
  assert.match(spec, /timezoneId: "Asia\/Riyadh"/);
  assert.match(spec, /toBe\("rtl"\)/);
  assert.match(spec, /data-localelab-currency=\\"USD:349\\"/);
  assert.match(spec, /toHaveAttribute\("lang", \/\^en/);
  assert.match(spec, /\\\$349\\\.00/, "regex metacharacters in expectations are escaped");
  assert.match(spec, /\[\\\\s\\\\u00a0\\\\u202f\]US\\\$/, "NBSP in Intl output matches any space");
});
