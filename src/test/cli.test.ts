import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXIT_OK,
  EXIT_USAGE,
  formatFindings,
  formatSummaryLine,
  helpText,
  main,
  parseFailLevel,
  profilesText,
  readCommonOptions,
  shouldFail,
} from "../cli.js";
import { parseArgs } from "../cli-args.js";
import type { Finding } from "../types.js";

const warning: Finding = { rule: "text-clipping", profileId: "de-DE", severity: "warning", message: "clipped", evidence: {} };
const info: Finding = { rule: "document-language-mismatch", profileId: "de-DE", severity: "info", message: "no lang", evidence: {} };

test("--fail-on threshold decides the exit status", () => {
  assert.equal(parseFailLevel(undefined), "error");
  assert.equal(parseFailLevel("warning"), "warning");
  assert.throws(() => parseFailLevel("fatal"), /Invalid --fail-on/);
  assert.equal(shouldFail([warning, info], "error"), false);
  assert.equal(shouldFail([warning, info], "warning"), true);
  assert.equal(shouldFail([info], "info"), true);
  assert.equal(shouldFail([warning], "none"), false);
});

test("common options resolve defaults and short aliases", () => {
  const defaults = readCommonOptions(parseArgs([]).flags, "out-dir");
  assert.equal(defaults.outDir, "out-dir");
  assert.deepEqual(
    defaults.profiles.map((p) => p.id),
    ["en-US", "de-DE", "ja-JP", "ar-SA"],
  );
  assert.deepEqual(defaults.viewport, { width: 1365, height: 900 });
  assert.equal(defaults.timeoutMs, 20_000);
  assert.equal(defaults.failOn, "error");

  const custom = readCommonOptions(parseArgs(["-o", "x", "-p", "fr-FR,en-GB", "--viewport=800x600", "-t", "5000", "--headed", "--vision"]).flags, "out");
  assert.equal(custom.outDir, "x");
  assert.deepEqual(
    custom.profiles.map((p) => p.id),
    ["fr-FR", "en-GB"],
  );
  assert.deepEqual(custom.viewport, { width: 800, height: 600 });
  assert.equal(custom.timeoutMs, 5000);
  assert.equal(custom.headed, true);
  assert.equal(custom.vision, true);
});

test("summary and finding lines are compact and aligned", () => {
  assert.match(formatSummaryLine([warning, info], "report"), /^2 findings \(0 errors, 1 warnings, 1 info\)\. Report: report[\\/]index\.html$/);
  assert.match(formatSummaryLine([], "r"), /^0 findings/);
  const lines = formatFindings([warning, info]).split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0]!, /^ {2}warning de-DE {2}text-clipping/);
  assert.equal(formatFindings([]), "");
});

test("help, version and profiles print without touching a browser", async () => {
  const out: string[] = [];
  const log = (s: string) => out.push(s);
  assert.equal(await main(["help"], log), EXIT_OK);
  assert.match(out.join("\n"), /Usage/);
  assert.equal(await main(["--version"], log), EXIT_OK);
  assert.equal(out.at(-1), "0.1.0");
  assert.equal(await main(["profiles"], log), EXIT_OK);
  assert.match(out.at(-1) ?? "", /ar-SA/);
  assert.equal(await main([], log), EXIT_OK, "no arguments shows help");
  assert.match(helpText(), /data-localelab-currency/);
  assert.match(profilesText(), /Asia\/Tokyo/);
});

test("bad input exits with the usage code and a readable message", async () => {
  const out: string[] = [];
  const log = (s: string) => out.push(s);
  assert.equal(await main(["run"], log), EXIT_USAGE);
  assert.match(out.at(-1) ?? "", /Usage: localelab run/);
  assert.equal(await main(["run", "example.com", "--viewport", "huge"], log), EXIT_USAGE);
  assert.match(out.at(-1) ?? "", /Invalid --viewport/);
  assert.equal(await main(["run", "example.com", "--profiles", "zz-ZZ"], log), EXIT_USAGE);
  assert.match(out.at(-1) ?? "", /Unknown profile "zz-ZZ"/);
  assert.equal(await main(["run", "ftp://example.com"], log), EXIT_USAGE);
  assert.match(out.at(-1) ?? "", /Unsupported URL scheme/);
  assert.equal(await main(["nonsense"], log), EXIT_USAGE);
  assert.match(out.at(-1) ?? "", /Unknown command "nonsense"/);
});
