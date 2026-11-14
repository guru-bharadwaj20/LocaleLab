import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_PROFILES,
  getProfile,
  parseAdHocProfile,
  resolveProfiles,
  UnknownProfileError,
} from "../profiles.js";

test("ships the eight documented built-in profiles", () => {
  const ids = BUILT_IN_PROFILES.map((p) => p.id);
  assert.deepEqual(ids, ["en-US", "en-GB", "de-DE", "fr-FR", "ja-JP", "ar-SA", "hi-IN", "es-ES"]);
});

test("every built-in profile has a valid IANA timezone", () => {
  for (const profile of BUILT_IN_PROFILES) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en", { timeZone: profile.timezone }), profile.id);
  }
});

test("only Arabic is right-to-left among the built-ins", () => {
  const rtl = BUILT_IN_PROFILES.filter((p) => p.direction === "rtl").map((p) => p.id);
  assert.deepEqual(rtl, ["ar-SA"]);
});

test("getProfile is case-insensitive and trims whitespace", () => {
  assert.equal(getProfile(" de-de ")?.id, "de-DE");
  assert.equal(getProfile("nope"), undefined);
});

test("resolveProfiles keeps order and drops duplicates", () => {
  const profiles = resolveProfiles("ja-JP, en-US, ja-JP");
  assert.deepEqual(
    profiles.map((p) => p.id),
    ["ja-JP", "en-US"],
  );
});

test("resolveProfiles falls back to the default matrix", () => {
  assert.deepEqual(
    resolveProfiles(undefined).map((p) => p.id),
    ["en-US", "de-DE", "ja-JP", "ar-SA"],
  );
});

test("resolveProfiles rejects unknown ids with a helpful error", () => {
  assert.throws(() => resolveProfiles("en-US,xx-YY"), UnknownProfileError);
});

test("ad-hoc profiles accept locale@timezone", () => {
  const profile = parseAdHocProfile("pt-BR@America/Sao_Paulo");
  assert.equal(profile?.locale, "pt-BR");
  assert.equal(profile?.timezone, "America/Sao_Paulo");
  assert.equal(profile?.language, "pt");
  assert.equal(profile?.direction, "ltr");

  const hebrew = parseAdHocProfile("he-IL@Asia/Jerusalem");
  assert.equal(hebrew?.direction, "rtl");

  assert.equal(parseAdHocProfile("not a profile"), undefined);
});
