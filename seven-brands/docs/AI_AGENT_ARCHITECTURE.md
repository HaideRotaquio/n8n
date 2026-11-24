# AI agent architecture

Status: **design** (Phase 2). No agent runs today and no AI provider key is configured.

## Shape of an agent

```ts
interface Agent<I, O> {
  name: "creative_director" | "svg_production" | "animation" | "sound_design" | "sync" | "qa" | "catalog" | "publishing" | "bi";
  input: ZodType<I>;
  output: ZodType<O>;
  run(input: I, ctx: AgentContext): Promise<O>;   // ctx: provider, budget, logger, read-only lookups
}
```

- Agents are **workflow steps**, not open-ended loops: code orchestrates, the model fills a typed slot (structured outputs).
- The orchestrator (worker) validates output, persists it to `agent_task`, and advances the job. Agents never write to the database themselves.

## Provider independence

`ModelProvider` interface: `generateStructured(schema, prompt, opts)`, `generateText`, `batch`. First adapter: Anthropic Messages API. Model per agent is configuration (default to the most capable model; cheaper tiers only where an eval shows equal quality). Image/sound providers get their own small interfaces.

## Permissions

| Agent | May read | May write (via orchestrator) | Never |
|---|---|---|---|
| Creative Director | Brand config, catalog stats | Briefs, concepts | — |
| SVG / Animation / Sound / Sync | Brief, rig library | Draft asset versions | Publish |
| QA | Asset version, renders | `quality_review` | Approve for publish |
| Catalog | Asset version | Draft metadata | Prices |
| Publishing | Approved items | Publishing job **after human approval** | Prices, refunds |
| BI | Aggregates | Reports | Customer PII |

No agent gets secrets, payment operations, refunds, license changes, customer PII or destructive infrastructure access. Every action is logged; high-impact actions need a human approval recorded in `audit_log`.

## Cost control

Token usage and USD cost recorded per `agent_task`; daily and monthly caps enforced before each call; batch API for collections; prompt caching for brand style guides. Estimates: `COST_MODEL.md`.

## Quality

Each LLM-backed agent gets a small eval set (inputs + graders) before it's used in production; model or prompt changes must not reduce the score.
