import type { RuleId } from "../types.js";

/**
 * One planted defect in the storefront fixture and where LocaleLab must see it.
 *
 * The profile list is not "every profile but the baseline". It follows what the
 * browser's own Intl data does: ja-JP groups numbers and places the dollar sign
 * exactly like en-US, so a hard-coded US number or price is not wrong there and
 * must not be flagged.
 */
export interface TruthEntry {
  /** Short name used in the benchmark table. */
  defect: string;
  rule: RuleId;
  /** data-localelab-id of the element carrying the defect. */
  elementId: string;
  /** Profiles in which the defect is observable. */
  profiles: readonly string[];
  why: string;
}

export const BENCHMARK_PROFILE_IDS = ["en-US", "de-DE", "ja-JP", "ar-SA"] as const;

export const TRUTH_MATRIX: readonly TruthEntry[] = [
  {
    defect: "date-format",
    rule: "format-date",
    elementId: "promo-ends",
    profiles: ["de-DE", "ja-JP", "ar-SA"],
    why: "The sale date is hard-coded as 'Nov 11, 2026'; every non-US profile formats it differently.",
  },
  {
    defect: "number-format",
    rule: "format-number",
    elementId: "reviews-count",
    profiles: ["de-DE", "ar-SA"],
    why: "German swaps the separators and ar-SA uses Arabic-Indic digits; ja-JP groups exactly like en-US.",
  },
  {
    defect: "currency-format",
    rule: "format-currency",
    elementId: "hero-price",
    profiles: ["de-DE", "ar-SA"],
    why: "German puts the symbol after the amount, ar-SA changes digits and symbol; ja-JP renders USD like en-US.",
  },
  {
    defect: "clipped-translation",
    rule: "text-clipping",
    elementId: "shipping-badge",
    profiles: ["de-DE", "ar-SA"],
    why: "The badge is sized for English. German and Arabic strings are longer and get cut; Japanese is shorter.",
  },
  {
    defect: "unresolved-key",
    rule: "unresolved-copy",
    elementId: "checkout-cta",
    profiles: [...BENCHMARK_PROFILE_IDS],
    why: "checkout.cta.label is missing from every dictionary, so the raw key leaks in all four profiles.",
  },
  {
    defect: "untranslated-signin",
    rule: "untranslated-text",
    elementId: "signin",
    profiles: ["de-DE", "ja-JP", "ar-SA"],
    why: "The marked 'Sign in' label is identical to the baseline in every other language.",
  },
];

/** Flattened (profile, rule, element) expectations; the benchmark counts these. */
export interface ExpectedObservation {
  defect: string;
  profileId: string;
  rule: RuleId;
  elementId: string;
}

export function expectedObservations(matrix: readonly TruthEntry[] = TRUTH_MATRIX): ExpectedObservation[] {
  const out: ExpectedObservation[] = [];
  for (const entry of matrix) {
    for (const profileId of entry.profiles) {
      out.push({ defect: entry.defect, profileId, rule: entry.rule, elementId: entry.elementId });
    }
  }
  return out;
}
