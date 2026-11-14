import type { Viewport } from "./types.js";

/**
 * A tiny dependency-free argument parser. It understands:
 *   --flag value, --flag=value, and boolean --flag.
 * Positional arguments are collected in order.
 */
export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const eq = body.indexOf("=");
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[body] = next;
        i++;
      } else {
        flags[body] = true;
      }
      continue;
    }
    if (arg.startsWith("-") && arg.length === 2) {
      // Single-letter aliases we care about.
      const alias: Record<string, string> = { o: "out", p: "profiles", t: "timeout", h: "help", v: "version" };
      const name = alias[arg[1]!] ?? arg[1]!;
      const next = argv[i + 1];
      if (name !== "help" && name !== "version" && next !== undefined && !next.startsWith("-")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
      continue;
    }
    positionals.push(arg);
  }

  return { positionals, flags };
}

export function flagString(flags: ParsedArgs["flags"], name: string): string | undefined {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

export function flagBoolean(flags: ParsedArgs["flags"], name: string): boolean {
  const value = flags[name];
  if (value === true) return true;
  if (typeof value === "string") return !/^(0|false|no|off)$/i.test(value);
  return false;
}

export const DEFAULT_VIEWPORT: Viewport = { width: 1365, height: 900 };
export const DEFAULT_TIMEOUT_MS = 20_000;

export class ArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgumentError";
  }
}

/** Parse "1365x900" (also accepts "1365X900" and "1365*900"). */
export function parseViewport(spec: string | undefined): Viewport {
  if (spec === undefined) return { ...DEFAULT_VIEWPORT };
  const match = /^\s*(\d{3,5})\s*[xX*]\s*(\d{3,5})\s*$/.exec(spec);
  if (!match) {
    throw new ArgumentError(`Invalid --viewport "${spec}". Expected <width>x<height>, e.g. 1365x900.`);
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 320 || height < 320 || width > 10_000 || height > 10_000) {
    throw new ArgumentError(`Viewport ${width}x${height} is out of range (320 to 10000 pixels per side).`);
  }
  return { width, height };
}

export function parseTimeout(spec: string | undefined): number {
  if (spec === undefined) return DEFAULT_TIMEOUT_MS;
  const value = Number(spec);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new ArgumentError(`Invalid --timeout "${spec}". Expected a positive whole number of milliseconds.`);
  }
  return value;
}

/** Accept bare hostnames and add https:// so "example.com" works. */
export function normaliseUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) throw new ArgumentError("A URL is required.");
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new ArgumentError(`"${input}" is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "file:") {
    throw new ArgumentError(`Unsupported URL scheme "${url.protocol}". Use http, https or file.`);
  }
  return url.toString();
}
