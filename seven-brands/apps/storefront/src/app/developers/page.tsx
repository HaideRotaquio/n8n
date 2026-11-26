import type { Metadata } from "next";
import { designFor } from "@/designs";
import { devGuide } from "@/lib/developers";
import { requireStore } from "@/lib/store";

export const metadata: Metadata = { title: "For developers and AI agents" };

const box = "rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
const pre = "mt-2 overflow-x-auto rounded-[var(--radius)] bg-[var(--color-background)] p-3 font-mono text-xs leading-relaxed";

export default async function DevelopersPage() {
  const { brand, origin } = await requireStore();
  const { Page } = designFor(brand);
  const g = devGuide(brand, origin);
  return (
    <Page title="For developers and AI agents" intro={`Add ${brand.name} icons to your project from the terminal, or let your AI coding agent do it for you.`}>
      <section className={box}>
        <h2 className="text-lg font-bold">Let your AI coding agent add icons</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-text)]">
          Connect our MCP server and ask your agent things like “add a happy cat icon with sound to the hero section”. It can search the catalog, add the files to your project and show you how to use them.
        </p>
        <h3 className="mt-4 text-sm font-bold">Claude Code</h3>
        <pre className={pre}>{g.claudeCode}</pre>
        <h3 className="mt-4 text-sm font-bold">Cursor, Windsurf, VS Code and other MCP clients</h3>
        <pre className={pre}>{g.mcpJson}</pre>
        <p className="mt-2 text-xs text-[var(--color-muted-text)]">
          Your license code is on your account page and in your purchase email. Searching works without one; adding files needs a license that covers the icon. Free packs come with a code too.
        </p>
      </section>

      <section className={box}>
        <h2 className="text-lg font-bold">Command line</h2>
        <ul className="mt-2 space-y-3 text-sm">
          {g.commands.map((c) => (
            <li key={c.cmd}>
              <code className="font-mono text-xs">{c.cmd}</code>
              <p className="text-[var(--color-muted-text)]">{c.what}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--color-muted-text)]">
          You can also set the code with the <code className="font-mono">{g.licenseEnv}</code> environment variable, for example in CI.
        </p>
      </section>

      <section className={box}>
        <h2 className="text-lg font-bold">HTTP API</h2>
        <pre className={pre}>{g.api.join("\n")}</pre>
        <p className="mt-2 text-xs text-[var(--color-muted-text)]">
          A summary for AI tools is at <a className="underline" href="/llms.txt">/llms.txt</a>.
        </p>
      </section>
    </Page>
  );
}
