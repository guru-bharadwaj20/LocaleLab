import type { Capture, Finding, RuleId } from "../types.js";
import { SEVERITY_RANK, type Rule, type RuleContext } from "./types.js";
import { pageHorizontalOverflow } from "./page-horizontal-overflow.js";
import { textClipping } from "./text-clipping.js";
import { unresolvedCopy } from "./unresolved-copy.js";
import { untranslatedText } from "./untranslated-text.js";
import { formatCurrency, formatDate, formatNumber } from "./formatting.js";
import { documentLanguageMismatch, rtlDirectionMissing } from "./document-metadata.js";

export const RULES: readonly Rule[] = [
  pageHorizontalOverflow,
  textClipping,
  unresolvedCopy,
  untranslatedText,
  formatDate,
  formatNumber,
  formatCurrency,
  documentLanguageMismatch,
  rtlDirectionMissing,
];

export const RULE_BY_ID: ReadonlyMap<RuleId, Rule> = new Map(RULES.map((r) => [r.id, r]));

export type { Rule, RuleContext } from "./types.js";

/**
 * Run every rule against every successful capture. The first capture is the
 * baseline. Output is sorted by profile order, then severity, then rule id.
 */
export function runRules(captures: Capture[], rules: readonly Rule[] = RULES): Finding[] {
  const usable = captures.filter((c) => !c.error);
  const baseline = usable[0];
  if (!baseline) return [];

  const findings: Finding[] = [];
  for (const capture of usable) {
    const context: RuleContext = { capture, baseline, captures: usable, isBaseline: capture === baseline };
    for (const rule of rules) {
      try {
        findings.push(...rule.run(context));
      } catch (err) {
        // A rule crash should never hide the other rules' output.
        findings.push({
          rule: rule.id,
          profileId: capture.profile.id,
          severity: "info",
          message: `Rule ${rule.id} failed: ${err instanceof Error ? err.message : String(err)}`,
          evidence: { internalError: true },
        });
      }
    }
  }

  const profileOrder = new Map(captures.map((c, i) => [c.profile.id, i]));
  return findings.sort(
    (a, b) =>
      (profileOrder.get(a.profileId) ?? 0) - (profileOrder.get(b.profileId) ?? 0) ||
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.rule.localeCompare(b.rule) ||
      (a.path ?? "").localeCompare(b.path ?? ""),
  );
}

export function summariseFindings(findings: Finding[]): Record<"error" | "warning" | "info", number> {
  const summary = { error: 0, warning: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;
  return summary;
}
