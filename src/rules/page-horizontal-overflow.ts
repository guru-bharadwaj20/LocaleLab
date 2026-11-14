import type { Rule } from "./types.js";

/** Tolerance in pixels; sub-pixel rounding should never produce a finding. */
const TOLERANCE_PX = 1;

export const pageHorizontalOverflow: Rule = {
  id: "page-horizontal-overflow",
  description: "The page is wider than the viewport, so a horizontal scrollbar appears.",
  caveat: "A horizontal canvas or wide data grid may be intentional.",
  run({ capture }) {
    const { evidence, profile } = capture;
    const widest = Math.max(evidence.scrollWidth, evidence.bodyScrollWidth);
    const overflowPx = widest - evidence.clientWidth;
    if (evidence.clientWidth <= 0 || overflowPx <= TOLERANCE_PX) return [];
    return [
      {
        rule: "page-horizontal-overflow",
        profileId: profile.id,
        severity: "warning",
        message: `Page content is ${overflowPx} px wider than the ${evidence.clientWidth} px viewport.`,
        evidence: {
          scrollWidth: widest,
          clientWidth: evidence.clientWidth,
          overflowPx,
          viewport: `${evidence.viewport.width}x${evidence.viewport.height}`,
        },
      },
    ];
  },
};
