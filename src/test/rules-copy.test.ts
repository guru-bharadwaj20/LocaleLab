import { test } from "node:test";
import assert from "node:assert/strict";
import { findUnresolvedCopy, looksLikeI18nKey, unresolvedCopy } from "../rules/unresolved-copy.js";
import { looksEnglish, untranslatedText } from "../rules/untranslated-text.js";
import type { RuleContext } from "../rules/types.js";
import { capture, textElement } from "./fixtures.js";

test("i18n key detection accepts dotted keys and rejects domains, files and abbreviations", () => {
  for (const key of ["checkout.cta.label", "nav.account_menu", "home.heroTitle", "errors.network.timeout"]) {
    assert.ok(looksLikeI18nKey(key), key);
  }
  for (const notKey of ["example.com", "styles.css", "e.g.", "v1.2.3", "Dr. Smith", "1.5", "node.js", "www.example.org"]) {
    assert.equal(looksLikeI18nKey(notKey), false, notKey);
  }
});

test("copy patterns catch placeholders and markers", () => {
  assert.equal(findUnresolvedCopy("Hello {{name}}")?.pattern.name, "mustache-placeholder");
  assert.equal(findUnresolvedCopy("You have {count, plural, one {# item} other {# items}}")?.pattern.name, "icu-placeholder");
  assert.equal(findUnresolvedCopy("Welcome back, %s!")?.pattern.name, "printf-placeholder");
  assert.equal(findUnresolvedCopy("[missing \"de.cart.title\" translation]")?.pattern.name, "missing-translation-marker");
  assert.equal(findUnresolvedCopy("checkout.cta.label")?.pattern.name, "i18n-key");
  assert.equal(findUnresolvedCopy("ERR_CART_EMPTY")?.pattern.name, "constant-key");
  assert.equal(findUnresolvedCopy("TODO translate this")?.pattern.severity, "warning");
  assert.equal(findUnresolvedCopy("Lorem ipsum dolor sit amet")?.pattern.severity, "warning");
  assert.equal(findUnresolvedCopy("Save 20% today"), null);
  assert.equal(findUnresolvedCopy("Visit example.com for details"), null);
  assert.equal(findUnresolvedCopy("Price in USD"), null, "a single uppercase word is not a constant");
});

test("unresolved copy reports each fragment once, from the smallest element", () => {
  const c = capture("de-DE", {
    textElements: [
      textElement({ text: "Warenkorb checkout.cta.label Weiter", path: "main" }),
      textElement({ text: "checkout.cta.label", path: "main > button", id: "cta" }),
    ],
  });
  const context: RuleContext = { capture: c, baseline: c, captures: [c], isBaseline: true };
  const findings = unresolvedCopy.run(context);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.path, "main > button");
  assert.equal(findings[0]?.elementId, "cta");
  assert.equal(findings[0]?.evidence.fragment, "checkout.cta.label");
});

test("looksEnglish needs several words and common function words", () => {
  assert.ok(looksEnglish("Add to your cart"));
  assert.ok(looksEnglish("Free shipping on all orders over 50"));
  assert.equal(looksEnglish("Sign in"), false, "two words are too short to judge");
  assert.equal(looksEnglish("Acme Studio Pro"), false);
  assert.equal(looksEnglish("Kostenloser Versand für alle Bestellungen"), false);
  assert.equal(looksEnglish("カートに追加 and more"), false, "non-Latin script is never English");
});

test("untranslated text matches by id first, then by path, and skips the baseline", () => {
  const baseline = capture("en-US", {
    textElements: [
      textElement({ text: "Sign in", path: "header > a", id: "signin", mustTranslate: true }),
      textElement({ text: "Add to your cart", path: "main > button" }),
      textElement({ text: "Acme", path: "header > span" }),
    ],
  });
  const de = capture("de-DE", {
    textElements: [
      textElement({ text: "Sign in", path: "header > nav > a", id: "signin", mustTranslate: true }),
      textElement({ text: "Add to your cart", path: "main > button" }),
      textElement({ text: "Acme", path: "header > span" }),
    ],
  });
  const captures = [baseline, de];
  assert.deepEqual(untranslatedText.run({ capture: baseline, baseline, captures, isBaseline: true }), []);

  const findings = untranslatedText.run({ capture: de, baseline, captures, isBaseline: false });
  assert.deepEqual(
    findings.map((f) => [f.severity, f.evidence.source, f.evidence.matchedBy]),
    [
      ["error", "marker", "data-localelab-id"],
      ["warning", "heuristic", "path"],
    ],
  );
});

test("untranslated text stays quiet for same-language profiles and translated strings", () => {
  const baseline = capture("en-US", {
    textElements: [textElement({ text: "Sign in", path: "a", mustTranslate: true })],
  });
  const gb = capture("en-GB", { textElements: [textElement({ text: "Sign in", path: "a", mustTranslate: true })] });
  const de = capture("de-DE", { textElements: [textElement({ text: "Anmelden", path: "a", mustTranslate: true })] });
  const captures = [baseline, gb, de];
  assert.deepEqual(untranslatedText.run({ capture: gb, baseline, captures, isBaseline: false }), []);
  assert.deepEqual(untranslatedText.run({ capture: de, baseline, captures, isBaseline: false }), []);
});
