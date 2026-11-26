import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StoreClient } from "./client";
import { credentialsPath, licenseCodes } from "./credentials";

// Set by scripts/build.ts for each published brand package; undefined when running from source.
declare const __BRAND__: string | undefined;
declare const __DEFAULT_STORE__: string | undefined;
declare const __VERSION__: string | undefined;

export const BRAND_NAMES: Record<string, string> = { moodicons: "Moodicons", sonicglyphs: "SonicGlyphs" };
export const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0-dev";

export interface Context {
  brand: string;
  brandName: string;
  root: string;
  client: StoreClient;
  licenseEnvName: string;
  codes(): Promise<string[]>;
  playerJs(): Promise<string>;
  credentialsFile: string;
}

export interface ContextOptions {
  brand?: string;
  store?: string;
  cwd?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  credentialsFile?: string;
  /** Test hook: supply the player runtime instead of loading it. */
  player?: () => Promise<string>;
}

export function brandFrom(opts: ContextOptions): string {
  const env = opts.env ?? process.env;
  const brand = opts.brand ?? (typeof __BRAND__ === "string" ? __BRAND__ : undefined) ?? env.SEVENBRANDS_BRAND ?? "moodicons";
  if (!BRAND_NAMES[brand]) throw new Error(`Unknown brand "${brand}". Known: ${Object.keys(BRAND_NAMES).join(", ")}.`);
  return brand;
}

export function createContext(opts: ContextOptions = {}): Context {
  const env = opts.env ?? process.env;
  const brand = brandFrom(opts);
  const B = brand.toUpperCase();
  const store = opts.store ?? env[`${B}_STORE_URL`] ?? (typeof __DEFAULT_STORE__ === "string" && __DEFAULT_STORE__ ? __DEFAULT_STORE__ : undefined);
  if (!store) throw new Error(`No store address set. Pass --store https://… or set ${B}_STORE_URL.`);
  const client = new StoreClient(store, opts.fetchImpl, `${brand}-cli/${VERSION}`);
  const credentialsFile = opts.credentialsFile ?? credentialsPath(env.SEVENBRANDS_CONFIG_DIR);
  let player: Promise<string> | undefined;
  return {
    brand,
    brandName: BRAND_NAMES[brand]!,
    root: path.resolve(opts.cwd ?? process.cwd()),
    client,
    licenseEnvName: `${B}_LICENSE`,
    credentialsFile,
    codes: () => licenseCodes(client.origin, env[`${B}_LICENSE`], credentialsFile),
    playerJs: () => (player ??= opts.player ? opts.player() : loadPlayer()),
  };
}

/** The <daos-asset> runtime: shipped next to the built CLI, or built from the monorepo source in development. */
async function loadPlayer(): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const shipped = path.join(here, "daos-player.js");
  if (existsSync(shipped)) return readFileSync(shipped, "utf8");
  const mod = (await import("@sb/export")) as { buildPlayerBundle(): Promise<string> };
  return mod.buildPlayerBundle();
}
