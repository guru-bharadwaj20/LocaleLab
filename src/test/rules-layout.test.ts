import { test } from "node:test";
import assert from "node:assert/strict";
import { pageHorizontalOverflow } from "../rules/page-horizontal-overflow.js";
import { assessClipping, textClipping, truncate } from "../rules/text-clipping.js";
import type { RuleContext } from "../rules/types.js";
import { capture, textElement } from "./fixtures.js";

function ctx(c: ReturnType<typeof capture>): RuleContext {
  return { capture: c, baseline: c, captures: [c], isBaseline: true };
}

test("page overflow ignores sub-pixel differences", () => {
  const c = capture("en-US", { scrollWidth: 1366, clientWidth: 1365 });
  assert.deepEqual(pageHorizontalOverflow.run(ctx(c)), []);
});

test("page overflow reports the wider of html and body", () => {
  const c = capture("de-DE", { scrollWidth: 1365, bodyScrollWidth: 1500, clientWidth: 1365 });
  const [finding] = pageHorizontalOverflow.run(ctx(c));
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.equal(finding.profileId, "de-DE");
  assert.equal(finding.evidence.overflowPx, 135);
  assert.match(finding.message, /135 px wider/);
});

test("clipping needs both hidden overflow and content larger than the box", () => {
  const visible = textElement({ text: "Lang", clientWidth: 100, scrollWidth: 160 });
  assert.equal(assessClipping(visible).horizontal, false, "overflow: visible never clips");

  const hidden = textElement({ text: "Lang", clientWidth: 100, scrollWidth: 160, overflowX: "hidden" });
  assert.equal(assessClipping(hidden).horizontal, true);
  assert.equal(assessClipping(hidden).hiddenPx, 60);

  const ellipsis = textElement({ text: "Lang", clientWidth: 100, scrollWidth: 101, textOverflow: "ellipsis" });
  assert.equal(assessClipping(ellipsis).horizontal, false, "one pixel is within tolerance");

  const tall = textElement({ text: "Lang", clientHeight: 20, scrollHeight: 48, overflowY: "hidden" });
  assert.equal(assessClipping(tall).vertical, true);

  const inline = textElement({ text: "Lang", clientWidth: 0, scrollWidth: 0, overflowX: "hidden" });
  assert.equal(assessClipping(inline).horizontal, false, "inline boxes report no client size");
});

test("clipping rule escalates marked text and skips ignored elements", () => {
  const clipped = { clientWidth: 120, scrollWidth: 240, overflowX: "hidden" };
  const c = capture("de-DE", {
    textElements: [
      textElement({ text: "Kostenloser Versand", path: "a", ...clipped }),
      textElement({ text: "Jetzt kaufen", path: "b", mustTranslate: true, ...clipped }),
      textElement({ text: "Ignored", path: "c", ignored: true, ...clipped }),
      textElement({ text: "Fits", path: "d" }),
    ],
  });
  const findings = textClipping.run(ctx(c));
  assert.deepEqual(
    findings.map((f) => [f.path, f.severity]),
    [
      ["a", "warning"],
      ["b", "error"],
    ],
  );
  assert.equal(findings[0]?.evidence.scrollWidth, 240);
});

test("truncate keeps short text and shortens long text with an ellipsis", () => {
  assert.equal(truncate("short"), "short");
  const long = "x".repeat(80);
  assert.equal(truncate(long).length, 60);
  assert.ok(truncate(long).endsWith("…"));
});
