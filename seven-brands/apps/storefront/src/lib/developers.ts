import type { Brand } from "@sb/db";

/**
 * Setup text shared by /developers and /llms.txt. The CLI is published to npm under the brand's slug
 * (`npx moodicons …`), and the same binary runs the MCP server (`npx moodicons mcp`).
 */
export function devGuide(brand: Brand, origin: string) {
  const cli = brand.slug;
  const mcpJson = JSON.stringify({ mcpServers: { [cli]: { command: "npx", args: ["-y", cli, "mcp"], env: { [`${cli.toUpperCase()}_LICENSE`]: "YOUR-LICENSE-CODE" } } } }, null, 2);
  return {
    cli,
    licenseEnv: `${cli.toUpperCase()}_LICENSE`,
    commands: [
      { cmd: `npx ${cli} search "happy cat"`, what: "Find icons by name, mood or tag." },
      { cmd: `npx ${cli} login YOUR-LICENSE-CODE`, what: "Save your license code on this computer (from your account page or purchase email)." },
      { cmd: `npx ${cli} add chibi-kai-cool`, what: "Add an icon to your project. React projects get a component; others get the Web Component." },
      { cmd: `npx ${cli} add face-happy --format svg-animated`, what: "Pick a format: react, web-component, svg-animated, svg, lottie, json." },
    ],
    claudeCode: `claude mcp add ${cli} --env ${cli.toUpperCase()}_LICENSE=YOUR-LICENSE-CODE -- npx -y ${cli} mcp`,
    mcpJson,
    api: [
      `GET  ${origin}/api/v1/icons?q=happy%20cat     search (public)`,
      `GET  ${origin}/api/v1/icons/<slug>            details, formats, where to buy (public)`,
      `GET  ${origin}/api/v1/icons/<slug>/preview.svg  still preview (public)`,
      `POST ${origin}/api/v1/icons/<slug>/files      {"format":"react"}, header Authorization: Bearer <license code>`,
    ],
  };
}

export function llmsTxt(brand: Brand, origin: string): string {
  const g = devGuide(brand, origin);
  return `# ${brand.name}

> ${brand.name} sells animated icons where motion and sound are designed together. Each icon is an SVG animation with synced, optionally stereo-panned sound, delivered as a React component, a Web Component (<daos-asset>), animated SVG, Lottie JSON or raw Asset Definition JSON. Sound starts only after a user click (browser autoplay rules) and icons respect prefers-reduced-motion.

## Install icons into a project (for AI coding agents)

- Preferred: the MCP server. Add it with \`${g.claudeCode}\` (Claude Code) or this JSON in your client's MCP config:

\`\`\`json
${g.mcpJson}
\`\`\`

  Tools: search_icons, get_icon, add_icon (writes files into the project), list_formats.
- Or the CLI: ${g.commands.map((c) => `\`${c.cmd}\``).join(", ")}.
- Adding files needs a license code that covers the icon (env ${g.licenseEnv}, or \`npx ${g.cli} login\`). Searching does not. Never invent license codes; if the user has none, link them to the product page the API returns.

## Using an installed icon

- React: \`import { ChibiKaiCool } from "./icons/ChibiKaiCool";\` then \`<ChibiKaiCool />\`. Props: autoplay, speed, tokens (color overrides), label, scroll ("scrub" | "in-view"), scrollLoops. Needs icons/daos-player.js next to it (the CLI adds it).
- Web Component: \`<script src="icons/daos-player.js" defer></script>\` then \`<daos-asset src="icons/<slug>.json" autoplay></daos-asset>\`. Call element.unmute() from a click handler to enable sound.
- Animated SVG works in <img> but has no sound. Lottie has no sound.

## HTTP API

${g.api.map((l) => `- ${l}`).join("\n")}

## Licenses

- Every download is licensed per purchase: ${origin}/help/licenses
- Verify a license: ${origin}/licenses/verify
- Browse and buy: ${origin}/
`;
}
