import path from "node:path";
import { SOURCE_FORMATS, StoreError, type IconCard, type SourceFormat } from "./client";
import type { Context } from "./context";
import { forgetCodes, maskCode, parseCodes, saveCode } from "./credentials";
import { detectProject, ensureFlutterAssets, fillPlaceholders, safeDir, writeIcon } from "./project";

/** The operations behind both the CLI and the MCP server, returning data (callers format it). */

export async function searchIcons(ctx: Context, query: string, limit = 20): Promise<IconCard[]> {
  return ctx.client.search(query, limit);
}

export interface AddOptions {
  format?: string;
  dir?: string;
  force?: boolean;
}

export interface AddResult {
  slug: string;
  ok: boolean;
  format?: SourceFormat;
  iconsDir?: string;
  written?: string[];
  usage?: string;
  setup?: string;
  license?: string;
  error?: string;
  code?: string;
  buyLinks?: { title: string; url: string; free: boolean }[];
}

export function resolveTarget(ctx: Context, opts: AddOptions): { format: SourceFormat; iconsDir: string; framework: string } {
  const project = detectProject(ctx.root);
  if (opts.format && !SOURCE_FORMATS.includes(opts.format as SourceFormat)) throw new Error(`Unknown format "${opts.format}". Use one of: ${SOURCE_FORMATS.join(", ")}.`);
  return { framework: project.framework, format: (opts.format as SourceFormat) ?? project.format, iconsDir: opts.dir ? safeDir(ctx.root, opts.dir) : project.iconsDir };
}

export async function addIcon(ctx: Context, slug: string, opts: AddOptions = {}): Promise<AddResult> {
  const { format, iconsDir } = resolveTarget(ctx, opts);
  try {
    const files = await ctx.client.files(slug, format, await ctx.codes());
    const w = await writeIcon(iconsDir, files, ctx.playerJs, { force: opts.force, root: ctx.root });
    let setup = files.setup;
    if (format === "flutter") {
      const pub = await ensureFlutterAssets(ctx.root, iconsDir);
      const dir = `${path.relative(ctx.root, iconsDir).split(path.sep).join("/")}/`;
      setup = `flutter pub add daos_icons lottie audioplayers${pub === "added" ? ` (added ${dir} to pubspec.yaml assets)` : pub === "manual" ? `, and add "- ${dir}" under flutter: assets: in pubspec.yaml` : ""}`;
      if (pub === "added") w.written.push(path.join(ctx.root, "pubspec.yaml"));
    }
    return {
      slug,
      ok: true,
      format,
      iconsDir: path.relative(ctx.root, iconsDir) || ".",
      written: w.written.map((f) => path.relative(ctx.root, f)),
      usage: fillPlaceholders(files.usage, ctx.root, iconsDir),
      setup,
      license: `${files.license.productTitle} (${files.license.licenseType}, ${maskCode(files.license.code)})`,
    };
  } catch (e) {
    if (!(e instanceof StoreError)) throw e;
    return { slug, ok: false, error: e.message, code: e.code, buyLinks: e.products?.map((p) => ({ title: p.title, url: p.url, free: p.free })) };
  }
}

export async function login(ctx: Context, raw: string): Promise<{ ok: boolean; message: string }> {
  const [code] = parseCodes(raw);
  if (!code) return { ok: false, message: "That doesn't look like a license code (e.g. MOOD-7KQ2-9XHD-M4TR-1BZC)." };
  const v = await ctx.client.verify(code);
  if (!v.valid) return { ok: false, message: v.status === "revoked" ? "That license has been revoked." : "That license code wasn't found." };
  if (v.brand && v.brand !== ctx.brandName) return { ok: false, message: `That code is for ${v.brand}, not ${ctx.brandName}.` };
  await saveCode(ctx.client.origin, code, ctx.credentialsFile);
  return { ok: true, message: `Saved ${maskCode(code)}: ${v.product} (${v.licenseType} license).` };
}

export async function logout(ctx: Context): Promise<string> {
  const n = await forgetCodes(ctx.client.origin, ctx.credentialsFile);
  return n ? `Removed ${n} saved license code${n === 1 ? "" : "s"} for ${ctx.client.origin}.` : "No saved license codes for this store.";
}
