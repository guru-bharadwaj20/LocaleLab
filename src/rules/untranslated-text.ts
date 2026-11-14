import type { Capture, Finding, TextElement } from "../types.js";
import type { Rule, RuleContext } from "./types.js";
import { truncate } from "./text-clipping.js";

/** Index a capture's text elements by stable id and by path for cross-profile lookup. */
export function indexTextElements(capture: Capture): { byId: Map<string, TextElement>; byPath: Map<string, TextElement> } {
  const byId = new Map<string, TextElement>();
  const byPath = new Map<string, TextElement>();
  for (const el of capture.evidence.textElements) {
    if (el.id && !byId.has(el.id)) byId.set(el.id, el);
    if (!byPath.has(el.path)) byPath.set(el.path, el);
  }
  return { byId, byPath };
}

export function findCounterpart(
  el: TextElement,
  index: ReturnType<typeof indexTextElements>,
): TextElement | undefined {
  if (el.id) {
    const byId = index.byId.get(el.id);
    if (byId) return byId;
  }
  return index.byPath.get(el.path);
}

/** Strings with no letters (prices, counts, icons) are never translation candidates. */
export function hasLetters(text: string): boolean {
  return /\p{L}/u.test(text);
}

export const untranslatedText: Rule = {
  id: "untranslated-text",
  description: "Text that must be translated is unchanged from the baseline profile.",
  caveat: "Explicit data-localelab-translate markers are errors; language heuristics are warnings and need review.",
  run(context: RuleContext) {
    const { capture, baseline, isBaseline } = context;
    if (isBaseline) return [];
    if (capture.profile.language === baseline.profile.language) return [];

    const index = indexTextElements(baseline);
    const findings: Finding[] = [];
    for (const el of capture.evidence.textElements) {
      if (el.ignored || !el.mustTranslate || !hasLetters(el.text)) continue;
      const counterpart = findCounterpart(el, index);
      if (!counterpart || counterpart.text !== el.text) continue;
      findings.push({
        rule: "untranslated-text",
        profileId: capture.profile.id,
        severity: "error",
        message: `"${truncate(el.text)}" is marked for translation but matches the ${baseline.profile.id} baseline.`,
        path: el.path,
        elementId: el.id,
        evidence: {
          text: el.text,
          baselineProfile: baseline.profile.id,
          baselineText: counterpart.text,
          matchedBy: el.id && index.byId.has(el.id) ? "data-localelab-id" : "path",
          source: "marker",
        },
      });
    }
    return findings;
  },
};
