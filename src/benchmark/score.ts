import type { Finding } from "../types.js";
import { TRUTH_MATRIX, expectedObservations, type ExpectedObservation, type TruthEntry } from "./truth.js";

export interface ObservationResult extends ExpectedObservation {
  detected: boolean;
  finding?: Finding;
}

export interface BenchmarkScore {
  expected: number;
  detected: number;
  defectTypes: number;
  defectTypesDetected: number;
  falsePositives: Finding[];
  falseNegatives: ObservationResult[];
  observations: ObservationResult[];
  precision: number;
  recall: number;
}

function key(profileId: string, rule: string, elementId: string | undefined): string {
  return `${profileId}\u0000${rule}\u0000${elementId ?? ""}`;
}

/**
 * Score findings against the truth matrix.
 *
 * A finding counts as a true positive when its profile, rule and element id all
 * match an expected observation. Info-level findings are advisory and never
 * count as false positives; everything else that is not expected does.
 */
export function scoreFindings(findings: Finding[], matrix: readonly TruthEntry[] = TRUTH_MATRIX): BenchmarkScore {
  const expected = expectedObservations(matrix);
  const byKey = new Map<string, Finding[]>();
  for (const f of findings) {
    const k = key(f.profileId, f.rule, f.elementId);
    const list = byKey.get(k) ?? [];
    list.push(f);
    byKey.set(k, list);
  }

  const matched = new Set<Finding>();
  const observations: ObservationResult[] = expected.map((obs) => {
    const hits = byKey.get(key(obs.profileId, obs.rule, obs.elementId)) ?? [];
    const finding = hits.find((f) => f.severity !== "info");
    if (finding) {
      for (const hit of hits) matched.add(hit);
      return { ...obs, detected: true, finding };
    }
    return { ...obs, detected: false };
  });

  const falsePositives = findings.filter((f) => !matched.has(f) && f.severity !== "info");
  const falseNegatives = observations.filter((o) => !o.detected);
  const detected = observations.length - falseNegatives.length;
  const defectTypesDetected = new Set(observations.filter((o) => o.detected).map((o) => o.defect)).size;

  const precision = detected + falsePositives.length === 0 ? 1 : detected / (detected + falsePositives.length);
  const recall = observations.length === 0 ? 1 : detected / observations.length;

  return {
    expected: observations.length,
    detected,
    defectTypes: matrix.length,
    defectTypesDetected,
    falsePositives,
    falseNegatives,
    observations,
    precision,
    recall,
  };
}

/** A fixed-width table: one row per defect type, one column per profile. */
export function renderMatrix(score: BenchmarkScore, profileIds: readonly string[], matrix: readonly TruthEntry[] = TRUTH_MATRIX): string {
  const nameWidth = Math.max(...matrix.map((m) => m.defect.length), 6);
  const cell = (s: string) => s.padEnd(6);
  const header = `${"defect".padEnd(nameWidth)}  ${profileIds.map(cell).join(" ")}`;
  const lines = [header, "-".repeat(header.length)];
  for (const entry of matrix) {
    const cells = profileIds.map((p) => {
      const obs = score.observations.find((o) => o.defect === entry.defect && o.profileId === p);
      if (!obs) return cell("-");
      return cell(obs.detected ? "hit" : "MISS");
    });
    lines.push(`${entry.defect.padEnd(nameWidth)}  ${cells.join(" ")}`);
  }
  lines.push("", "hit: expected and detected   MISS: expected but not detected   -: not a defect in this profile");
  return lines.join("\n");
}

export function renderScoreSummary(score: BenchmarkScore): string {
  const fmt = (n: number) => n.toFixed(3);
  return [
    `Expected checks detected   ${score.detected} / ${score.expected}`,
    `Injected defect types      ${score.defectTypesDetected} / ${score.defectTypes}`,
    `False positives            ${score.falsePositives.length}`,
    `False negatives            ${score.falseNegatives.length}`,
    `Deterministic precision: ${fmt(score.precision)}  |  Deterministic recall: ${fmt(score.recall)}`,
  ].join("\n");
}
