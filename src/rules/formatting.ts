import type { Finding, MarkedValue, MarkerKind, RuleId } from "../types.js";
import { matchesExpectation, normaliseRendered } from "../intl.js";
import type { Rule, RuleContext } from "./types.js";

const RULE_FOR_KIND: Record<MarkerKind, RuleId> = {
  date: "format-date",
  number: "format-number",
  currency: "format-currency",
};

const LABEL_FOR_KIND: Record<MarkerKind, string> = {
  date: "Date",
  number: "Number",
  currency: "Currency",
};

/** Evaluate one marked value against the browser's Intl output. */
export function checkMarkedValue(value: MarkedValue, profileId: string): Finding | null {
  if (value.ignored) return null;
  const rule = RULE_FOR_KIND[value.kind];
  if (value.error || value.expected === null) {
    return {
      rule,
      profileId,
      severity: "info",
      message: `${LABEL_FOR_KIND[value.kind]} marker "${value.marker}" could not be interpreted: ${value.error ?? "no expectation"}.`,
      path: value.path,
      elementId: value.id,
      evidence: { marker: value.marker, rendered: value.rendered, error: value.error ?? null },
    };
  }
  if (matchesExpectation(value.rendered, { expected: value.expected, alternatives: value.alternatives })) return null;
  return {
    rule,
    profileId,
    severity: "error",
    message: `${LABEL_FOR_KIND[value.kind]} rendered as "${value.rendered}" but the browser locale formats it as "${normaliseRendered(value.expected)}".`,
    path: value.path,
    elementId: value.id,
    evidence: {
      marker: value.marker,
      style: value.style ?? null,
      rendered: value.rendered,
      expected: value.expected,
      alternatives: value.alternatives.join(" | "),
    },
  };
}

function makeRule(kind: MarkerKind, description: string): Rule {
  return {
    id: RULE_FOR_KIND[kind],
    description,
    caveat: "Only values with explicit data-localelab markers are checked; unmarked text is never compared.",
    run({ capture }: RuleContext) {
      const findings: Finding[] = [];
      for (const value of capture.evidence.markedValues) {
        if (value.kind !== kind) continue;
        const finding = checkMarkedValue(value, capture.profile.id);
        if (finding) findings.push(finding);
      }
      return findings;
    },
  };
}

export const formatDate = makeRule("date", "A marked date differs from the browser's Intl output for the active locale and timezone.");
export const formatNumber = makeRule("number", "A marked number uses separators that differ from the browser locale.");
export const formatCurrency = makeRule("currency", "A marked currency value differs from the browser's Intl currency output.");
