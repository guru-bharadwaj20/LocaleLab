import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunResult } from "../types.js";
import { summariseFindings } from "../rules/index.js";

export const RUN_FILE = "run.json";
export const FINDINGS_FILE = "findings.json";

/** The compact file most tooling wants: findings plus a summary, without the evidence dump. */
export function buildFindingsDocument(result: RunResult) {
  return {
    version: result.version,
    url: result.url,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    baselineProfileId: result.baselineProfileId,
    profiles: result.captures.map((c) => ({
      id: c.profile.id,
      locale: c.profile.locale,
      timezone: c.profile.timezone,
      screenshot: c.screenshot,
      durationMs: c.durationMs,
      error: c.error ?? null,
    })),
    summary: summariseFindings(result.findings),
    findings: result.findings,
  };
}

export interface JsonReportFiles {
  run: string;
  findings: string;
}

/** Write run.json (everything) and findings.json (the short version) into outDir. */
export async function writeJsonReport(result: RunResult, outDir: string): Promise<JsonReportFiles> {
  await mkdir(outDir, { recursive: true });
  const run = path.join(outDir, RUN_FILE);
  const findings = path.join(outDir, FINDINGS_FILE);
  await writeFile(run, JSON.stringify(result, null, 2) + "\n", "utf8");
  await writeFile(findings, JSON.stringify(buildFindingsDocument(result), null, 2) + "\n", "utf8");
  return { run, findings };
}
