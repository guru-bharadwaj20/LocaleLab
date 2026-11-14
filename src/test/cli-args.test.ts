import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ArgumentError,
  flagBoolean,
  flagString,
  normaliseUrl,
  parseArgs,
  parseTimeout,
  parseViewport,
} from "../cli-args.js";

test("parseArgs separates positionals from flags", () => {
  const parsed = parseArgs(["run", "https://example.com", "--profiles", "en-US,de-DE", "--out=./rep", "--headed"]);
  assert.deepEqual(parsed.positionals, ["run", "https://example.com"]);
  assert.equal(parsed.flags["profiles"], "en-US,de-DE");
  assert.equal(parsed.flags["out"], "./rep");
  assert.equal(parsed.flags["headed"], true);
});

test("parseArgs stops flag parsing after --", () => {
  const parsed = parseArgs(["demo", "--", "--not-a-flag"]);
  assert.deepEqual(parsed.positionals, ["demo", "--not-a-flag"]);
});

test("short aliases map to long flags", () => {
  const parsed = parseArgs(["run", "x", "-o", "out", "-p", "ja-JP", "-h"]);
  assert.equal(parsed.flags["out"], "out");
  assert.equal(parsed.flags["profiles"], "ja-JP");
  assert.equal(parsed.flags["help"], true);
});

test("flag helpers coerce types", () => {
  const { flags } = parseArgs(["--vision", "--wait-for", ".ready", "--quiet=false"]);
  assert.equal(flagBoolean(flags, "vision"), true);
  assert.equal(flagBoolean(flags, "quiet"), false);
  assert.equal(flagBoolean(flags, "missing"), false);
  assert.equal(flagString(flags, "wait-for"), ".ready");
  assert.equal(flagString(flags, "vision"), undefined);
});

test("parseViewport accepts WxH and defaults to 1365x900", () => {
  assert.deepEqual(parseViewport(undefined), { width: 1365, height: 900 });
  assert.deepEqual(parseViewport("1920x1080"), { width: 1920, height: 1080 });
  assert.deepEqual(parseViewport(" 390 X 844 "), { width: 390, height: 844 });
  assert.throws(() => parseViewport("wide"), ArgumentError);
  assert.throws(() => parseViewport("100x100"), ArgumentError);
});

test("parseTimeout requires a positive integer", () => {
  assert.equal(parseTimeout(undefined), 20_000);
  assert.equal(parseTimeout("5000"), 5000);
  assert.throws(() => parseTimeout("soon"), ArgumentError);
  assert.throws(() => parseTimeout("-1"), ArgumentError);
  assert.throws(() => parseTimeout("1.5"), ArgumentError);
});

test("normaliseUrl adds https and rejects odd schemes", () => {
  assert.equal(normaliseUrl("example.com/path"), "https://example.com/path");
  assert.equal(normaliseUrl("http://localhost:3000"), "http://localhost:3000/");
  assert.throws(() => normaliseUrl("javascript:alert(1)"), ArgumentError);
  assert.throws(() => normaliseUrl(""), ArgumentError);
});
