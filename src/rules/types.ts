import type { Capture, Finding, RuleId } from "../types.js";

export interface RuleContext {
  /** The capture being checked. */
  capture: Capture;
  /** The first profile in the run; cross-profile rules compare against it. */
  baseline: Capture;
  /** Every capture in the run, in profile order. */
  captures: Capture[];
  isBaseline: boolean;
}

export interface Rule {
  id: RuleId;
  /** One sentence shown in the report legend. */
  description: string;
  /** The caveat engineers should keep in mind when reading findings from this rule. */
  caveat: string;
  run(context: RuleContext): Finding[];
}

/** Severity sort order used throughout the report. */
export const SEVERITY_RANK = { error: 0, warning: 1, info: 2 } as const;
