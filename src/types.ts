/**
 * Shared types for LocaleLab.
 *
 * The flow is: Profile -> Capture (browser) -> Evidence (plain data) -> Rules -> Findings -> Report.
 * Everything after the capture step works on plain JSON so it can be unit tested without a browser.
 */

export type TextDirection = "ltr" | "rtl";
export type ColorScheme = "light" | "dark" | "no-preference";
export type ReducedMotion = "reduce" | "no-preference";

/** A browser profile: the "reality" a page is viewed under. */
export interface Profile {
  /** Stable identifier, e.g. "de-DE". Doubles as the BCP 47 locale tag for built-ins. */
  id: string;
  /** Human-friendly label shown in reports. */
  label: string;
  /** BCP 47 locale tag handed to the browser. */
  locale: string;
  /** IANA timezone identifier. */
  timezone: string;
  /** Expected document direction for this locale. */
  direction: TextDirection;
  /** Primary language subtag, used for the document-language check. */
  language: string;
  colorScheme?: ColorScheme;
  reducedMotion?: ReducedMotion;
}

export interface Viewport {
  width: number;
  height: number;
}

/** A visible text element observed in the page. */
export interface TextElement {
  /** Deterministic path to the element, e.g. "main > section:nth-of-type(2) > h2". */
  path: string;
  /** Value of data-localelab-id when present. */
  id?: string;
  tag: string;
  text: string;
  /** True when the element or an ancestor carries data-localelab-translate. */
  mustTranslate: boolean;
  /** True when the element or an ancestor carries data-localelab-ignore. */
  ignored: boolean;
  rect: { x: number; y: number; width: number; height: number };
  /** Layout numbers used by the clipping rule. */
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
  overflowX: string;
  overflowY: string;
  textOverflow: string;
  whiteSpace: string;
}

export type MarkerKind = "date" | "number" | "currency";

/** An element annotated with one of the opt-in formatting markers. */
export interface MarkedValue {
  kind: MarkerKind;
  path: string;
  id?: string;
  /** Raw marker attribute value, e.g. "2026-11-11T12:00:00Z" or "EUR:1234.56". */
  marker: string;
  /** Optional style hint from data-localelab-style. */
  style?: string;
  /** What the page actually rendered (trimmed). */
  rendered: string;
  /** What the browser's own Intl produced for the active profile. */
  expected: string | null;
  /** Alternative acceptable renderings (e.g. other date styles). */
  alternatives: string[];
  /** Set when the marker could not be parsed. */
  error?: string;
  ignored: boolean;
}

/** Everything the in-page extractor collects for one profile. */
export interface Evidence {
  url: string;
  finalUrl: string;
  title: string;
  documentLang: string | null;
  documentDir: string | null;
  /** Direction the browser actually resolved for <html>. */
  computedDir: TextDirection;
  viewport: Viewport;
  /** documentElement.scrollWidth */
  scrollWidth: number;
  /** documentElement.clientWidth */
  clientWidth: number;
  bodyScrollWidth: number;
  textElements: TextElement[];
  markedValues: MarkedValue[];
  /** navigator.language as seen by the page. */
  navigatorLanguage: string;
  /** Intl.DateTimeFormat().resolvedOptions().timeZone as seen by the page. */
  resolvedTimezone: string;
}

export type Severity = "error" | "warning" | "info";

export type RuleId =
  | "page-horizontal-overflow"
  | "text-clipping"
  | "unresolved-copy"
  | "untranslated-text"
  | "format-date"
  | "format-number"
  | "format-currency"
  | "document-language-mismatch"
  | "rtl-direction-missing";

export interface Finding {
  rule: RuleId;
  profileId: string;
  severity: Severity;
  /** One-line human summary. */
  message: string;
  /** Element path, when the finding is about a specific element. */
  path?: string;
  /** data-localelab-id, when present. */
  elementId?: string;
  /** Free-form evidence: rendered vs expected, measurements, matched pattern, etc. */
  evidence: Record<string, string | number | boolean | null>;
}

/** Result of capturing one profile. */
export interface Capture {
  profile: Profile;
  evidence: Evidence;
  /** Path of the full-page screenshot, relative to the report directory. */
  screenshot: string;
  /** Wall-clock duration of the capture in milliseconds. */
  durationMs: number;
  error?: string;
}

export interface RunOptions {
  url: string;
  profiles: Profile[];
  outDir: string;
  viewport: Viewport;
  timeoutMs: number;
  waitFor?: string;
  /** Launch the browser with a visible window. Mostly for debugging. */
  headed?: boolean;
  /** Called after each profile is captured. */
  onProgress?: (message: string) => void;
}

export interface RunResult {
  version: string;
  url: string;
  startedAt: string;
  finishedAt: string;
  viewport: Viewport;
  baselineProfileId: string;
  captures: Capture[];
  findings: Finding[];
}
