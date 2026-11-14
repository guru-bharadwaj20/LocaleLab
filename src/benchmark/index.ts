import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { parseArgs } from "./../cli-args.js";
import { buildRunOptions, EXIT_FAILURE, EXIT_FINDINGS, EXIT_OK, readCommonOptions } from "../cli.js";
import { fixtureDir, serveDirectory } from "../demo.js";
import { getProfile } from "../profiles.js";
import { runLocaleLab } from "../run.js";
import { renderMatrix, renderScoreSummary, scoreFindings, type BenchmarkScore } from "./score.js";
import { BENCHMARK_PROFILE_IDS, TRUTH_MATRIX } from "./truth.js";

export const BENCHMARK_FILE = "benchmark.json";

export function benchmarkProfiles() {
  return BENCHMARK_PROFILE_IDS.map((id) => {
    const profile = getProfile(id);
    if (!profile) throw new Error(`Benchmark profile ${id} is not built in.`);
    return profile;
  });
}

export function buildBenchmarkDocument(score: BenchmarkScore, url: string, vision: unknown) {
  return {
    url,
    profiles: BENCHMARK_PROFILE_IDS,
    truthMatrix: TRUTH_MATRIX,
    summary: {
      expected: score.expected,
      detected: score.detected,
      defectTypes: score.defectTypes,
      defectTypesDetected: score.defectTypesDetected,
      falsePositives: score.falsePositives.length,
      falseNegatives: score.falseNegatives.length,
      precision: score.precision,
      recall: score.recall,
    },
    observations: score.observations.map((o) => ({
      defect: o.defect,
      profileId: o.profileId,
      rule: o.rule,
      elementId: o.elementId,
      detected: o.detected,
      message: o.finding?.message ?? null,
    })),
    falsePositives: score.falsePositives,
    falseNegatives: score.falseNegatives.map(({ finding: _finding, ...rest }) => rest),
    vision: vision ?? null,
    caveat:
      "Synthetic smoke benchmark over one fixture. A perfect score means the rules caught the planted defects without extra findings here; it says nothing about precision or recall on real sites.",
  };
}

export async function commandBenchmark(flags: ReturnType<typeof parseArgs>["flags"], log: (line: string) => void): Promise<number> {
  const common = readCommonOptions(flags, "localelab-benchmark-report");
  // The truth matrix is written for these four profiles at this viewport; anything else is not comparable.
  common.profiles = benchmarkProfiles();
  const server = await serveDirectory(fixtureDir());
  log(`Serving the benchmark fixture at ${server.url}`);
  try {
    const { result, outputs } = await runLocaleLab(buildRunOptions(server.url, common, log));
    if (result.captures.some((c) => c.error)) {
      for (const c of result.captures.filter((x) => x.error)) log(`Capture failed for ${c.profile.id}: ${c.error}`);
      return EXIT_FAILURE;
    }
    const score = scoreFindings(result.findings);

    log("");
    log(renderMatrix(score, BENCHMARK_PROFILE_IDS));
    log("");
    log(renderScoreSummary(score));
    if (score.falsePositives.length > 0) {
      log("\nFalse positives:");
      for (const f of score.falsePositives) log(`  ${f.severity} ${f.profileId} ${f.rule} ${f.path ?? ""} ${f.message}`);
    }
    if (score.falseNegatives.length > 0) {
      log("\nFalse negatives:");
      for (const o of score.falseNegatives) log(`  ${o.profileId} ${o.rule} #${o.elementId} (${o.defect})`);
    }

    let vision: unknown = null;
    if (common.vision) {
      const { describeScreenshots, formatVisionNotes } = await import("./vision.js");
      const notes = await describeScreenshots(result, outputs.outDir, log);
      log("");
      log(formatVisionNotes(notes));
      vision = notes;
    }

    const file = path.join(outputs.outDir, BENCHMARK_FILE);
    await writeFile(file, JSON.stringify(buildBenchmarkDocument(score, server.url, vision), null, 2) + "\n", "utf8");
    log(`\nReport: ${outputs.html}\nBenchmark data: ${file}`);
    log("This is a synthetic smoke benchmark over one fixture, not a measure of real-world accuracy.");

    return score.falsePositives.length === 0 && score.falseNegatives.length === 0 ? EXIT_OK : EXIT_FINDINGS;
  } finally {
    await server.close();
  }
}
