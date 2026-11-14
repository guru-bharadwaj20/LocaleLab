import type { Capture, Evidence, MarkedValue, Profile, TextElement } from "../types.js";
import { getProfile } from "../profiles.js";

/** Build a text element with sane layout defaults; override what the test cares about. */
export function textElement(overrides: Partial<TextElement> & { text: string }): TextElement {
  const width = overrides.clientWidth ?? 200;
  const height = overrides.clientHeight ?? 24;
  return {
    path: "main > p:nth-of-type(1)",
    tag: "p",
    mustTranslate: false,
    ignored: false,
    rect: { x: 0, y: 0, width, height },
    clientWidth: width,
    scrollWidth: overrides.scrollWidth ?? width,
    clientHeight: height,
    scrollHeight: overrides.scrollHeight ?? height,
    overflowX: "visible",
    overflowY: "visible",
    textOverflow: "clip",
    whiteSpace: "normal",
    ...overrides,
  };
}

export function markedValue(
  overrides: Partial<MarkedValue> & { kind: MarkedValue["kind"]; rendered: string },
): MarkedValue {
  return {
    path: "main > span:nth-of-type(1)",
    marker: "2026-11-11",
    expected: null,
    alternatives: [],
    ignored: false,
    ...overrides,
  };
}

export function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    url: "http://localhost/",
    finalUrl: "http://localhost/",
    title: "Fixture",
    documentLang: "en",
    documentDir: null,
    computedDir: "ltr",
    viewport: { width: 1365, height: 900 },
    scrollWidth: 1365,
    clientWidth: 1365,
    bodyScrollWidth: 1365,
    textElements: [],
    markedValues: [],
    navigatorLanguage: "en-US",
    resolvedTimezone: "America/New_York",
    ...overrides,
  };
}

export function capture(
  profileId: string,
  evidenceOverrides: Partial<Evidence> = {},
  profileOverrides: Partial<Profile> = {},
): Capture {
  const profile = getProfile(profileId);
  if (!profile) throw new Error(`No built-in profile ${profileId}`);
  return {
    profile: { ...profile, ...profileOverrides },
    evidence: evidence({ documentLang: profile.language, computedDir: profile.direction, ...evidenceOverrides }),
    screenshot: `screenshots/${profileId}.png`,
    durationMs: 1,
  };
}
