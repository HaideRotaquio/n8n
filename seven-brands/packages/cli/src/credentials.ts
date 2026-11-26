import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isLicenseCode, normalizeLicenseCode } from "@sb/core";

/**
 * License codes saved by `login`, per store, in ~/.config/sevenbrands/credentials.json (readable only by the user).
 * The <BRAND>_LICENSE environment variable (comma-separated) is used first, e.g. in CI or an MCP client config.
 */

export const credentialsPath = (home = process.env.SEVENBRANDS_CONFIG_DIR ?? path.join(os.homedir(), ".config", "sevenbrands")) => path.join(home, "credentials.json");

type Store = Record<string, string[]>;

async function load(file: string): Promise<Store> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Store;
  } catch {
    return {};
  }
}

export function parseCodes(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map((c) => normalizeLicenseCode(c))
    .filter((c) => isLicenseCode(c));
}

export async function licenseCodes(origin: string, envValue: string | undefined, file = credentialsPath()): Promise<string[]> {
  const saved = (await load(file))[origin] ?? [];
  return [...new Set([...parseCodes(envValue), ...saved])];
}

export async function saveCode(origin: string, code: string, file = credentialsPath()): Promise<void> {
  const all = await load(file);
  all[origin] = [...new Set([...(all[origin] ?? []), code])];
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(all, null, 2), { mode: 0o600 });
  await chmod(file, 0o600);
}

export async function forgetCodes(origin: string, file = credentialsPath()): Promise<number> {
  const all = await load(file);
  const n = all[origin]?.length ?? 0;
  delete all[origin];
  await writeFile(file, JSON.stringify(all, null, 2), { mode: 0o600 });
  return n;
}

/** "MOOD-7KQ2-…-1BZC" → "MOOD-…-1BZC" for display. */
export const maskCode = (code: string) => `${code.slice(0, 4)}-…-${code.slice(-4)}`;
