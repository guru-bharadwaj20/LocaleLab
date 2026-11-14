import path from "node:path";
import type { Capture, RunOptions, RunResult } from "./types.js";
import { captureAll } from "./capture.js";
import { runRules } from "./rules/index.js";
import { writeJsonReport } from "./report/json.js";
import { writeHtmlReport } from "./report/html.js";
import { writePlaywrightSpec } from "./export/playwright-spec.js";
import { VERSION } from "./version.js";

export interface RunOutputs {
  outDir: string;
  html: string;
  findings: string;
  run: string;
  spec: string;
}

export interface CompletedRun {
  result: RunResult;
  outputs: RunOutputs;
}

/** Turn captures into a RunResult without touching the filesystem. Used by the benchmark too. */
export function assembleResult(options: Pick<RunOptions, "url" | "viewport">, captures: Capture[], startedAt: Date): RunResult {
  const usable = captures.find((c) => !c.error) ?? captures[0];
  return {
    version: VERSION,
    url: options.url,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    viewport: options.viewport,
    baselineProfileId: usable?.profile.id ?? "",
    captures,
    findings: runRules(captures),
  };
}

export async function writeOutputs(result: RunResult, outDir: string): Promise<RunOutputs> {
  const [html, json, spec] = await Promise.all([
    writeHtmlReport(result, outDir),
    writeJsonReport(result, outDir),
    writePlaywrightSpec(result, outDir),
  ]);
  return { outDir: path.resolve(outDir), html, findings: json.findings, run: json.run, spec };
}

/** The whole pipeline: capture every profile, run the rules, write every output. */
export async function runLocaleLab(options: RunOptions): Promise<CompletedRun> {
  if (options.profiles.length === 0) throw new Error("At least one profile is required.");
  const startedAt = new Date();
  const captures = await captureAll(options);
  const result = assembleResult(options, captures, startedAt);
  const outputs = await writeOutputs(result, options.outDir);
  return { result, outputs };
}
