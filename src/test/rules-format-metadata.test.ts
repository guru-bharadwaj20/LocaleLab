import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMarkedValue, formatCurrency, formatDate } from "../rules/formatting.js";
import { documentLanguageMismatch, primaryLanguage, rtlDirectionMissing } from "../rules/document-metadata.js";
import { RULES, runRules, summariseFindings } from "../rules/index.js";
import type { Rule, RuleContext } from "../rules/types.js";
import { capture, markedValue } from "./fixtures.js";

function ctx(c: ReturnType<typeof capture>): RuleContext {
  return { capture: c, baseline: c, captures: [c], isBaseline: true };
}

test("marked values pass when rendered text matches the expectation or an alternative", () => {
  const ok = markedValue({ kind: "date", rendered: "11.11.2026", expected: "11.11.2026" });
  assert.equal(checkMarkedValue(ok, "de-DE"), null);
  const alt = markedValue({
    kind: "date",
    rendered: "11. November 2026",
    expected: "11.11.2026",
    alternatives: ["11. November 2026"],
  });
  assert.equal(checkMarkedValue(alt, "de-DE"), null);
  const nbsp = markedValue({ kind: "currency", rendered: "1.234,56 €", expected: "1.234,56 €" });
  assert.equal(checkMarkedValue(nbsp, "de-DE"), null, "non-breaking spaces must not cause a mismatch");
});

test("marked values fail loudly on mismatch and softly on unparseable markers", () => {
  const bad = markedValue({ kind: "number", rendered: "1,234.5", expected: "1.234,5" });
  const finding = checkMarkedValue(bad, "de-DE");
  assert.equal(finding?.rule, "format-number");
  assert.equal(finding?.severity, "error");
  assert.equal(finding?.evidence.expected, "1.234,5");

  const broken = markedValue({ kind: "currency", rendered: "€5", marker: "E:5", error: "Bad currency" });
  const info = checkMarkedValue(broken, "de-DE");
  assert.equal(info?.severity, "info");
  assert.match(info?.message ?? "", /could not be interpreted/);

  const ignored = markedValue({ kind: "number", rendered: "1,234.5", expected: "1.234,5", ignored: true });
  assert.equal(checkMarkedValue(ignored, "de-DE"), null);
});

test("each formatting rule only looks at its own marker kind", () => {
  const c = capture("ja-JP", {
    markedValues: [
      markedValue({ kind: "date", rendered: "Nov 11, 2026", expected: "2026/11/11", path: "d" }),
      markedValue({ kind: "currency", rendered: "$5.00", expected: "US$5.00", path: "c" }),
    ],
  });
  assert.deepEqual(formatDate.run(ctx(c)).map((f) => f.path), ["d"]);
  assert.deepEqual(formatCurrency.run(ctx(c)).map((f) => f.path), ["c"]);
});

test("primaryLanguage lowercases the first subtag", () => {
  assert.equal(primaryLanguage("zh-Hant-TW"), "zh");
  assert.equal(primaryLanguage("EN_us"), "en");
  assert.equal(primaryLanguage(""), null);
  assert.equal(primaryLanguage(null), null);
});

test("document language rule distinguishes missing from mismatching lang", () => {
  const missing = capture("de-DE", { documentLang: null });
  assert.equal(documentLanguageMismatch.run(ctx(missing))[0]?.severity, "info");
  const wrong = capture("de-DE", { documentLang: "en-US" });
  const [finding] = documentLanguageMismatch.run(ctx(wrong));
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.evidence.profileLanguage, "de");
  const regional = capture("de-DE", { documentLang: "de-AT" });
  assert.deepEqual(documentLanguageMismatch.run(ctx(regional)), [], "regional variants of the right language pass");
});

test("RTL rule fires only for RTL profiles rendered LTR", () => {
  assert.deepEqual(rtlDirectionMissing.run(ctx(capture("en-US"))), []);
  assert.deepEqual(rtlDirectionMissing.run(ctx(capture("ar-SA", { computedDir: "rtl" }))), []);
  const [finding] = rtlDirectionMissing.run(ctx(capture("ar-SA", { computedDir: "ltr", documentDir: null })));
  assert.equal(finding?.severity, "error");
  assert.equal(finding?.evidence.expectedDir, "rtl");
});

test("runRules skips failed captures, isolates crashes and sorts by profile then severity", () => {
  const en = capture("en-US");
  const de = capture("de-DE", {
    scrollWidth: 1600,
    documentLang: "en",
    markedValues: [markedValue({ kind: "number", rendered: "1,000", expected: "1.000" })],
  });
  const broken = { ...capture("ja-JP"), error: "timeout" };
  const crashing: Rule = {
    id: "text-clipping",
    description: "crash",
    caveat: "",
    run() {
      throw new Error("boom");
    },
  };
  const findings = runRules([en, de, broken], [...RULES, crashing]);
  assert.ok(findings.every((f) => f.profileId !== "ja-JP"), "errored captures produce no findings");
  const deFindings = findings.filter((f) => f.profileId === "de-DE");
  assert.deepEqual(
    deFindings.map((f) => f.severity),
    ["error", "warning", "warning", "info"],
  );
  assert.equal(deFindings[0]?.rule, "format-number");
  assert.ok(deFindings.some((f) => f.evidence.internalError === true));
  const enIndex = findings.findIndex((f) => f.profileId === "en-US");
  const deIndex = findings.findIndex((f) => f.profileId === "de-DE");
  assert.ok(enIndex < deIndex, "baseline findings come first");

  const summary = summariseFindings(findings);
  assert.equal(summary.error + summary.warning + summary.info, findings.length);
});

test("every registered rule has a unique id, a description and a caveat", () => {
  const ids = new Set(RULES.map((r) => r.id));
  assert.equal(ids.size, RULES.length);
  for (const rule of RULES) {
    assert.ok(rule.description.length > 10, rule.id);
    assert.ok(rule.caveat.length > 10, rule.id);
  }
});
