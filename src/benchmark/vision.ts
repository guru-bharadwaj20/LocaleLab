import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RunResult } from "../types.js";

/**
 * Optional second opinion from a local vision model served by Ollama.
 *
 * Nothing here feeds the score. The model looks at each screenshot and lists
 * what it suspects; the output is printed and stored as suggestions so a human
 * can compare it with the deterministic findings. It is slow, it hallucinates
 * and it is off by default for both reasons.
 */

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
export const DEFAULT_VISION_MODEL = "qwen2.5vl:7b";

export interface VisionSuggestion {
  issue: string;
  location: string;
  confidence: "low" | "medium" | "high";
}

export interface VisionNote {
  profileId: string;
  model: string;
  durationMs: number;
  suggestions: VisionSuggestion[];
  raw: string;
  error?: string;
}

export interface VisionOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function settings(options: VisionOptions) {
  return {
    baseUrl: (options.baseUrl ?? process.env.LOCALELAB_OLLAMA_URL ?? DEFAULT_OLLAMA_URL).replace(/\/+$/, ""),
    model: options.model ?? process.env.LOCALELAB_VISION_MODEL ?? DEFAULT_VISION_MODEL,
    timeoutMs: options.timeoutMs ?? 180_000,
    fetchImpl: options.fetchImpl ?? fetch,
  };
}

/** Check that Ollama answers and has the model; returns a reason when it does not. */
export async function visionAvailability(options: VisionOptions = {}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { baseUrl, model, fetchImpl } = settings(options);
  try {
    const res = await fetchImpl(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return { ok: false, reason: `Ollama at ${baseUrl} answered ${res.status}.` };
    const body = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
    const names = (body.models ?? []).flatMap((m) => [m.name, m.model]).filter((n): n is string => typeof n === "string");
    const found = names.some((n) => n === model || n.split(":")[0] === model.split(":")[0]);
    if (!found) {
      return { ok: false, reason: `Model "${model}" is not installed. Run: ollama pull ${model}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: `Cannot reach Ollama at ${baseUrl} (${err instanceof Error ? err.message : String(err)}). Install it from https://ollama.com and run: ollama pull ${model}`,
    };
  }
}

export function buildPrompt(profile: RunResult["captures"][number]["profile"]): string {
  return [
    `You are reviewing a screenshot of a web page rendered for the locale ${profile.locale} (${profile.label}, text direction ${profile.direction}).`,
    "List only visible localisation problems: text cut off or overlapping, untranslated text in the wrong language,",
    "placeholder or variable names showing, dates, numbers or prices in a format that does not match the locale,",
    "or layout that ignores the reading direction.",
    'Answer with JSON only, in this shape: {"issues":[{"issue":"...","location":"...","confidence":"low|medium|high"}]}.',
    "If you see nothing wrong, answer {\"issues\":[]}.",
  ].join(" ");
}

/** Pull the first JSON object out of a chatty answer. */
export function parseSuggestions(raw: string): VisionSuggestion[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { issues?: unknown };
    if (!Array.isArray(parsed.issues)) return [];
    return parsed.issues
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map(
        (i): VisionSuggestion => ({
          issue: String(i.issue ?? "").trim(),
          location: String(i.location ?? "").trim(),
          confidence: i.confidence === "high" || i.confidence === "medium" ? i.confidence : "low",
        }),
      )
      .filter((i) => i.issue.length > 0);
  } catch {
    return [];
  }
}

export async function describeScreenshot(
  screenshotPath: string,
  profile: RunResult["captures"][number]["profile"],
  options: VisionOptions = {},
): Promise<VisionNote> {
  const { baseUrl, model, timeoutMs, fetchImpl } = settings(options);
  const started = Date.now();
  try {
    const image = (await readFile(screenshotPath)).toString("base64");
    const res = await fetchImpl(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        prompt: buildPrompt(profile),
        images: [image],
        stream: false,
        format: "json",
        options: { temperature: 0 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { response?: string };
    const raw = body.response ?? "";
    return { profileId: profile.id, model, durationMs: Date.now() - started, suggestions: parseSuggestions(raw), raw };
  } catch (err) {
    return {
      profileId: profile.id,
      model,
      durationMs: Date.now() - started,
      suggestions: [],
      raw: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function describeScreenshots(
  result: RunResult,
  outDir: string,
  log: (line: string) => void,
  options: VisionOptions = {},
): Promise<VisionNote[]> {
  const availability = await visionAvailability(options);
  if (!availability.ok) {
    log(`Vision pass skipped: ${availability.reason}`);
    return [];
  }
  const { model } = settings(options);
  log(`Vision pass: asking ${model} about ${result.captures.filter((c) => !c.error).length} screenshots (not scored).`);
  const notes: VisionNote[] = [];
  for (const capture of result.captures) {
    if (capture.error) continue;
    const note = await describeScreenshot(path.join(outDir, capture.screenshot), capture.profile, options);
    log(
      note.error
        ? `  ${capture.profile.id}: failed (${note.error})`
        : `  ${capture.profile.id}: ${note.suggestions.length} suggestion${note.suggestions.length === 1 ? "" : "s"} in ${Math.round(note.durationMs / 100) / 10}s`,
    );
    notes.push(note);
  }
  return notes;
}

export function formatVisionNotes(notes: VisionNote[]): string {
  if (notes.length === 0) return "";
  const lines = ["Vision-model suggestions (advisory, not part of the score):"];
  for (const note of notes) {
    if (note.error) {
      lines.push(`  ${note.profileId}: ${note.error}`);
      continue;
    }
    if (note.suggestions.length === 0) {
      lines.push(`  ${note.profileId}: nothing reported`);
      continue;
    }
    for (const s of note.suggestions) {
      lines.push(`  ${note.profileId}: [${s.confidence}] ${s.issue}${s.location ? ` (${s.location})` : ""}`);
    }
  }
  return lines.join("\n");
}
