import { createServer, type Server } from "node:http";
import { BRAND_DEFINITIONS } from "@sb/brands";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AnthropicProvider,
  BudgetExceededError,
  budgetFromEnv,
  ConceptSchema,
  costFor,
  FIXTURE_CONCEPT,
  freshFixtureOutputs,
  FIXTURE_PLAN,
  FIXTURE_SVG,
  FixtureProvider,
  providerFromEnv,
  runAiProduction,
  type AgentCallRecord,
} from "./index";

const mood = BRAND_DEFINITIONS.moodicons.config;

function deps(provider: FixtureProvider, budgetLeft = Infinity) {
  const calls: AgentCallRecord[] = [];
  let spent = 0;
  return {
    calls,
    deps: {
      provider,
      onAgentCall: async (r: AgentCallRecord) => {
        calls.push(r);
        spent++;
      },
      checkBudget: async () => {
        if (spent >= budgetLeft) throw new BudgetExceededError("Daily AI budget reached");
      },
    },
  };
}

describe("AI production pipeline (fixture provider)", () => {
  it("produces a valid, QA-clean asset marked as fixture provenance", async () => {
    const { deps: d, calls } = deps(new FixtureProvider(freshFixtureOutputs()));
    const r = await runAiProduction(mood, { prompt: "a celebratory star" }, d);
    expect(r.definition.slug).toBe("sparkle-star");
    expect(r.definition.provenance.method).toBe("fixture");
    expect(r.qa.errors).toEqual([]);
    expect(r.qa.passed).toBe(true);
    expect(r.definition.sounds[0]!.sound).toBe("synth:chime");
    expect(calls.map((c) => c.agent)).toEqual(["creative_director", "svg_artist", "animator"]);
    expect(calls.every((c) => c.status === "succeeded" && c.costUsd === 0)).toBe(true);
  });

  it("repairs an SVG the importer rejected", async () => {
    const evil = { svg: '<svg viewBox="0 0 64 64"><script>alert(1)</script></svg>', notes: "x" };
    const p = new FixtureProvider({ ...freshFixtureOutputs(), svg_artist: [evil, FIXTURE_SVG] });
    const { deps: d } = deps(p);
    const r = await runAiProduction(mood, { prompt: "star" }, d);
    expect(r.qa.passed).toBe(true);
    const second = p.calls.filter((c) => c.agent === "svg_artist")[1]!;
    expect(second.prompt).toContain("rejected by the importer");
  });

  it("repairs a motion plan that fails QA, and drops tracks for unknown layers", async () => {
    const bad = structuredClone(FIXTURE_PLAN);
    bad.tracks[2]!.keyframes[1]!.value = 1.5; // opacity above 1 → QA error
    bad.tracks.push({ target: "does-not-exist", property: "rotate", origin: [0, 0], keyframes: [{ at: 0, value: 0, ease: "linear" }] });
    const p = new FixtureProvider({ ...freshFixtureOutputs(), animator: [bad, FIXTURE_PLAN] });
    const r = await runAiProduction(mood, { prompt: "star" }, deps(p).deps);
    expect(r.qa.errors).toEqual([]);
    expect(p.calls.filter((c) => c.agent === "animator")).toHaveLength(2);
  });

  it("stops when the budget is exhausted", async () => {
    const { deps: d, calls } = deps(new FixtureProvider(freshFixtureOutputs()), 1);
    await expect(runAiProduction(mood, { prompt: "star" }, d)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls).toHaveLength(1);
  });

  it("records failed calls too", async () => {
    const { deps: d, calls } = deps(new FixtureProvider({}));
    await expect(runAiProduction(mood, { prompt: "star" }, d)).rejects.toThrow(/No fixture/);
    expect(calls[0]!.status).toBe("failed");
  });
});

describe("costs & config", () => {
  it("prices tokens per model and treats unknown models conservatively", () => {
    const u = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(costFor("claude-opus-5-5", u)).toBe(24);
    expect(costFor("claude-haiku-5-5", u)).toBeCloseTo(0.6);
    expect(costFor("mystery-model", u)).toBe(60);
  });
  it("selects providers explicitly; never falls back to fixtures silently", () => {
    expect(providerFromEnv({}).configured).toBe(false);
    const f = providerFromEnv({ DAOS_AI_PROVIDER: "fixture" });
    expect(f.configured && f.label).toContain("not AI");
    const a = providerFromEnv({ DAOS_ANTHROPIC_API_KEY: "sk-test" });
    expect(a.configured && a.provider.name).toBe("anthropic");
    expect(budgetFromEnv({ DAOS_AI_DAILY_BUDGET_USD: "2" })).toEqual({ dailyUsd: 2, monthlyUsd: 50 });
    expect(budgetFromEnv({ DAOS_AI_DAILY_BUDGET_USD: "-3" }).dailyUsd).toBe(5);
  });
});

describe("Anthropic adapter contract (local fake API)", () => {
  let server: Server;
  let url = "";
  const received: { headers: Record<string, unknown>; body: any }[] = [];
  let reply: (body: any) => { status: number; json: unknown } = () => ({ status: 500, json: {} });

  beforeAll(async () => {
    server = createServer((req, res) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        const body = JSON.parse(data || "{}");
        received.push({ headers: req.headers, body });
        const r = reply(body);
        res.writeHead(r.status, { "content-type": "application/json" });
        res.end(JSON.stringify(r.json));
      });
    });
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => server.close());

  const message = (text: string, extra: Record<string, unknown> = {}) => ({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 800, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 },
    ...extra,
  });

  it("sends structured-output, fallback and caching parameters, and parses the typed result", async () => {
    reply = () => ({ status: 200, json: message(JSON.stringify(FIXTURE_CONCEPT)) });
    const p = new AnthropicProvider({ apiKey: "sk-test-not-real", baseURL: url });
    const r = await p.generate({ agent: "creative_director", system: "SYS", prompt: "Brief", schema: ConceptSchema, effort: "high" });
    expect(r.output.slug).toBe("sparkle-star");
    expect(r.model).toBe("claude-opus-5-5");
    expect(r.costUsd).toBeCloseTo((1200 * 4 + 800 * 20 + 1000 * 0.2) / 1e6, 9);
    const sent = received.at(-1)!;
    // SDK 1.x sends API keys as a bearer token.
    expect(String(sent.headers["x-api-key"] ?? sent.headers.authorization)).toContain("sk-test-not-real");
    expect(String(sent.headers["anthropic-beta"])).toContain("server-side-fallback-2026-07-01");
    expect(sent.body.model).toBe("claude-opus-5-5");
    expect(sent.body.fallbacks).toBe("default");
    expect(sent.body.output_config.effort).toBe("high");
    expect(sent.body.output_config.format.type).toBe("json_schema");
    expect(sent.body.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(sent.body.temperature).toBeUndefined();
  });

  it("maps refusals and auth failures to non-retryable errors", async () => {
    const p = new AnthropicProvider({ apiKey: "sk-test-not-real", baseURL: url });
    reply = () => ({ status: 200, json: message("", { stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: "" } }) });
    await expect(p.generate({ agent: "x", system: "s", prompt: "p", schema: ConceptSchema })).rejects.toMatchObject({ retryable: false });
    reply = () => ({ status: 401, json: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } });
    await expect(p.generate({ agent: "x", system: "s", prompt: "p", schema: ConceptSchema })).rejects.toThrow(/DAOS_ANTHROPIC_API_KEY/);
  });

  it("does not pick up the tooling's ANTHROPIC_BASE_URL", () => {
    const p = new AnthropicProvider({ apiKey: "k" }) as any;
    expect(p.client.baseURL).toBe("https://api.anthropic.com");
  });
});

describe("catalog writer", async () => {
  const { runCatalogCopy, FixtureProvider, freshFixtureOutputs, catalogWriterPrompt } = await import("./index");
  const { BRAND_DEFINITIONS } = await import("@sb/brands");
  const brand = BRAND_DEFINITIONS.moodicons.config;
  it("produces cleaned, bounded copy and records the call", async () => {
    const calls: string[] = [];
    const copy = await runCatalogCopy(
      brand,
      { kind: "pack", currentTitle: "Happy Face", formats: "SVG, Lottie", assets: [{ name: "Happy Face", label: "Smiling face bouncing happily", category: "happiness", tags: ["happy", "smile"], durationMs: 1000, sounds: 1 }] },
      { provider: new FixtureProvider(freshFixtureOutputs()), onAgentCall: async (r) => void calls.push(r.agent), checkBudget: async () => {} },
    );
    expect(copy.title).toBe("Happy Face");
    expect(copy.description).toContain("Fixture copy, not AI");
    expect(copy.tags).toContain("happy");
    expect(calls).toEqual(["catalog_writer"]);
  });
  it("tells the model not to invent features or mention AI and prices", () => {
    const p = catalogWriterPrompt(brand);
    expect(p).toMatch(/Never invent/);
    expect(p).toMatch(/Never mention AI, prices/);
  });
});
