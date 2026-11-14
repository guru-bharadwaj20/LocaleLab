import type { Finding, Severity } from "../types.js";
import type { Rule } from "./types.js";
import { truncate } from "./text-clipping.js";

export interface CopyPattern {
  name: string;
  severity: Severity;
  /** Returns the offending fragment or null. */
  match(text: string): string | null;
}

const TLDS = new Set([
  "com", "org", "net", "io", "dev", "app", "co", "uk", "de", "fr", "jp", "in", "es", "sa", "edu", "gov", "info", "biz",
  "me", "tv", "ai", "us", "eu", "ca", "au", "nl", "se", "ch", "it", "br", "ru", "cn", "xyz", "site", "online", "store",
]);
const FILE_EXTENSIONS = new Set([
  "js", "mjs", "cjs", "ts", "css", "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "html", "htm", "pdf", "json",
  "xml", "zip", "txt", "md", "mp4", "mp3", "woff", "woff2", "ttf", "csv", "exe", "dmg", "apk", "yml", "yaml",
]);

/** A dotted lowercase token such as checkout.cta.label, excluding domains, files and versions. */
export function looksLikeI18nKey(token: string): boolean {
  const clean = token.replace(/^[(\["'“‘]+|[)\]"'”’.,:;!?]+$/g, "");
  if (clean.length < 6 || /\s/.test(clean)) return false;
  if (/^\d/.test(clean) || clean.includes("@") || clean.includes("/")) return false;
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/i.test(clean)) return false;
  const segments = clean.split(".");
  if (segments.length < 2) return false;
  const last = segments[segments.length - 1]!.toLowerCase();
  if (TLDS.has(last) || FILE_EXTENSIONS.has(last)) return false;
  if (segments.every((s) => /^\d+$/.test(s))) return false;
  // "e.g" and "i.e" style abbreviations.
  if (segments.every((s) => s.length <= 2)) return false;
  // One dot needs a clearly key-shaped body (underscore or camelCase or long enough) to count.
  if (segments.length === 2) {
    return /[_-]/.test(clean) || /[a-z][A-Z]/.test(clean) || clean.length >= 14;
  }
  return true;
}

export const COPY_PATTERNS: CopyPattern[] = [
  {
    name: "mustache-placeholder",
    severity: "error",
    match: (t) => /\{\{\s*[\w.\-]+\s*\}\}/.exec(t)?.[0] ?? null,
  },
  {
    name: "icu-placeholder",
    severity: "error",
    match: (t) =>
      /\{\s*(?:\d+|[A-Za-z_]\w*)\s*(?:,\s*(?:plural|select|selectordinal|number|date|time)[^{}]*(?:\{[^{}]*\}[^{}]*)*)?\}/.exec(t)?.[0] ??
      null,
  },
  {
    name: "printf-placeholder",
    severity: "error",
    match: (t) => /%(?:\d+\$)?[sdif](?![A-Za-z])/.exec(t)?.[0] ?? null,
  },
  {
    name: "missing-translation-marker",
    severity: "error",
    match: (t) =>
      /\[missing\s+["']?[\w.\-:]+["']?\s+translation\]|\bmissing translation\b|\btranslation missing\b|^\[\[?[\w.\-:]+\]\]?$/i.exec(
        t,
      )?.[0] ?? null,
  },
  {
    name: "i18n-key",
    severity: "error",
    match: (t) => t.split(/\s+/).find((token) => looksLikeI18nKey(token)) ?? null,
  },
  {
    name: "constant-key",
    severity: "error",
    match: (t) => /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}\b/.exec(t)?.[0] ?? null,
  },
  {
    name: "todo-marker",
    severity: "warning",
    match: (t) => /\b(?:TODO|FIXME|TBD|PLACEHOLDER)\b/.exec(t)?.[0] ?? null,
  },
  {
    name: "lorem-ipsum",
    severity: "warning",
    match: (t) => /\blorem ipsum\b/i.exec(t)?.[0] ?? null,
  },
];

export function findUnresolvedCopy(text: string): { pattern: CopyPattern; fragment: string } | null {
  for (const pattern of COPY_PATTERNS) {
    const fragment = pattern.match(text);
    if (fragment) return { pattern, fragment };
  }
  return null;
}

export const unresolvedCopy: Rule = {
  id: "unresolved-copy",
  description: "Visible placeholders, TODO markers or raw translation keys remain in the page copy.",
  caveat: "The pattern may occasionally match legitimate sample text or technical identifiers.",
  run({ capture }) {
    // Nested elements repeat their parent's text; keep one finding per fragment, from the smallest element.
    const best = new Map<string, Finding & { textLength: number }>();
    for (const el of capture.evidence.textElements) {
      if (el.ignored) continue;
      const hit = findUnresolvedCopy(el.text);
      if (!hit) continue;
      const key = `${hit.pattern.name}:${hit.fragment}`;
      const existing = best.get(key);
      if (existing && existing.textLength <= el.text.length) continue;
      best.set(key, {
        textLength: el.text.length,
        rule: "unresolved-copy",
        profileId: capture.profile.id,
        severity: hit.pattern.severity,
        message: `Unresolved copy "${hit.fragment}" (${hit.pattern.name}) in "${truncate(el.text)}".`,
        path: el.path,
        elementId: el.id,
        evidence: { pattern: hit.pattern.name, fragment: hit.fragment, text: el.text },
      });
    }
    return Array.from(best.values()).map(({ textLength: _ignored, ...finding }) => finding);
  },
};
