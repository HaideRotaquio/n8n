import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SOURCE_FORMATS } from "./client";
import { addIcon, login, logout, searchIcons } from "./commands";
import { brandFrom, createContext, VERSION } from "./context";
import { maskCode } from "./credentials";
import { createMcpServer } from "./mcp";

interface Args {
  cmd?: string;
  rest: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): Args {
  const out: Args = { rest: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2) as [string, string | undefined];
      const boolean = ["force", "json", "help", "version"].includes(k);
      out.flags[k] = v ?? (boolean ? true : (argv[++i] ?? ""));
    } else if (a === "-h") out.flags.help = true;
    else if (!out.cmd) out.cmd = a;
    else out.rest.push(a);
  }
  return out;
}

function help(brand: string) {
  return `${brand} ${VERSION} — animated icons with sound, from the terminal or your AI coding agent.

Usage:
  npx ${brand} search <words>            find icons (no license needed)
  npx ${brand} add <slug> [<slug>…]      add icons to this project
        --format ${SOURCE_FORMATS.join("|")}
        --dir <folder>                   default: src/components/icons (React) or icons/
        --force                          overwrite changed files
  npx ${brand} login <license-code>      save a license code on this computer
  npx ${brand} licenses                  list saved license codes (masked)
  npx ${brand} logout                    forget saved codes for this store
  npx ${brand} mcp                       run the MCP server for AI coding agents

Options: --store <url>, --json. License codes can also come from ${brand.toUpperCase()}_LICENSE (comma-separated).
`;
}

export async function main(argv: string[], io: { out: (s: string) => void; err: (s: string) => void } = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) }): Promise<number> {
  const a = parseArgs(argv);
  const brand = brandFrom({ brand: typeof a.flags.brand === "string" ? a.flags.brand : undefined });
  if (a.flags.version) return io.out(`${VERSION}\n`), 0;
  if (!a.cmd || a.flags.help || a.cmd === "help") return io.out(help(brand)), a.cmd || a.flags.help ? 0 : 1;
  const ctx = createContext({ brand, store: typeof a.flags.store === "string" ? a.flags.store : undefined });
  const json = Boolean(a.flags.json);

  switch (a.cmd) {
    case "search": {
      const q = a.rest.join(" ");
      const icons = await searchIcons(ctx, q, Number(a.flags.limit ?? 20) || 20);
      if (json) return io.out(`${JSON.stringify(icons, null, 2)}\n`), 0;
      if (!icons.length) return io.out(`No icons match "${q}".\n`), 0;
      for (const i of icons) io.out(`${i.slug.padEnd(32)} ${i.name}${i.hasSound ? "  ♪" : ""}\n${"".padEnd(33)}${i.products.map((p) => `${p.title}${p.free ? " (free)" : ""}`).join(" · ")}\n`);
      io.out(`\nAdd one: npx ${brand} add ${icons[0]!.slug}\n`);
      return 0;
    }
    case "add": {
      if (!a.rest.length) return io.err(`Name at least one icon, e.g. npx ${brand} add face-happy\n`), 1;
      let failed = 0;
      const results = [];
      for (const slug of a.rest) {
        const r = await addIcon(ctx, slug, { format: a.flags.format as string | undefined, dir: a.flags.dir as string | undefined, force: Boolean(a.flags.force) });
        results.push(r);
        if (json) continue;
        if (r.ok) io.out(`✓ ${slug} → ${r.iconsDir} (${r.format})${r.written?.length ? "" : " — already up to date"}\n${r.setup ? `  Setup (once): ${r.setup}\n` : ""}  ${r.usage?.split("\n").join("\n  ")}\n`);
        else {
          failed++;
          io.err(`✗ ${slug}: ${r.error}\n${(r.buyLinks ?? []).map((l) => `  ${l.title}${l.free ? " (free)" : ""}: ${l.url}\n`).join("")}`);
        }
      }
      if (json) io.out(`${JSON.stringify(results, null, 2)}\n`);
      return failed ? 1 : 0;
    }
    case "login": {
      const r = await login(ctx, a.rest[0] ?? "");
      (r.ok ? io.out : io.err)(`${r.message}\n`);
      return r.ok ? 0 : 1;
    }
    case "licenses": {
      const codes = await ctx.codes();
      io.out(codes.length ? `${codes.map(maskCode).join("\n")}\n` : `No license codes. Run: npx ${brand} login <code>\n`);
      return 0;
    }
    case "logout":
      io.out(`${await logout(ctx)}\n`);
      return 0;
    case "mcp": {
      const server = createMcpServer(ctx);
      await server.connect(new StdioServerTransport());
      return -1; // keeps running until the client disconnects
    }
    default:
      io.err(`Unknown command "${a.cmd}".\n\n${help(brand)}`);
      return 1;
  }
}

declare const __BRAND__: string | undefined;
// Built packages always run (npm starts them through a .bin symlink); from source, only when this file is the entry.
const isEntry = typeof __BRAND__ === "string" || (process.argv[1] !== undefined && /cli\.(ts|js|mjs)$/.test(process.argv[1]));
if (isEntry) {
  main(process.argv.slice(2))
    .then((code) => {
      if (code >= 0) process.exitCode = code;
    })
    .catch((e: Error) => {
      process.stderr.write(`${e.message}\n`);
      process.exitCode = 1;
    });
}
