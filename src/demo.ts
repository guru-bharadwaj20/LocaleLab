import { createServer, type Server } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import type { parseArgs } from "./cli-args.js";
import { buildRunOptions, EXIT_FAILURE, EXIT_FINDINGS, EXIT_OK, formatFindings, formatSummaryLine, readCommonOptions, shouldFail } from "./cli.js";
import { runLocaleLab } from "./run.js";

/** Absolute path of the bundled storefront fixture. */
export function fixtureDir(): string {
  return fileURLToPath(new URL("../fixtures/storefront/", import.meta.url));
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export interface StaticServer {
  url: string;
  close(): Promise<void>;
}

/**
 * Serve a directory on 127.0.0.1 with a random port. Paths are resolved
 * inside the root only; anything that escapes it is a 404.
 */
export async function serveDirectory(root: string, port = 0): Promise<StaticServer> {
  const absoluteRoot = path.resolve(root);
  const server: Server = createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      let relative = decodeURIComponent(requestUrl.pathname);
      if (relative.endsWith("/")) relative += "index.html";
      const file = path.resolve(absoluteRoot, `.${relative}`);
      if (!file.startsWith(absoluteRoot + path.sep) && file !== absoluteRoot) {
        res.writeHead(404).end("Not found");
        return;
      }
      const info = await stat(file).catch(() => null);
      if (!info || !info.isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "content-length": body.byteLength,
        "cache-control": "no-store",
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(err instanceof Error ? err.message : "Server error");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

export async function commandDemo(flags: ReturnType<typeof parseArgs>["flags"], log: (line: string) => void): Promise<number> {
  const common = readCommonOptions(flags, "localelab-demo-report");
  const server = await serveDirectory(fixtureDir());
  log(`Serving the demo storefront at ${server.url}`);
  try {
    const { result, outputs } = await runLocaleLab(buildRunOptions(server.url, common, log));
    if (result.captures.every((c) => c.error)) {
      log("Every profile failed to capture.");
      return EXIT_FAILURE;
    }
    if (!common.quiet) log(formatFindings(result.findings));
    log(formatSummaryLine(result.findings, outputs.outDir));
    log("The storefront is deliberately broken: see fixtures/storefront/index.html for the planted defects.");
    if (common.vision) {
      const { describeScreenshots, formatVisionNotes } = await import("./benchmark/vision.js");
      const notes = await describeScreenshots(result, outputs.outDir, log);
      log(formatVisionNotes(notes));
    }
    return shouldFail(result.findings, common.failOn) ? EXIT_FINDINGS : EXIT_OK;
  } finally {
    await server.close();
  }
}
