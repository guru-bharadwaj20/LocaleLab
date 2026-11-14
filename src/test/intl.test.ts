import { test } from "node:test";
import assert from "node:assert/strict";
import { computeExpectation, matchesExpectation, normaliseRendered } from "../intl.js";

test("normaliseRendered collapses whitespace variants and strips bidi marks", () => {
  assert.equal(normaliseRendered("  1 234,56 € "), "1 234,56 €");
  assert.equal(normaliseRendered("‏١٢٣"), "١٢٣");
  assert.equal(normaliseRendered("Nov 11,  2026"), "Nov 11, 2026");
});

test("date expectation follows the locale and accepts other styles when none is given", () => {
  const us = computeExpectation("date", "2026-11-11T12:00:00Z", undefined, "en-US", "America/New_York");
  assert.equal(us.expected, "Nov 11, 2026");
  assert.ok(matchesExpectation("November 11, 2026", us), "long style should be accepted");
  assert.ok(matchesExpectation("11/11/26", us), "short style should be accepted");

  const de = computeExpectation("date", "2026-11-11T12:00:00Z", undefined, "de-DE", "Europe/Berlin");
  assert.equal(de.expected, "11.11.2026");
  assert.equal(matchesExpectation("Nov 11, 2026", de), false);
});

test("date expectation honours an explicit style", () => {
  const gb = computeExpectation("date", "2026-11-11T12:00:00Z", "long", "en-GB", "Europe/London");
  assert.equal(gb.expected, "11 November 2026");
  assert.equal(matchesExpectation("11 Nov 2026", gb), false, "medium must not pass when long is required");
});

test("a bare calendar date never shifts across timezones", () => {
  const tokyo = computeExpectation("date", "2026-11-11", undefined, "en-US", "Asia/Tokyo");
  const la = computeExpectation("date", "2026-11-11", undefined, "en-US", "America/Los_Angeles");
  assert.equal(tokyo.expected, "Nov 11, 2026");
  assert.equal(la.expected, "Nov 11, 2026");
});

test("date expectation reports unparseable input", () => {
  const bad = computeExpectation("date", "yesterday", undefined, "en-US", "UTC");
  assert.equal(bad.expected, null);
  assert.match(bad.error ?? "", /Unparseable/);
});

test("number expectation uses locale separators", () => {
  assert.equal(computeExpectation("number", "1234.56", undefined, "en-US", "UTC").expected, "1,234.56");
  assert.equal(computeExpectation("number", "1234.56", undefined, "de-DE", "UTC").expected, "1.234,56");
  const hi = computeExpectation("number", "1234567.5", undefined, "hi-IN", "UTC");
  assert.equal(hi.expected, "12,34,567.5");
  const fixed = computeExpectation("number", "1234.5", undefined, "en-US", "UTC");
  assert.ok(matchesExpectation("1,234.50", fixed), "two-decimal rendering is an acceptable alternative");
  assert.equal(computeExpectation("number", "abc", undefined, "en-US", "UTC").expected, null);
});

test("currency expectation parses CODE:amount", () => {
  const eurDe = computeExpectation("currency", "EUR:1234.56", undefined, "de-DE", "UTC");
  assert.equal(normaliseRendered(eurDe.expected ?? ""), "1.234,56 €");
  const eurUs = computeExpectation("currency", "EUR:1234.56", undefined, "en-US", "UTC");
  assert.equal(eurUs.expected, "€1,234.56");
  assert.ok(matchesExpectation("EUR 1,234.56", eurUs), "currency code display is acceptable");
  const jpy = computeExpectation("currency", "JPY:1234", undefined, "ja-JP", "UTC");
  assert.equal(normaliseRendered(jpy.expected ?? ""), "￥1,234");
  assert.match(computeExpectation("currency", "1234.56", undefined, "en-US", "UTC").error ?? "", /ISO-4217/);
  assert.match(computeExpectation("currency", "E:1", undefined, "en-US", "UTC").error ?? "", /ISO-4217/);
});

test("matchesExpectation never passes a missing expectation", () => {
  assert.equal(matchesExpectation("anything", { expected: null, alternatives: [] }), false);
});
