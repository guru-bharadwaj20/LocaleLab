/**
 * Intl expectation helpers.
 *
 * IMPORTANT: `computeExpectation` and `normaliseRendered` are serialised with
 * Function.prototype.toString() and evaluated INSIDE the captured page so the
 * comparison uses the browser's own Intl data. They must therefore be
 * self-contained: no imports, no references to module-level values.
 */

export type ExpectationKind = "date" | "number" | "currency";

export interface Expectation {
  expected: string | null;
  alternatives: string[];
  error?: string;
}

/** Collapse whitespace variants and strip bidi control characters before comparing. */
export function normaliseRendered(text: string): string {
  return text
    .replace(/[‎‏؜‪-‮⁦-⁩]/g, "")
    .replace(/[    ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute what a correctly localised page should have rendered for a marker.
 * `expected` is the preferred rendering; `alternatives` are other renderings
 * that are also acceptable (for example other date styles when none was given).
 */
export function computeExpectation(
  kind: ExpectationKind,
  marker: string,
  style: string | undefined,
  locale: string,
  timezone: string,
): Expectation {
  const unique = (items: Array<string | null | undefined>): string[] => {
    const out: string[] = [];
    for (const item of items) {
      if (typeof item === "string" && item.length > 0 && !out.includes(item)) out.push(item);
    }
    return out;
  };

  const safe = (fn: () => string): string | null => {
    try {
      return fn();
    } catch {
      return null;
    }
  };

  if (kind === "date") {
    const raw = marker.trim();
    const time = Date.parse(raw);
    if (Number.isNaN(time)) {
      return { expected: null, alternatives: [], error: `Unparseable ISO date "${raw}"` };
    }
    const date = new Date(time);
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
    const styles = ["full", "long", "medium", "short"] as const;
    type DateStyle = (typeof styles)[number];
    const chosen = styles.includes(style as DateStyle) ? (style as DateStyle) : undefined;

    const fmt = (dateStyle: DateStyle, timeStyle?: DateStyle): string | null =>
      safe(() =>
        new Intl.DateTimeFormat(locale, {
          dateStyle,
          ...(timeStyle ? { timeStyle } : {}),
          // A bare YYYY-MM-DD is a calendar date; format it in UTC so it never shifts a day.
          timeZone: dateOnly ? "UTC" : timezone,
        }).format(date),
      );

    if (chosen) {
      const expected = fmt(chosen);
      return {
        expected,
        alternatives: unique([fmt(chosen, "short"), fmt(chosen, "medium")]),
      };
    }

    const expected = fmt("medium");
    const alternatives: Array<string | null> = [];
    for (const s of styles) {
      alternatives.push(fmt(s));
      if (!dateOnly) {
        alternatives.push(fmt(s, "short"), fmt(s, "medium"));
      }
    }
    return { expected, alternatives: unique(alternatives).filter((a) => a !== expected) };
  }

  if (kind === "number") {
    const raw = marker.trim();
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return { expected: null, alternatives: [], error: `Unparseable number "${raw}"` };
    }
    const decimals = (raw.split(".")[1] ?? "").length;
    const expected = safe(() => new Intl.NumberFormat(locale).format(value));
    const alternatives = unique([
      safe(() => new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)),
      safe(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)),
      safe(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)),
      style === "percent" ? safe(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value)) : null,
    ]).filter((a) => a !== expected);
    return { expected, alternatives };
  }

  // currency: "EUR:1234.56"
  const match = /^\s*([A-Za-z]{3})\s*[:\s]\s*(-?[0-9]+(?:\.[0-9]+)?)\s*$/.exec(marker);
  if (!match) {
    return { expected: null, alternatives: [], error: `Expected "<ISO-4217 code>:<amount>", got "${marker}"` };
  }
  const currency = match[1]!.toUpperCase();
  const amount = Number(match[2]);
  const make = (currencyDisplay: "symbol" | "narrowSymbol" | "code" | "name"): string | null =>
    safe(() => new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay }).format(amount));
  const expected = make("symbol");
  if (expected === null) {
    return { expected: null, alternatives: [], error: `Unknown currency code "${currency}"` };
  }
  const alternatives = unique([make("narrowSymbol"), make("code"), make("name")]).filter((a) => a !== expected);
  return { expected, alternatives };
}

/** True when `rendered` matches the expectation (after normalisation). */
export function matchesExpectation(rendered: string, expectation: Expectation): boolean {
  if (expectation.expected === null) return false;
  const actual = normaliseRendered(rendered);
  if (actual === normaliseRendered(expectation.expected)) return true;
  return expectation.alternatives.some((alt) => normaliseRendered(alt) === actual);
}
