/**
 * Builds one self-contained npm package per brand into dist/<brand>/ (e.g. `npx moodicons …`):
 * a single bundled cli.js (MCP SDK and zod included), the <daos-asset> player runtime and a README.
 * Store addresses come from STORE_URL_<BRAND> at build time (e.g. STORE_URL_MOODICONS=https://moodicons.com);
 * without one, users pass --store or set <BRAND>_STORE_URL.
 *
 *   pnpm --filter @sb/cli build            then   cd dist/moodicons && npm publish
 */
import { build } from "esbuild";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlayerBundle } from "@sb/export";
import { BRAND_NAMES } from "../src/context";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.env.CLI_VERSION ?? "0.1.0";
const player = await buildPlayerBundle();

for (const [brand, name] of Object.entries(BRAND_NAMES)) {
  const out = path.join(root, "dist", brand);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const store = process.env[`STORE_URL_${brand.toUpperCase()}`] ?? "";
  await build({
    entryPoints: [path.join(root, "src/cli.ts")],
    outfile: path.join(out, "cli.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    minify: true,
    legalComments: "inline",
    // The dev-only fallback that builds the player from source is never reached: the runtime ships next to cli.js.
    external: ["@sb/export"],
    banner: { js: "#!/usr/bin/env node\nimport { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    define: { __BRAND__: JSON.stringify(brand), __DEFAULT_STORE__: JSON.stringify(store), __VERSION__: JSON.stringify(version) },
  });
  await chmod(path.join(out, "cli.js"), 0o755);
  await writeFile(path.join(out, "daos-player.js"), player);
  await writeFile(
    path.join(out, "package.json"),
    `${JSON.stringify(
      {
        name: brand,
        version,
        description: `${name}: add animated icons with sound to your project from the terminal or your AI coding agent (MCP server included).`,
        type: "module",
        bin: { [brand]: "cli.js" },
        files: ["cli.js", "daos-player.js", "README.md"],
        engines: { node: ">=20" },
        license: "SEE LICENSE IN README.md",
        keywords: ["icons", "animated icons", "sound", "mcp", "react", "web components", brand],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(out, "README.md"),
    `# ${name}

Add ${name} animated icons (motion + synced sound) to your project.

\`\`\`sh
npx ${brand} search "happy"
npx ${brand} login YOUR-LICENSE-CODE
npx ${brand} add face-happy
\`\`\`

## AI coding agents (MCP)

Claude Code:

\`\`\`sh
claude mcp add ${brand} --env ${brand.toUpperCase()}_LICENSE=YOUR-LICENSE-CODE -- npx -y ${brand} mcp
\`\`\`

Other MCP clients:

\`\`\`json
{ "mcpServers": { "${brand}": { "command": "npx", "args": ["-y", "${brand}", "mcp"], "env": { "${brand.toUpperCase()}_LICENSE": "YOUR-LICENSE-CODE" } } } }
\`\`\`

Tools: search_icons, get_icon, add_icon, project_info. Icons are written only inside the project folder, with an
ICON-LICENSES.md record of the license that covers each one.

## License

This tool is free to use. The icons it installs are licensed per purchase under the ${name} license terms
(see your store's /help/licenses page). daos-player.js is licensed together with the icons you purchased.
`,
  );
  console.log(`Built ${brand} → ${path.relative(process.cwd(), out)}${store ? ` (store ${store})` : " (no default store)"}`);
}
