import type { Rule } from "./types.js";

/** "de-DE" -> "de"; "zh-Hant-TW" -> "zh". */
export function primaryLanguage(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const primary = tag.trim().split(/[-_]/)[0];
  return primary ? primary.toLowerCase() : null;
}

export const documentLanguageMismatch: Rule = {
  id: "document-language-mismatch",
  description: "The declared <html lang> does not match the language of the browser profile.",
  caveat: "A site may intentionally keep one language for every browser locale, or omit lang entirely.",
  run({ capture }) {
    const { evidence, profile } = capture;
    const declared = primaryLanguage(evidence.documentLang);
    if (declared === null) {
      return [
        {
          rule: "document-language-mismatch",
          profileId: profile.id,
          severity: "info",
          message: "The document declares no <html lang> attribute, so assistive technology cannot pick the right voice or hyphenation.",
          path: "html",
          evidence: { documentLang: evidence.documentLang, profileLanguage: profile.language },
        },
      ];
    }
    if (declared === profile.language) return [];
    return [
      {
        rule: "document-language-mismatch",
        profileId: profile.id,
        severity: "warning",
        message: `Document declares lang="${evidence.documentLang}" while the browser profile is ${profile.locale}.`,
        path: "html",
        evidence: { documentLang: evidence.documentLang, profileLanguage: profile.language, profileLocale: profile.locale },
      },
    ];
  },
};

export const rtlDirectionMissing: Rule = {
  id: "rtl-direction-missing",
  description: "A right-to-left profile renders the document left-to-right.",
  caveat: "Only checked for RTL profiles; a site that stays in an LTR language for every locale will be flagged.",
  run({ capture }) {
    const { evidence, profile } = capture;
    if (profile.direction !== "rtl" || evidence.computedDir === "rtl") return [];
    return [
      {
        rule: "rtl-direction-missing",
        profileId: profile.id,
        severity: "error",
        message: `${profile.label} expects a right-to-left document but <html> resolves to direction "${evidence.computedDir}".`,
        path: "html",
        evidence: {
          documentDir: evidence.documentDir,
          computedDir: evidence.computedDir,
          documentLang: evidence.documentLang,
          expectedDir: "rtl",
        },
      },
    ];
  },
};
