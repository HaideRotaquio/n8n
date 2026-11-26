import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IconFiles, SourceFormat } from "./client";

/** Where icons go and in which format, based on the project in `root`. */
export function detectProject(root: string): { format: SourceFormat; iconsDir: string; framework: string } {
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    /* not a Node project: plain web files */
  }
  const framework = deps.next ? "next" : deps.react ? "react" : deps.vue ? "vue" : deps.svelte ? "svelte" : deps["@angular/core"] ? "angular" : "html";
  const format: SourceFormat = framework === "next" || framework === "react" ? "react" : "web-component";
  const base = existsSync(path.join(root, "src")) ? path.join(root, "src") : root;
  const iconsDir = framework === "html" && existsSync(path.join(root, "public")) ? path.join(root, "public", "icons") : path.join(base, framework === "html" ? "icons" : "components/icons");
  return { format, iconsDir, framework };
}

/** Resolves `dir` inside `root`; refuses anything that would escape the project. */
export function safeDir(root: string, dir: string): string {
  const abs = path.resolve(root, dir);
  const rel = path.relative(path.resolve(root), abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`The icons folder must be inside the project: ${dir}`);
  return abs;
}

export interface WriteResult {
  written: string[];
  playerAdded: boolean;
}

/**
 * Writes one icon's files, the player runtime when the format needs it (once per folder), and a line in
 * ICON-LICENSES.md recording which license covers it. Paths from the server are checked to stay in the folder.
 */
export async function writeIcon(iconsDir: string, files: IconFiles, playerJs: () => Promise<string>, opts: { force?: boolean } = {}): Promise<WriteResult> {
  await mkdir(iconsDir, { recursive: true });
  const written: string[] = [];
  for (const f of files.files) {
    const target = path.resolve(iconsDir, f.path);
    const rel = path.relative(iconsDir, target);
    if (rel.startsWith("..") || path.isAbsolute(rel) || rel.includes(path.sep)) throw new Error(`Refusing to write outside the icons folder: ${f.path}`);
    if (existsSync(target) && !opts.force) {
      const current = await readFile(target, "utf8");
      if (current === f.content) continue;
    }
    await writeFile(target, f.content);
    written.push(target);
  }
  let playerAdded = false;
  const player = path.join(iconsDir, "daos-player.js");
  if (files.needsPlayer) {
    const js = await playerJs();
    if (!existsSync(player) || (await readFile(player, "utf8")) !== js) {
      await writeFile(player, js);
      playerAdded = true;
      written.push(player);
    }
  }
  const ledger = path.join(iconsDir, "ICON-LICENSES.md");
  const line = `- ${files.license.notice}`;
  const existing = existsSync(ledger) ? await readFile(ledger, "utf8") : "# Icon licenses\n\nEach icon in this folder and the license that covers it. Keep this file with the icons.\n\n";
  if (!existing.includes(line)) await (existsSync(ledger) ? appendFile(ledger, `${line}\n`) : writeFile(ledger, `${existing}${line}\n`));
  return { written, playerAdded };
}
