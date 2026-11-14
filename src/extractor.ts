import type { Evidence, MarkedValue, MarkerKind, TextDirection, TextElement } from "./types.js";
import type { Expectation, ExpectationKind } from "./intl.js";

export interface ExtractorOptions {
  url: string;
  locale: string;
  timezone: string;
  /** Hard cap on recorded text elements so huge pages stay manageable. */
  maxTextElements: number;
}

type ComputeExpectation = (
  kind: ExpectationKind,
  marker: string,
  style: string | undefined,
  locale: string,
  timezone: string,
) => Expectation;

/**
 * Runs INSIDE the page. It is serialised with Function.prototype.toString(),
 * so it must not reference anything from module scope. `compute` is passed in
 * the same way so the Intl comparison uses the browser's own locale data.
 */
export function extractEvidence(options: ExtractorOptions, compute: ComputeExpectation): Evidence {
  const doc = document;
  const html = doc.documentElement;
  const body = doc.body;

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "PATH", "HEAD", "META", "LINK", "TITLE"]);

  const collapse = (s: string): string => s.replace(/\s+/g, " ").trim();

  const pathOf = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== html) {
      const tag = node.tagName.toLowerCase();
      if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
        parts.unshift(`${tag}#${node.id}`);
        break;
      }
      const parent: Element | null = node.parentElement;
      let selector = tag;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
        if (sameTag.length > 1) selector += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
      parts.unshift(selector);
      node = parent;
    }
    return parts.join(" > ");
  };

  const isVisible = (el: Element, style: CSSStyleDeclaration, rect: DOMRect): boolean => {
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    if (Number(style.opacity) === 0) return false;
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return true;
  };

  const ownsText = (el: Element): boolean => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && collapse(child.textContent ?? "").length > 0) return true;
    }
    return false;
  };

  const stableId = (el: Element): string | undefined => el.getAttribute("data-localelab-id") ?? undefined;

  const textElements: TextElement[] = [];
  const all = Array.from(body ? body.querySelectorAll("*") : []);
  for (const el of all) {
    if (textElements.length >= options.maxTextElements) break;
    if (SKIP_TAGS.has(el.tagName)) continue;
    if (el.closest("script, style, noscript, template")) continue;
    if (!ownsText(el)) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!isVisible(el, style, rect)) continue;
    const htmlEl = el as HTMLElement;
    const text = collapse(htmlEl.innerText || el.textContent || "");
    if (text.length === 0) continue;
    textElements.push({
      path: pathOf(el),
      id: stableId(el),
      tag: el.tagName.toLowerCase(),
      text,
      mustTranslate: el.closest("[data-localelab-translate]") !== null,
      ignored: el.closest("[data-localelab-ignore]") !== null,
      rect: {
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    });
  }

  const markedValues: MarkedValue[] = [];
  const markerAttrs: Array<[MarkerKind, string]> = [
    ["date", "data-localelab-date"],
    ["number", "data-localelab-number"],
    ["currency", "data-localelab-currency"],
  ];
  for (const [kind, attr] of markerAttrs) {
    for (const el of Array.from(doc.querySelectorAll(`[${attr}]`))) {
      const marker = el.getAttribute(attr) ?? "";
      const style = el.getAttribute("data-localelab-style") ?? undefined;
      const rendered = collapse((el as HTMLElement).innerText || el.textContent || "");
      let expectation: Expectation;
      try {
        expectation = compute(kind, marker, style, options.locale, options.timezone);
      } catch (err) {
        expectation = { expected: null, alternatives: [], error: String(err) };
      }
      markedValues.push({
        kind,
        path: pathOf(el),
        id: el.getAttribute("data-localelab-id") ?? undefined,
        marker,
        style,
        rendered,
        expected: expectation.expected,
        alternatives: expectation.alternatives,
        error: expectation.error,
        ignored: el.closest("[data-localelab-ignore]") !== null,
      });
    }
  }

  const computedDir: TextDirection = getComputedStyle(html).direction === "rtl" ? "rtl" : "ltr";

  return {
    url: options.url,
    finalUrl: location.href,
    title: doc.title,
    documentLang: html.getAttribute("lang"),
    documentDir: html.getAttribute("dir"),
    computedDir,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollWidth: html.scrollWidth,
    clientWidth: html.clientWidth,
    bodyScrollWidth: body ? body.scrollWidth : html.scrollWidth,
    textElements,
    markedValues,
    navigatorLanguage: navigator.language,
    resolvedTimezone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
