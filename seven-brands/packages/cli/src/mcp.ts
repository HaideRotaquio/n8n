import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SOURCE_FORMATS } from "./client";
import type { Context } from "./context";
import { VERSION } from "./context";
import { addIcon, resolveTarget, searchIcons } from "./commands";
import { maskCode } from "./credentials";

const text = (t: string, isError = false) => ({ content: [{ type: "text" as const, text: t }], ...(isError ? { isError: true } : {}) });

/**
 * MCP server for AI coding agents. Runs in the user's project folder (MCP clients start it there) and writes icons
 * only inside that folder. Searching is free; adding files uses the license codes from the environment or `login`.
 */
export function createMcpServer(ctx: Context): McpServer {
  const server = new McpServer(
    { name: ctx.brand, version: VERSION },
    {
      instructions: `${ctx.brandName} icons are animated SVG icons with synced sound. Use search_icons to find icons, get_icon for details, then add_icon to write them into the user's project and follow the returned usage snippet. Sound only starts after a user click (browser autoplay rules). If add_icon reports that a license doesn't cover an icon, tell the user and share the buy links it returns; never invent license codes. Store: ${ctx.client.origin}`,
    },
  );

  server.registerTool(
    "search_icons",
    {
      title: "Search icons",
      description: `Search the ${ctx.brandName} catalog by name, mood, tag or category (e.g. "happy cat", "pirate", "notification bell"). Free; no license needed.`,
      inputSchema: { query: z.string().max(120).describe("Words to search for; every word must match."), limit: z.number().int().min(1).max(50).optional() },
    },
    async ({ query, limit }) => {
      const icons = await searchIcons(ctx, query, limit ?? 10);
      if (!icons.length) return text(`No icons match "${query}". Try fewer or different words.`);
      return text(
        icons
          .map((i) => `- ${i.slug}: ${i.name} — ${i.description}${i.hasSound ? " (with sound)" : ""}. In: ${i.products.map((p) => `${p.title}${p.free ? " [free]" : ""}`).join(", ")}. Preview: ${i.previewUrl}`)
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "get_icon",
    {
      title: "Icon details",
      description: "Details for one icon: description, tags, colors (overridable tokens), formats and the products that include it.",
      inputSchema: { slug: z.string().max(100) },
    },
    async ({ slug }) => {
      try {
        const d = await ctx.client.get(slug);
        return text(JSON.stringify(d, null, 2));
      } catch (e) {
        return text((e as Error).message, true);
      }
    },
  );

  server.registerTool(
    "add_icon",
    {
      title: "Add icon to project",
      description: `Write an icon's source into the user's project. Defaults: React projects get a .tsx component in src/components/icons; others get a Web Component. Needs a ${ctx.brandName} license that covers the icon.`,
      inputSchema: {
        slug: z.string().max(100),
        format: z.enum(SOURCE_FORMATS).optional().describe("react, web-component, svg-animated (no sound), svg (still), lottie (no sound) or json."),
        directory: z.string().max(200).optional().describe("Folder inside the project, relative to its root."),
      },
    },
    async ({ slug, format, directory }) => {
      try {
        const r = await addIcon(ctx, slug, { format, dir: directory });
        if (!r.ok) {
          const links = r.buyLinks?.length ? `\nAvailable in:\n${r.buyLinks.map((l) => `- ${l.title}${l.free ? " (free)" : ""}: ${l.url}`).join("\n")}` : "";
          return text(`${r.error}${links}`, true);
        }
        return text(`Added ${slug} (${r.format}) to ${r.iconsDir}.\nFiles: ${r.written?.length ? r.written.join(", ") : "already up to date"}\nLicense: ${r.license}\n\nUsage:\n${r.usage}`);
      } catch (e) {
        return text((e as Error).message, true);
      }
    },
  );

  server.registerTool(
    "project_info",
    {
      title: "Project setup",
      description: "Which framework was detected, the default format and icons folder, and whether license codes are configured.",
      inputSchema: {},
    },
    async () => {
      const t = resolveTarget(ctx, {});
      const codes = await ctx.codes();
      return text(
        JSON.stringify(
          { store: ctx.client.origin, framework: t.framework, defaultFormat: t.format, iconsFolder: t.iconsDir.replace(ctx.root, ".") || ".", licenses: codes.map(maskCode), licenseHelp: codes.length ? undefined : `Set ${ctx.licenseEnvName} in the MCP config or run "npx ${ctx.brand} login <code>".` },
          null,
          2,
        ),
      );
    },
  );

  return server;
}
