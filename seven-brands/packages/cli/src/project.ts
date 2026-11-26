import { existsSync, readFileSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IconFiles, SourceFormat } from "./client";

/** Where icons go and in which format, based on the project in `root`. */
export function detectProject(root: string): { format: SourceFormat; iconsDir: string; framework: string } {
  if (existsSync(path.join(root, "pubspec.yaml"))) return { format: "flutter", iconsDir: path.join(root, "lib", "icons"), framework: "flutter" };
  let deps: Record<string, string> = {};
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    deps = { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    /* not a Node project: plain web files */
  }
  if (deps["react-native"] || deps.expo) {
    const base = existsSync(path.join(root, "src")) ? path.join(root, "src") : root;
    return { format: "react-native", iconsDir: path.join(base, "components", "icons"), framework: deps.expo ? "expo" : "react-native" };
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
/** Project-relative folder (always "/" separators), used in Flutter asset paths and imports. */
const posixRel = (from: string, to: string) => path.relative(from, to).split(path.sep).join("/") || ".";

export function fillPlaceholders(text: string, root: string, iconsDir: string): string {
  const lib = path.join(root, "lib");
  const underLib = !path.relative(lib, iconsDir).startsWith("..");
  return text.replaceAll("{{ICONS_DIR}}", posixRel(root, iconsDir)).replaceAll("{{ICONS_DIR_IMPORT}}", underLib ? posixRel(lib, iconsDir) : posixRel(root, iconsDir));
}

export async function writeIcon(iconsDir: string, files: IconFiles, playerJs: () => Promise<string>, opts: { force?: boolean; root?: string } = {}): Promise<WriteResult> {
  await mkdir(iconsDir, { recursive: true });
  const written: string[] = [];
  const root = opts.root ?? path.dirname(iconsDir);
  for (const raw of files.files) {
    const f = { path: raw.path, content: raw.encoding === "base64" ? Buffer.from(raw.content, "base64") : Buffer.from(fillPlaceholders(raw.content, root, iconsDir)) };
    const target = path.resolve(iconsDir, f.path);
    const rel = path.relative(iconsDir, target);
    if (rel.startsWith("..") || path.isAbsolute(rel) || rel.includes(path.sep)) throw new Error(`Refusing to write outside the icons folder: ${f.path}`);
    if (existsSync(target) && !opts.force && (await readFile(target)).equals(f.content)) continue;
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

/**
 * Flutter only loads assets listed in pubspec.yaml. Adds "- <dir>/" under flutter: assets: (creating the list if
 * needed) and leaves the file untouched when the folder is already listed or the layout isn't the usual one.
 * Returns "added", "present" or "manual".
 */
export async function ensureFlutterAssets(root: string, iconsDir: string): Promise<"added" | "present" | "manual"> {
  const file = path.join(root, "pubspec.yaml");
  if (!existsSync(file)) return "manual";
  const entry = `${posixRel(root, iconsDir)}/`;
  const text = await readFile(file, "utf8");
  const lines = text.split("\n");
  if (lines.some((l) => l.trim() === `- ${entry}` || l.trim() === `- ${entry.slice(0, -1)}`)) return "present";
  const flutterAt = lines.findIndex((l) => /^flutter:\s*(#.*)?$/.test(l));
  if (flutterAt < 0) return "manual";
  // The flutter: block runs until the next top-level key.
  let end = flutterAt + 1;
  while (end < lines.length && (lines[end]!.trim() === "" || /^\s/.test(lines[end]!) || lines[end]!.trimStart().startsWith("#"))) end++;
  const block = lines.slice(flutterAt + 1, end);
  const indent = block.find((l) => l.trim() && !l.trimStart().startsWith("#"))?.match(/^(\s+)/)?.[1] ?? "  ";
  const assetsRel = block.findIndex((l) => l.startsWith(`${indent}assets:`) && l.trim() === "assets:");
  if (assetsRel >= 0) {
    const at = flutterAt + 1 + assetsRel;
    const item = lines.slice(at + 1).find((l) => l.trim().startsWith("- "));
    const itemIndent = item?.match(/^(\s+)/)?.[1] ?? `${indent}${indent}`;
    lines.splice(at + 1, 0, `${itemIndent}- ${entry}`);
  } else if (block.some((l) => l.startsWith(`${indent}assets:`))) {
    return "manual"; // e.g. an inline list; don't guess
  } else {
    lines.splice(flutterAt + 1, 0, `${indent}assets:`, `${indent}${indent}- ${entry}`);
  }
  await writeFile(file, lines.join("\n"));
  return "added";
}
