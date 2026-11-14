import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMatrix, renderScoreSummary, scoreFindings } from "../benchmark/score.js";
import { BENCHMARK_PROFILE_IDS, TRUTH_MATRIX, expectedObservations } from "../benchmark/truth.js";
import { parseSuggestions, visionAvailability, describeScreenshot } from "../benchmark/vision.js";
import type { Finding } from "../types.js";
import { getProfile } from "../profiles.js";

function perfectFindings(): Finding[] {
  return expectedObservations().map((o) => ({
    rule: o.rule,
    profileId: o.profileId,
    severity: "error",
    message: `${o.defect} in ${o.profileId}`,
    elementId: o.elementId,
    evidence: {},
  }));
}

test("truth matrix flattens to 16 observations over 6 defect types and 4 profiles", () => {
  const observations = expectedObservations();
  assert.equal(observations.length, 16);
  assert.equal(TRUTH_MATRIX.length, 6);
  assert.equal(new Set(observations.map((o) => o.profileId)).size, BENCHMARK_PROFILE_IDS.length);
  for (const entry of TRUTH_MATRIX) {
    for (const p of entry.profiles) assert.ok(BENCHMARK_PROFILE_IDS.includes(p as (typeof BENCHMARK_PROFILE_IDS)[number]), p);
  }
});

test("a perfect run scores 16/16 with precision and recall of 1", () => {
  const score = scoreFindings(perfectFindings());
  assert.equal(score.detected, 16);
  assert.equal(score.expected, 16);
  assert.equal(score.defectTypesDetected, 6);
  assert.deepEqual(score.falsePositives, []);
  assert.deepEqual(score.falseNegatives, []);
  assert.equal(score.precision, 1);
  assert.equal(score.recall, 1);
  assert.match(renderScoreSummary(score), /16 \/ 16/);
  assert.match(renderScoreSummary(score), /precision: 1\.000/);
});

test("missing and extra findings become false negatives and false positives", () => {
  const findings = perfectFindings().filter((f) => !(f.profileId === "ja-JP" && f.rule === "format-date"));
  findings.push({
    rule: "page-horizontal-overflow",
    profileId: "de-DE",
    severity: "warning",
    message: "wide",
    evidence: {},
  });
  findings.push({ rule: "format-date", profileId: "en-US", severity: "info", message: "advisory", evidence: {} });
  const score = scoreFindings(findings);
  assert.equal(score.detected, 15);
  assert.equal(score.falseNegatives.length, 1);
  assert.equal(score.falseNegatives[0]?.profileId, "ja-JP");
  assert.equal(score.falsePositives.length, 1, "info findings never count as false positives");
  assert.equal(score.falsePositives[0]?.rule, "page-horizontal-overflow");
  assert.ok(Math.abs(score.precision - 15 / 16) < 1e-9);
  assert.ok(Math.abs(score.recall - 15 / 16) < 1e-9);
  const table = renderMatrix(score, BENCHMARK_PROFILE_IDS);
  assert.match(table, /date-format\s+-\s+hit\s+MISS\s+hit/);
});

test("a finding with the right rule but another element does not count", () => {
  const findings = perfectFindings().map((f) =>
    f.profileId === "de-DE" && f.rule === "format-number" ? { ...f, elementId: "members-count" } : f,
  );
  const score = scoreFindings(findings);
  assert.equal(score.detected, 15);
  assert.equal(score.falsePositives.length, 1);
});

test("vision suggestions are parsed leniently from chatty model output", () => {
  const raw = 'Sure! Here you go: {"issues":[{"issue":"Date in US format","location":"hero","confidence":"high"},{"issue":"","confidence":"low"},{"issue":"Odd","confidence":"certain"}]} Hope this helps.';
  const parsed = parseSuggestions(raw);
  assert.deepEqual(parsed, [
    { issue: "Date in US format", location: "hero", confidence: "high" },
    { issue: "Odd", location: "", confidence: "low" },
  ]);
  assert.deepEqual(parseSuggestions("no json here"), []);
  assert.deepEqual(parseSuggestions('{"issues": "nope"}'), []);
});

test("vision pass degrades to a reason when Ollama is unreachable or lacks the model", async () => {
  const unreachable = await visionAvailability({
    baseUrl: "http://127.0.0.1:9",
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED");
    },
  });
  assert.equal(unreachable.ok, false);
  if (!unreachable.ok) assert.match(unreachable.reason, /Cannot reach Ollama/);

  const missingModel = await visionAvailability({
    model: "qwen2.5vl:7b",
    fetchImpl: async () => new Response(JSON.stringify({ models: [{ name: "llama3:8b" }] }), { status: 200 }),
  });
  assert.equal(missingModel.ok, false);
  if (!missingModel.ok) assert.match(missingModel.reason, /ollama pull qwen2.5vl:7b/);

  const present = await visionAvailability({
    model: "qwen2.5vl:7b",
    fetchImpl: async () => new Response(JSON.stringify({ models: [{ name: "qwen2.5vl:7b" }] }), { status: 200 }),
  });
  assert.equal(present.ok, true);
});

test("describeScreenshot records an error instead of throwing", async () => {
  const profile = getProfile("de-DE")!;
  const note = await describeScreenshot("does-not-exist.png", profile, { fetchImpl: async () => new Response("{}") });
  assert.equal(note.suggestions.length, 0);
  assert.ok(note.error);
});
