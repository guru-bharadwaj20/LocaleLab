/**
 * Public API. The CLI is a thin layer over these exports, so anything the
 * command line can do, a script can do too:
 *
 *   import { runLocaleLab, resolveProfiles } from "localelab";
 *   const { result, outputs } = await runLocaleLab({
 *     url: "https://example.com",
 *     profiles: resolveProfiles("en-US,de-DE"),
 *     outDir: "report",
 *     viewport: { width: 1365, height: 900 },
 *     timeoutMs: 20000,
 *   });
 */
export type * from "./types.js";
export { VERSION } from "./version.js";
export { BUILT_IN_PROFILES, DEFAULT_PROFILE_IDS, UnknownProfileError, getProfile, parseAdHocProfile, resolveProfiles } from "./profiles.js";
export { DEFAULT_TIMEOUT_MS, DEFAULT_VIEWPORT } from "./cli-args.js";
export { computeExpectation, matchesExpectation, normaliseRendered } from "./intl.js";
export { captureAll, captureProfile, contextOptionsFor, launchBrowser } from "./capture.js";
export { RULES, RULE_BY_ID, runRules, summariseFindings } from "./rules/index.js";
export type { Rule, RuleContext } from "./rules/types.js";
export { renderHtmlReport, writeHtmlReport } from "./report/html.js";
export { buildFindingsDocument, writeJsonReport } from "./report/json.js";
export { renderPlaywrightSpec, writePlaywrightSpec } from "./export/playwright-spec.js";
export { assembleResult, runLocaleLab, writeOutputs } from "./run.js";
export type { CompletedRun, RunOutputs } from "./run.js";
export { fixtureDir, serveDirectory } from "./demo.js";
export { TRUTH_MATRIX, BENCHMARK_PROFILE_IDS, expectedObservations } from "./benchmark/truth.js";
export { scoreFindings } from "./benchmark/score.js";
export type { BenchmarkScore } from "./benchmark/score.js";
