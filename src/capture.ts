import { chromium, type Browser, type BrowserContext } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Capture, Evidence, Profile, RunOptions } from "./types.js";
import { extractEvidence, type ExtractorOptions } from "./extractor.js";
import { computeExpectation } from "./intl.js";

const MAX_TEXT_ELEMENTS = 4000;

/** Build the expression evaluated in the page: extractor(options, computeExpectation). */
export function buildExtractorExpression(options: ExtractorOptions): string {
  return `(${extractEvidence.toString()})(${JSON.stringify(options)}, ${computeExpectation.toString()})`;
}

export function screenshotFileName(profile: Profile): string {
  return `${profile.id.replace(/[^A-Za-z0-9_-]/g, "_")}.png`;
}

export async function launchBrowser(headed = false): Promise<Browser> {
  return chromium.launch({ headless: !headed });
}

export function contextOptionsFor(profile: Profile, options: Pick<RunOptions, "viewport">) {
  return {
    locale: profile.locale,
    timezoneId: profile.timezone,
    viewport: options.viewport,
    deviceScaleFactor: 1,
    colorScheme: profile.colorScheme ?? "light",
    reducedMotion: profile.reducedMotion ?? "no-preference",
    // Evaluation runs via the devtools protocol; bypassing CSP keeps strict sites inspectable.
    bypassCSP: true,
  } as const;
}

function emptyEvidence(url: string, options: RunOptions): Evidence {
  return {
    url,
    finalUrl: url,
    title: "",
    documentLang: null,
    documentDir: null,
    computedDir: "ltr",
    viewport: options.viewport,
    scrollWidth: 0,
    clientWidth: 0,
    bodyScrollWidth: 0,
    textElements: [],
    markedValues: [],
    navigatorLanguage: "",
    resolvedTimezone: "",
  };
}

/**
 * Capture one URL under one profile: navigate, settle, screenshot, extract evidence.
 * Errors are recorded on the Capture instead of thrown so one broken profile
 * does not sink the whole run.
 */
export async function captureProfile(browser: Browser, profile: Profile, options: RunOptions): Promise<Capture> {
  const started = Date.now();
  const screenshotsDir = path.join(options.outDir, "screenshots");
  await mkdir(screenshotsDir, { recursive: true });
  const screenshotRel = path.posix.join("screenshots", screenshotFileName(profile));
  const screenshotAbs = path.join(options.outDir, "screenshots", screenshotFileName(profile));

  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext(contextOptionsFor(profile, options));
    context.setDefaultTimeout(options.timeoutMs);
    context.setDefaultNavigationTimeout(options.timeoutMs);
    const page = await context.newPage();

    await page.goto(options.url, { waitUntil: "load" });
    // Network idle is a best-effort settle; analytics beacons must not fail the capture.
    await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeoutMs, 8000) }).catch(() => undefined);
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { state: "visible" });
    }
    await page.evaluate(() => (document as Document & { fonts?: FontFaceSet }).fonts?.ready).catch(() => undefined);
    await page.waitForTimeout(150);

    const extractorOptions: ExtractorOptions = {
      url: options.url,
      locale: profile.locale,
      timezone: profile.timezone,
      maxTextElements: MAX_TEXT_ELEMENTS,
    };
    const evidence = (await page.evaluate(buildExtractorExpression(extractorOptions))) as Evidence;

    await page.screenshot({ path: screenshotAbs, fullPage: true, animations: "disabled" });

    return {
      profile,
      evidence,
      screenshot: screenshotRel,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      profile,
      evidence: emptyEvidence(options.url, options),
      screenshot: screenshotRel,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await context?.close().catch(() => undefined);
  }
}

/** Capture every profile sequentially with one shared browser. */
export async function captureAll(options: RunOptions): Promise<Capture[]> {
  const browser = await launchBrowser(options.headed);
  try {
    const captures: Capture[] = [];
    for (const profile of options.profiles) {
      options.onProgress?.(`Capturing ${profile.label} (${profile.locale}, ${profile.timezone})`);
      const capture = await captureProfile(browser, profile, options);
      if (capture.error) {
        options.onProgress?.(`  ! ${profile.id}: ${capture.error}`);
      } else {
        options.onProgress?.(
          `  ok ${profile.id}: ${capture.evidence.textElements.length} text elements, ${capture.evidence.markedValues.length} marked values, ${capture.durationMs} ms`,
        );
      }
      captures.push(capture);
    }
    return captures;
  } finally {
    await browser.close();
  }
}
