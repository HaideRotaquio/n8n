import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addIcon, createContext, createMcpServer, login, main, parseArgs, StoreClient, type Context } from "./index";

/** A fake store implementing the developer API: two licenses, two icons, one of them only in a bundle. */
const PACK = "MOOD-AAAA-AAAA-AAAA-AAAA"; // covers face-happy only
const BUNDLE = "MOOD-BBBB-BBBB-BBBB-BBBB"; // covers face-happy and chibi-kai-cool
let evil = false;
const icon = (slug: string, products: { slug: string; title: string; free: boolean }[]) => ({
  slug,
  name: slug,
  description: `${slug} icon`,
  tags: ["test"],
  category: "faces",
  hasSound: true,
  durationMs: 1000,
  previewUrl: `http://x/api/v1/icons/${slug}/preview.svg`,
  products: products.map((p) => ({ ...p, url: `http://x/products/${p.slug}` })),
});
const ICONS = [icon("face-happy", [{ slug: "faces", title: "Faces Pack", free: false }]), icon("chibi-kai-cool", [{ slug: "chibi-bundle", title: "Chibi Bundle", free: false }])];
const covers: Record<string, string[]> = { [PACK]: ["face-happy"], [BUNDLE]: ["face-happy", "chibi-kai-cool"] };

let server: Server;
let store: string;
beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://x");
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/api/v1/icons") return send(200, { icons: ICONS.filter((i) => i.slug.includes(url.searchParams.get("q") ?? "")) });
    if (url.pathname === "/api/v1/licenses/verify") {
      const code = url.searchParams.get("code")!;
      return send(200, covers[code] ? { valid: true, status: "active", brand: "Moodicons", product: "Faces Pack", licenseType: "personal" } : { valid: false, status: "not_found" });
    }
    const m = /^\/api\/v1\/icons\/([a-z0-9-]+)(\/files)?$/.exec(url.pathname);
    if (!m) return send(404, { error: "nope", message: "nope" });
    const found = ICONS.find((i) => i.slug === m[1]);
    if (!found) return send(404, { error: "not_found", message: `No published icon called "${m[1]}".` });
    if (!m[2]) return send(200, { icon: found, formats: ["react"], colors: { primary: "#FF0000" } });
    const code = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1] ?? "";
    if (!covers[code]) return send(401, { error: "invalid_license", message: "bad code" });
    if (!covers[code]!.includes(found.slug)) return send(403, { error: "not_in_license", message: "not in your license", products: found.products });
    let body = "";
    for await (const c of req) body += c;
    const format = (JSON.parse(body || "{}") as { format?: string }).format ?? "react";
    const files = evil ? [{ path: "../escape.txt", content: "x" }] : format === "react" ? [{ path: "FaceHappy.tsx", content: "export function FaceHappy() {}" }] : [{ path: `${found.slug}.svg`, content: "<svg/>" }];
    return send(200, {
      icon: { slug: found.slug, name: found.name, version: 1 },
      format,
      files,
      needsPlayer: format === "react",
      usage: "<FaceHappy />",
      license: { code, licenseType: "personal", productSlug: "faces", productTitle: "Faces Pack", notice: `${found.slug} — license ${code}`, termsUrl: "http://x/help/licenses" },
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  store = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => server?.close());

async function project(pkg: object | null): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sb-cli-"));
  if (pkg) await writeFile(path.join(dir, "package.json"), JSON.stringify(pkg));
  await mkdir(path.join(dir, "src"));
  return dir;
}

async function ctxFor(cwd: string, env: Record<string, string> = {}): Promise<Context> {
  const config = await mkdtemp(path.join(os.tmpdir(), "sb-cfg-"));
  return createContext({ brand: "moodicons", store, cwd, env, credentialsFile: path.join(config, "credentials.json"), player: async () => "/* player */" });
}

describe("store client", () => {
  it("refuses plain http except for local addresses", () => {
    expect(() => new StoreClient("http://example.com")).toThrow(/https/);
    expect(new StoreClient("https://moodicons.example/x").origin).toBe("https://moodicons.example");
  });
});

describe("add", () => {
  it("writes a React component, the player and a license ledger into src/components/icons", async () => {
    const dir = await project({ dependencies: { react: "19" } });
    const ctx = await ctxFor(dir, { MOODICONS_LICENSE: PACK });
    const r = await addIcon(ctx, "face-happy");
    expect(r).toMatchObject({ ok: true, format: "react", iconsDir: path.join("src", "components", "icons") });
    const icons = path.join(dir, "src/components/icons");
    expect(await readFile(path.join(icons, "FaceHappy.tsx"), "utf8")).toContain("FaceHappy");
    expect(await readFile(path.join(icons, "daos-player.js"), "utf8")).toBe("/* player */");
    expect(await readFile(path.join(icons, "ICON-LICENSES.md"), "utf8")).toContain(PACK);
    // Adding again changes nothing and doesn't duplicate the ledger line.
    expect((await addIcon(ctx, "face-happy")).written).toEqual([]);
    expect((await readFile(path.join(icons, "ICON-LICENSES.md"), "utf8")).split(PACK).length).toBe(2);
  });

  it("tries each license until one covers the icon, and returns buy links when none does", async () => {
    const dir = await project(null);
    const one = await ctxFor(dir, { MOODICONS_LICENSE: PACK });
    const denied = await addIcon(one, "chibi-kai-cool", { format: "svg" });
    expect(denied).toMatchObject({ ok: false, code: "not_in_license", buyLinks: [{ title: "Chibi Bundle", url: "http://x/products/chibi-bundle", free: false }] });
    const both = await ctxFor(dir, { MOODICONS_LICENSE: `${PACK}, ${BUNDLE}` });
    expect(await addIcon(both, "chibi-kai-cool", { format: "svg", dir: "public/icons" })).toMatchObject({ ok: true, iconsDir: path.join("public", "icons") });
    expect(existsSync(path.join(dir, "public/icons/chibi-kai-cool.svg"))).toBe(true);
  });

  it("never writes outside the project or the icons folder", async () => {
    const dir = await project(null);
    const ctx = await ctxFor(dir, { MOODICONS_LICENSE: PACK });
    await expect(addIcon(ctx, "face-happy", { dir: "../outside" })).rejects.toThrow(/inside the project/);
    evil = true;
    try {
      await expect(addIcon(ctx, "face-happy", { format: "svg" })).rejects.toThrow(/outside the icons folder/);
    } finally {
      evil = false;
    }
  });

  it("asks for a license when none is configured", async () => {
    const ctx = await ctxFor(await project(null));
    expect(await addIcon(ctx, "face-happy")).toMatchObject({ ok: false, code: "license_required" });
  });
});

describe("login", () => {
  it("checks the code with the store and saves it readable only by the user", async () => {
    const ctx = await ctxFor(await project(null));
    expect((await login(ctx, "nonsense")).ok).toBe(false);
    expect((await login(ctx, "MOOD-ZZZZ-ZZZZ-ZZZZ-ZZZZ")).ok).toBe(false);
    expect((await login(ctx, PACK.toLowerCase())).ok).toBe(true);
    expect(await ctx.codes()).toEqual([PACK]);
    expect((await stat(ctx.credentialsFile)).mode & 0o777).toBe(0o600);
  });
});

describe("command line", () => {
  it("parses flags and prints help", async () => {
    expect(parseArgs(["add", "a", "b", "--format", "svg", "--force", "--dir=icons"])).toEqual({ cmd: "add", rest: ["a", "b"], flags: { format: "svg", force: true, dir: "icons" } });
    let out = "";
    expect(await main(["--help"], { out: (s) => (out += s), err: () => {} })).toBe(0);
    expect(out).toContain("npx moodicons mcp");
  });
});

describe("MCP server", () => {
  it("lets an agent search, inspect and add icons", async () => {
    const dir = await project({ dependencies: { next: "16", react: "19" } });
    const ctx = await ctxFor(dir, { MOODICONS_LICENSE: PACK });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createMcpServer(ctx).connect(a);
    const client = new Client({ name: "test-agent", version: "1" });
    await client.connect(b);
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual(["add_icon", "get_icon", "project_info", "search_icons"]);
    const search = await client.callTool({ name: "search_icons", arguments: { query: "happy" } });
    expect(JSON.stringify(search.content)).toContain("face-happy");
    const info = await client.callTool({ name: "project_info", arguments: {} });
    expect(JSON.stringify(info.content)).toContain("next");
    const added = await client.callTool({ name: "add_icon", arguments: { slug: "face-happy" } });
    expect(added.isError).toBeFalsy();
    expect(JSON.stringify(added.content)).toContain("<FaceHappy />");
    expect(existsSync(path.join(dir, "src/components/icons/FaceHappy.tsx"))).toBe(true);
    const denied = await client.callTool({ name: "add_icon", arguments: { slug: "chibi-kai-cool" } });
    expect(denied.isError).toBe(true);
    expect(JSON.stringify(denied.content)).toContain("chibi-bundle");
    await client.close();
  });
});
