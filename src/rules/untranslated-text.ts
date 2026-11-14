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

/**
 * Function words that almost never survive into a translated string. Brand
 * names and product codes contain none of them, which keeps the heuristic quiet
 * on the strings that legitimately stay the same across locales.
 */
const ENGLISH_FUNCTION_WORDS = new Set([
  "the", "and", "with", "your", "you", "for", "from", "this", "that", "are", "our", "all", "has", "have",
  "will", "can", "not", "get", "add", "free", "new", "more", "about", "into", "when", "where", "what", "how",
  "learn", "sign", "view", "shop", "now", "here", "please", "thank", "thanks", "items", "item", "order", "cart",
  "account", "search", "help", "terms", "privacy", "contact", "shipping", "returns", "checkout", "continue",
]);

const MIN_WORDS = 3;
const MIN_FUNCTION_WORDS = 2;

/**
 * Guess whether a string is an English sentence or label. Needs at least three
 * words, Latin letters only, and two function words, so "Acme Studio Pro" and
 * "iPhone 15 Pro Max" never match while "Add to your cart" does.
 */
export function looksEnglish(text: string): boolean {
  if (/[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(text)) return false;
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (words.length < MIN_WORDS) return false;
  let hits = 0;
  for (const word of words) if (ENGLISH_FUNCTION_WORDS.has(word)) hits++;
  return hits >= MIN_FUNCTION_WORDS;
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
    const reported = new Set<string>();
    for (const el of capture.evidence.textElements) {
      if (el.ignored || !hasLetters(el.text)) continue;
      const counterpart = findCounterpart(el, index);
      if (!counterpart || counterpart.text !== el.text) continue;

      const matchedBy = el.id && index.byId.has(el.id) ? "data-localelab-id" : "path";
      if (el.mustTranslate) {
        reported.add(el.text);
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
            matchedBy,
            source: "marker",
          },
        });
        continue;
      }

      // Heuristic path: only for English baselines, and never twice for the same string.
      if (baseline.profile.language !== "en" || reported.has(el.text) || !looksEnglish(el.text)) continue;
      reported.add(el.text);
      findings.push({
        rule: "untranslated-text",
        profileId: capture.profile.id,
        severity: "warning",
        message: `"${truncate(el.text)}" reads as English and is identical to the ${baseline.profile.id} baseline.`,
        path: el.path,
        elementId: el.id,
        evidence: {
          text: el.text,
          baselineProfile: baseline.profile.id,
          baselineText: counterpart.text,
          matchedBy,
          source: "heuristic",
        },
      });
    }
    return findings;
  },
};
