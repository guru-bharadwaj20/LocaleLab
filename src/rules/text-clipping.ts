import type { Finding, TextElement } from "../types.js";
import type { Rule } from "./types.js";

const CLIPPING_OVERFLOW = new Set(["hidden", "clip"]);
const H_TOLERANCE_PX = 1;
const V_TOLERANCE_PX = 2;

export interface ClipAssessment {
  horizontal: boolean;
  vertical: boolean;
  hiddenPx: number;
}

/** Decide whether an element visibly cuts off its own text. */
export function assessClipping(el: TextElement): ClipAssessment {
  // Inline boxes report 0 client size and cannot clip their own content.
  const horizontal =
    el.clientWidth > 0 &&
    (CLIPPING_OVERFLOW.has(el.overflowX) || el.textOverflow === "ellipsis") &&
    el.scrollWidth > el.clientWidth + H_TOLERANCE_PX;
  const vertical =
    el.clientHeight > 0 && CLIPPING_OVERFLOW.has(el.overflowY) && el.scrollHeight > el.clientHeight + V_TOLERANCE_PX;
  const hiddenPx = Math.max(horizontal ? el.scrollWidth - el.clientWidth : 0, vertical ? el.scrollHeight - el.clientHeight : 0);
  return { horizontal, vertical, hiddenPx };
}

export const textClipping: Rule = {
  id: "text-clipping",
  description: "A visible text element is wider or taller than the box that hides its overflow.",
  caveat: "Intentionally truncated labels (text-overflow: ellipsis) and scrollable controls can be flagged.",
  run({ capture }) {
    const findings: Finding[] = [];
    for (const el of capture.evidence.textElements) {
      if (el.ignored) continue;
      const clip = assessClipping(el);
      if (!clip.horizontal && !clip.vertical) continue;
      const axis = clip.horizontal && clip.vertical ? "horizontally and vertically" : clip.horizontal ? "horizontally" : "vertically";
      findings.push({
        rule: "text-clipping",
        profileId: capture.profile.id,
        severity: el.mustTranslate ? "error" : "warning",
        message: `"${truncate(el.text)}" is clipped ${axis} by ${clip.hiddenPx} px.`,
        path: el.path,
        elementId: el.id,
        evidence: {
          text: el.text,
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          overflowX: el.overflowX,
          overflowY: el.overflowY,
          textOverflow: el.textOverflow,
          whiteSpace: el.whiteSpace,
          mustTranslate: el.mustTranslate,
        },
      });
    }
    return findings;
  },
};

export function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
