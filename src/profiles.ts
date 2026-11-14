import type { Profile } from "./types.js";

/**
 * Built-in browser profiles. The first profile passed on the command line
 * is treated as the baseline for cross-profile comparisons.
 */
export const BUILT_IN_PROFILES: readonly Profile[] = [
  { id: "en-US", label: "US English", locale: "en-US", timezone: "America/New_York", direction: "ltr", language: "en" },
  { id: "en-GB", label: "UK English", locale: "en-GB", timezone: "Europe/London", direction: "ltr", language: "en" },
  { id: "de-DE", label: "German", locale: "de-DE", timezone: "Europe/Berlin", direction: "ltr", language: "de" },
  { id: "fr-FR", label: "French", locale: "fr-FR", timezone: "Europe/Paris", direction: "ltr", language: "fr" },
  { id: "ja-JP", label: "Japanese", locale: "ja-JP", timezone: "Asia/Tokyo", direction: "ltr", language: "ja" },
  { id: "ar-SA", label: "Arabic (Saudi Arabia)", locale: "ar-SA", timezone: "Asia/Riyadh", direction: "rtl", language: "ar" },
  { id: "hi-IN", label: "Hindi (India)", locale: "hi-IN", timezone: "Asia/Kolkata", direction: "ltr", language: "hi" },
  { id: "es-ES", label: "Spanish (Spain)", locale: "es-ES", timezone: "Europe/Madrid", direction: "ltr", language: "es" },
];

export const DEFAULT_PROFILE_IDS = ["en-US", "de-DE", "ja-JP", "ar-SA"];

const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ug", "yi", "dv"]);

export class UnknownProfileError extends Error {
  constructor(public readonly profileId: string) {
    super(
      `Unknown profile "${profileId}". Built-in profiles: ${BUILT_IN_PROFILES.map((p) => p.id).join(", ")}. ` +
        `You can also pass an ad-hoc locale as <locale>@<IANA timezone>, e.g. pt-BR@America/Sao_Paulo.`,
    );
    this.name = "UnknownProfileError";
  }
}

export function getProfile(id: string): Profile | undefined {
  const trimmed = id.trim();
  return BUILT_IN_PROFILES.find((p) => p.id.toLowerCase() === trimmed.toLowerCase());
}

/**
 * Build an ad-hoc profile from "locale@timezone". Used when a caller wants a
 * locale we do not ship a preset for.
 */
export function parseAdHocProfile(spec: string): Profile | undefined {
  const match = /^([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)@(UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+)$/.exec(spec.trim());
  if (!match) return undefined;
  const locale = match[1]!;
  const timezone = match[2]!;
  const language = locale.split("-")[0]!.toLowerCase();
  return {
    id: locale,
    label: locale,
    locale,
    timezone,
    language,
    direction: RTL_LANGUAGES.has(language) ? "rtl" : "ltr",
  };
}

/**
 * Resolve a comma-separated list of profile ids (or ad-hoc specs) in order.
 * Duplicates are dropped; the first entry wins and becomes the baseline.
 */
export function resolveProfiles(spec: string | undefined): Profile[] {
  const ids = (spec ?? DEFAULT_PROFILE_IDS.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    throw new Error("At least one profile is required.");
  }
  const seen = new Set<string>();
  const profiles: Profile[] = [];
  for (const id of ids) {
    const profile = getProfile(id) ?? parseAdHocProfile(id);
    if (!profile) throw new UnknownProfileError(id);
    if (seen.has(profile.id)) continue;
    seen.add(profile.id);
    profiles.push(profile);
  }
  return profiles;
}
