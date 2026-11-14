#!/usr/bin/env node
import path from "node:path";
import {
  ArgumentError,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_VIEWPORT,
  flagBoolean,
  flagString,
  normaliseUrl,
  parseArgs,
  parseTimeout,
  parseViewport,
} from "./cli-args.js";
import { BUILT_IN_PROFILES, DEFAULT_PROFILE_IDS, UnknownProfileError, resolveProfiles } from "./profiles.js";
import { runLocaleLab } from "./run.js";
import { summariseFindings } from "./rules/index.js";
import { VERSION } from "./version.js";
import type { Finding, RunOptions } from "./types.js";

export const EXIT_OK = 0;
export const EXIT_FINDINGS = 1;
export const EXIT_USAGE = 2;
export const EXIT_FAILURE = 3;

export function helpText(): string {
  return `LocaleLab ${VERSION}: capture a page under several locale profiles and report what broke.

Usage
  localelab run <url> [options]      Capture, analyse and write a report
  localelab demo [options]           Serve the bundled storefront fixture and run against it
  localelab benchmark [options]      Score LocaleLab against the fixture's known defects
  localelab profiles                 List built-in profiles
  localelab help | --help            Show this text
  localelab version | --version      Print the version

Options
  -o, --out <dir>         Output directory (default: ./localelab-report)
  -p, --profiles <list>   Comma-separated profile ids (default: ${DEFAULT_PROFILE_IDS.join(",")})
                          Ad-hoc profiles: <locale>@<IANA timezone>, e.g. pt-BR@America/Sao_Paulo
      --viewport <WxH>    Viewport in CSS pixels (default: ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height})
  -t, --timeout <ms>      Navigation timeout per profile (default: ${DEFAULT_TIMEOUT_MS})
      --wait-for <css>    Wait for a selector before capturing
      --headed            Show the browser window
      --fail-on <level>   Exit 1 when findings at or above this level exist: error (default), warning, info, none
      --quiet             Only print the summary line
      --vision            (benchmark/demo) Add a local vision-model pass via Ollama for screenshot review

Exit codes
  0 no findings at the --fail-on level   1 findings   2 bad arguments   3 run failed

Markers (opt-in attributes on your HTML)
  data-localelab-date="2026-11-11T12:00:00Z" [data-localelab-style="long"]
  data-localelab-number="1234567.89"
  data-localelab-currency="EUR:1234.56"
  data-localelab-translate      This text must differ between languages
  data-localelab-ignore         Skip this subtree
  data-localelab-id="hero-cta"  Stable id for cross-profile matching
`;
}

export function profilesText(): string {
  const width = Math.max(...BUILT_IN_PROFILES.map((p) => p.id.length));
  const lines = BUILT_IN_PROFILES.map(
    (p) => `  ${p.id.padEnd(width)}  ${p.label.padEnd(24)} ${p.locale.padEnd(6)} ${p.timezone.padEnd(20)} ${p.direction}`,
  );
  return `Built-in profiles (default: ${DEFAULT_PROFILE_IDS.join(", ")})\n${lines.join("\n")}\n`;
}

export type FailLevel = "error" | "warning" | "info" | "none";

export function parseFailLevel(spec: string | undefined): FailLevel {
  if (spec === undefined) return "error";
  if (spec === "error" || spec === "warning" || spec === "info" || spec === "none") return spec;
  throw new ArgumentError(`Invalid --fail-on "${spec}". Use error, warning, info or none.`);
}

export function shouldFail(findings: Finding[], level: FailLevel): boolean {
  if (level === "none") return false;
  const rank = { error: 0, warning: 1, info: 2 } as const;
  return findings.some((f) => rank[f.severity] <= rank[level]);
}

export function formatSummaryLine(findings: Finding[], outDir: string): string {
  const s = summariseFindings(findings);
  return `${findings.length} finding${findings.length === 1 ? "" : "s"} (${s.error} errors, ${s.warning} warnings, ${s.info} info). Report: ${path.join(
    outDir,
    "index.html",
  )}`;
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return "";
  const width = Math.max(...findings.map((f) => f.profileId.length));
  return findings
    .map((f) => `  ${f.severity.padEnd(7)} ${f.profileId.padEnd(width)}  ${f.rule.padEnd(27)} ${f.message}`)
    .join("\n");
}

interface CommonOptions {
  outDir: string;
  profiles: ReturnType<typeof resolveProfiles>;
  viewport: ReturnType<typeof parseViewport>;
  timeoutMs: number;
  waitFor: string | undefined;
  headed: boolean;
  quiet: boolean;
  failOn: FailLevel;
  vision: boolean;
}

export function readCommonOptions(flags: ReturnType<typeof parseArgs>["flags"], defaultOut: string): CommonOptions {
  return {
    outDir: flagString(flags, "out") ?? flagString(flags, "o") ?? defaultOut,
    profiles: resolveProfiles(flagString(flags, "profiles") ?? flagString(flags, "p")),
    viewport: parseViewport(flagString(flags, "viewport")),
    timeoutMs: parseTimeout(flagString(flags, "timeout") ?? flagString(flags, "t")),
    waitFor: flagString(flags, "wait-for"),
    headed: flagBoolean(flags, "headed"),
    quiet: flagBoolean(flags, "quiet"),
    failOn: parseFailLevel(flagString(flags, "fail-on")),
    vision: flagBoolean(flags, "vision"),
  };
}

export function buildRunOptions(url: string, common: CommonOptions, log: (line: string) => void): RunOptions {
  return {
    url,
    profiles: common.profiles,
    outDir: common.outDir,
    viewport: common.viewport,
    timeoutMs: common.timeoutMs,
    waitFor: common.waitFor,
    headed: common.headed,
    onProgress: common.quiet ? undefined : log,
  };
}

async function commandRun(positionals: string[], flags: ReturnType<typeof parseArgs>["flags"], log: (s: string) => void): Promise<number> {
  const rawUrl = positionals[0];
  if (!rawUrl) throw new ArgumentError("Usage: localelab run <url> [options]");
  const url = normaliseUrl(rawUrl);
  const common = readCommonOptions(flags, "localelab-report");
  const { result, outputs } = await runLocaleLab(buildRunOptions(url, common, log));
  if (!common.quiet) log(formatFindings(result.findings));
  log(formatSummaryLine(result.findings, outputs.outDir));
  const failedCaptures = result.captures.filter((c) => c.error);
  if (failedCaptures.length === result.captures.length) {
    log("Every profile failed to capture; see the report for details.");
    return EXIT_FAILURE;
  }
  return shouldFail(result.findings, common.failOn) ? EXIT_FINDINGS : EXIT_OK;
}

export async function main(argv: readonly string[], log: (line: string) => void = console.log): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    return EXIT_USAGE;
  }
  const { positionals, flags } = parsed;
  const command = positionals[0] ?? (flags.version || flags.v ? "version" : "help");

  try {
    switch (command) {
      case "help":
        log(helpText());
        return EXIT_OK;
      case "version":
        log(VERSION);
        return EXIT_OK;
      case "profiles":
        log(profilesText());
        return EXIT_OK;
      case "run":
        return await commandRun(positionals.slice(1), flags, log);
      case "demo": {
        const { commandDemo } = await import("./demo.js");
        return await commandDemo(flags, log);
      }
      case "benchmark": {
        const { commandBenchmark } = await import("./benchmark/index.js");
        return await commandBenchmark(flags, log);
      }
      default:
        if (/^(https?:\/\/|file:|[a-z0-9.-]+\.[a-z]{2,})/i.test(command)) {
          // `localelab example.com` is a common slip; treat it as `run`.
          return await commandRun(positionals, flags, log);
        }
        log(`Unknown command "${command}".\n\n${helpText()}`);
        return EXIT_USAGE;
    }
  } catch (err) {
    if (err instanceof ArgumentError || err instanceof UnknownProfileError) {
      log(err.message);
      return EXIT_USAGE;
    }
    log(`LocaleLab failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    return EXIT_FAILURE;
  }
}

const invokedDirectly = process.argv[1] !== undefined && /[\\/]cli\.js$/.test(process.argv[1]);
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err);
      process.exitCode = EXIT_FAILURE;
    },
  );
}
