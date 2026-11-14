import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Capture, Finding, RunResult, Severity } from "../types.js";
import { RULES, summariseFindings } from "../rules/index.js";
import { SEVERITY_RANK } from "../rules/types.js";

export const HTML_FILE = "index.html";

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const SEVERITY_LABEL: Record<Severity, string> = { error: "Error", warning: "Warning", info: "Info" };

const STYLES = `
:root { color-scheme: light dark; --bg: #fff; --fg: #1b1f24; --muted: #5c6773; --line: #d9dee3; --card: #f6f8fa;
  --error: #c62828; --warning: #b26a00; --info: #1565c0; --ok: #2e7d32; }
@media (prefers-color-scheme: dark) { :root { --bg: #0f1216; --fg: #e6e8eb; --muted: #9aa4ae; --line: #2a3139; --card: #171c22;
  --error: #ff6b6b; --warning: #f5b544; --info: #6fb1ff; --ok: #6cd47f; } }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--fg); }
main { max-width: 1200px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 24px; margin: 0 0 4px; }
h2 { font-size: 18px; margin: 32px 0 12px; }
.meta { color: var(--muted); font-size: 14px; word-break: break-all; }
.summary { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
.pill { border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; font-size: 14px; background: var(--card); }
.pill b { font-variant-numeric: tabular-nums; }
.pill.error b { color: var(--error); } .pill.warning b { color: var(--warning); } .pill.info b { color: var(--info); } .pill.ok b { color: var(--ok); }
.profiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.profile { border: 1px solid var(--line); border-radius: 8px; background: var(--card); overflow: hidden; }
.profile header { padding: 10px 12px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.profile header small { color: var(--muted); }
.profile a.shot { display: block; max-height: 320px; overflow: hidden; background: #fff; }
.profile img { display: block; width: 100%; height: auto; }
.profile dl { margin: 0; padding: 10px 12px; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 13px; }
.profile dt { color: var(--muted); } .profile dd { margin: 0; word-break: break-all; }
.failed { color: var(--error); padding: 10px 12px; font-size: 13px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; font-size: 13px; }
tr.sev-error td.sev { color: var(--error); } tr.sev-warning td.sev { color: var(--warning); } tr.sev-info td.sev { color: var(--info); }
td.sev { font-weight: 600; white-space: nowrap; }
td.rule code, td.where code { font-size: 12px; }
code { background: var(--card); border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; }
details { margin-top: 4px; } summary { cursor: pointer; color: var(--muted); font-size: 13px; }
details table { margin-top: 6px; font-size: 13px; } details td { padding: 3px 8px; border: 0; }
details td:first-child { color: var(--muted); white-space: nowrap; }
.empty { color: var(--muted); padding: 12px; border: 1px dashed var(--line); border-radius: 8px; }
.legend li { margin-bottom: 8px; } .legend .caveat { color: var(--muted); font-size: 13px; }
footer { margin-top: 48px; color: var(--muted); font-size: 13px; }
`;

function renderSummary(result: RunResult): string {
  const summary = summariseFindings(result.findings);
  const failed = result.captures.filter((c) => c.error).length;
  const total = result.findings.length;
  return `<div class="summary">
    <span class="pill ${total === 0 ? "ok" : ""}"><b>${total}</b> finding${total === 1 ? "" : "s"}</span>
    <span class="pill error"><b>${summary.error}</b> errors</span>
    <span class="pill warning"><b>${summary.warning}</b> warnings</span>
    <span class="pill info"><b>${summary.info}</b> info</span>
    <span class="pill"><b>${result.captures.length - failed}</b>/${result.captures.length} profiles captured</span>
  </div>`;
}

function renderProfile(capture: Capture, findings: Finding[]): string {
  const { profile, evidence } = capture;
  const own = findings.filter((f) => f.profileId === profile.id);
  const errors = own.filter((f) => f.severity === "error").length;
  const header = `<header><strong>${escapeHtml(profile.label)}</strong><small>${escapeHtml(profile.locale)} &middot; ${escapeHtml(
    profile.timezone,
  )}</small></header>`;
  if (capture.error) {
    return `<article class="profile" id="profile-${escapeHtml(profile.id)}">${header}<p class="failed">Capture failed: ${escapeHtml(
      capture.error,
    )}</p></article>`;
  }
  const shot = escapeHtml(capture.screenshot);
  return `<article class="profile" id="profile-${escapeHtml(profile.id)}">${header}
    <a class="shot" href="${shot}" title="Open full screenshot"><img src="${shot}" alt="Screenshot of ${escapeHtml(profile.label)}" loading="lazy"></a>
    <dl>
      <dt>Findings</dt><dd>${own.length} (${errors} error${errors === 1 ? "" : "s"})</dd>
      <dt>Title</dt><dd>${escapeHtml(evidence.title || "(none)")}</dd>
      <dt>lang / dir</dt><dd>${escapeHtml(evidence.documentLang ?? "(missing)")} / ${escapeHtml(evidence.computedDir)}</dd>
      <dt>Page width</dt><dd>${evidence.scrollWidth} px in a ${evidence.clientWidth} px viewport</dd>
      <dt>Browser saw</dt><dd>${escapeHtml(evidence.navigatorLanguage)}, ${escapeHtml(evidence.resolvedTimezone)}</dd>
      <dt>Text nodes</dt><dd>${evidence.textElements.length} elements, ${evidence.markedValues.length} markers</dd>
      <dt>Captured in</dt><dd>${capture.durationMs} ms</dd>
    </dl>
  </article>`;
}

function renderEvidence(finding: Finding): string {
  const rows = Object.entries(finding.evidence)
    .filter(([, v]) => v !== null && v !== "")
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td><code>${escapeHtml(v)}</code></td></tr>`)
    .join("");
  if (!rows) return "";
  return `<details><summary>Evidence</summary><table>${rows}</table></details>`;
}

function renderFindings(result: RunResult): string {
  if (result.findings.length === 0) {
    return `<p class="empty">No findings. Every rule passed for every captured profile.</p>`;
  }
  const sections: string[] = [];
  for (const capture of result.captures) {
    const own = result.findings
      .filter((f) => f.profileId === capture.profile.id)
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
    if (own.length === 0) continue;
    const rows = own
      .map(
        (f) => `<tr class="sev-${f.severity}">
        <td class="sev">${SEVERITY_LABEL[f.severity]}</td>
        <td class="rule"><code>${escapeHtml(f.rule)}</code></td>
        <td>${escapeHtml(f.message)}${renderEvidence(f)}</td>
        <td class="where">${f.path ? `<code>${escapeHtml(f.path)}</code>` : ""}${
          f.elementId ? `<br><small>id: ${escapeHtml(f.elementId)}</small>` : ""
        }</td>
      </tr>`,
      )
      .join("");
    sections.push(`<h3 id="findings-${escapeHtml(capture.profile.id)}">${escapeHtml(capture.profile.label)} <small class="meta">(${
      own.length
    })</small></h3>
    <table><thead><tr><th>Severity</th><th>Rule</th><th>Finding</th><th>Element</th></tr></thead><tbody>${rows}</tbody></table>`);
  }
  return sections.join("\n");
}

function renderLegend(): string {
  const items = RULES.map(
    (r) => `<li><code>${escapeHtml(r.id)}</code> ${escapeHtml(r.description)}<div class="caveat">Caveat: ${escapeHtml(r.caveat)}</div></li>`,
  ).join("");
  return `<ul class="legend">${items}</ul>`;
}

/** Produce a single self-contained HTML document. Screenshots are referenced relatively. */
export function renderHtmlReport(result: RunResult): string {
  const started = new Date(result.startedAt);
  const seconds = Math.round((new Date(result.finishedAt).getTime() - started.getTime()) / 100) / 10;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LocaleLab report</title>
<style>${STYLES}</style>
</head>
<body>
<main>
  <h1>LocaleLab report</h1>
  <p class="meta"><a href="${escapeHtml(result.url)}">${escapeHtml(result.url)}</a><br>
  ${escapeHtml(started.toISOString())} &middot; ${seconds}s &middot; viewport ${result.viewport.width}&times;${result.viewport.height} &middot;
  baseline <strong>${escapeHtml(result.baselineProfileId)}</strong> &middot; LocaleLab ${escapeHtml(result.version)}</p>
  ${renderSummary(result)}

  <h2>Profiles</h2>
  <div class="profiles">${result.captures.map((c) => renderProfile(c, result.findings)).join("\n")}</div>

  <h2>Findings</h2>
  ${renderFindings(result)}

  <h2>Rules and caveats</h2>
  <p class="meta">Every rule is deterministic and reports the evidence it used. Read findings as leads for a human to confirm, not as verdicts.</p>
  ${renderLegend()}

  <footer>Generated by LocaleLab ${escapeHtml(result.version)}. Machine-readable copies: <code>findings.json</code>, <code>run.json</code>.</footer>
</main>
</body>
</html>
`;
}

export async function writeHtmlReport(result: RunResult, outDir: string): Promise<string> {
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, HTML_FILE);
  await writeFile(file, renderHtmlReport(result), "utf8");
  return file;
}
