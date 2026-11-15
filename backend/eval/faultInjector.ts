import { runProviderPool } from "../src/lib/ai/multiProvider";
import type { ProviderEntry } from "../src/lib/ai/multiProvider";
import { MindfulProvider } from "../src/lib/ai/mindfulProvider";
import type { AIProvider, ChatMessage } from "../src/lib/ai/provider";

/**
 * Feature 4 from the feature spec: exercise the real failover code path
 * (runProviderPool, extracted from MultiAIProvider) under simulated
 * provider outages, without making live API calls or needing real keys.
 *
 * A mock provider stands in for Gemini-1 / Gemini-2 / Grok. Each mock can
 * be told to succeed (with a canned reply and simulated latency) or fail
 * (simulating an API error / timeout). The local MindfulProvider fallback
 * is real (it's a rule-based offline engine already, no external calls),
 * so the "all external down" scenario exercises the actual fallback logic
 * a user would hit in production.
 */

export type MockBehavior = "success" | "fail" | "timeout";

export interface MockProviderConfig {
  id: string;
  name: string;
  model: string;
  behavior: MockBehavior;
  simulatedLatencyMs?: number;
  cannedReply?: string;
}

function createMockProvider(config: MockProviderConfig): AIProvider {
  return {
    name: config.name,
    async generate(_messages: ChatMessage[], _systemPrompt: string): Promise<string> {
      const delay = config.simulatedLatencyMs ?? 150;
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (config.behavior === "fail") {
        throw new Error(`Simulated failure for ${config.name}`);
      }
      if (config.behavior === "timeout") {
        // Simulate a hang that exceeds a reasonable client timeout budget.
        await new Promise((resolve) => setTimeout(resolve, 5000));
        throw new Error(`Simulated timeout for ${config.name}`);
      }
      return (
        config.cannedReply ??
        `[mock reply from ${config.name}] I hear that this has been a hard week. What's been weighing on you most?`
      );
    },
  };
}

export interface FaultScenario {
  label: string;
  description: string;
  providers: MockProviderConfig[];
}

/**
 * The four scenarios from the feature spec's fault-injection study.
 * Extend this list to add more granular scenarios (e.g. Gemini-1 slow but
 * not fully down, intermittent failures, etc).
 */
export const SCENARIOS: FaultScenario[] = [
  {
    label: "nominal",
    description: "All providers healthy, Gemini-1 handles the request",
    providers: [
      { id: "gemini-1", name: "Gemini 1 (Primary)", model: "gemini-3.6-flash", behavior: "success", simulatedLatencyMs: 420 },
      { id: "gemini-2", name: "Gemini 2 (Secondary)", model: "gemini-3.6-flash", behavior: "success", simulatedLatencyMs: 400 },
      { id: "grok", name: "Grok (xAI)", model: "openai/gpt-oss-20b", behavior: "success", simulatedLatencyMs: 250 },
    ],
  },
  {
    label: "gemini1-down",
    description: "Primary Gemini fails, falls over to Gemini-2",
    providers: [
      { id: "gemini-1", name: "Gemini 1 (Primary)", model: "gemini-3.6-flash", behavior: "fail" },
      { id: "gemini-2", name: "Gemini 2 (Secondary)", model: "gemini-3.6-flash", behavior: "success", simulatedLatencyMs: 400 },
      { id: "grok", name: "Grok (xAI)", model: "openai/gpt-oss-20b", behavior: "success", simulatedLatencyMs: 250 },
    ],
  },
  {
    label: "gemini-both-down",
    description: "Both Gemini providers fail, falls over to Grok",
    providers: [
      { id: "gemini-1", name: "Gemini 1 (Primary)", model: "gemini-3.6-flash", behavior: "fail" },
      { id: "gemini-2", name: "Gemini 2 (Secondary)", model: "gemini-3.6-flash", behavior: "fail" },
      { id: "grok", name: "Grok (xAI)", model: "openai/gpt-oss-20b", behavior: "success", simulatedLatencyMs: 250 },
    ],
  },
  {
    label: "all-external-down",
    description: "All three external providers fail, drops to local MindfulProvider",
    providers: [
      { id: "gemini-1", name: "Gemini 1 (Primary)", model: "gemini-3.6-flash", behavior: "fail" },
      { id: "gemini-2", name: "Gemini 2 (Secondary)", model: "gemini-3.6-flash", behavior: "fail" },
      { id: "grok", name: "Grok (xAI)", model: "openai/gpt-oss-20b", behavior: "fail" },
    ],
  },
];

export interface ScenarioRunResult {
  scenario: string;
  description: string;
  finalProvider: string;
  finalModel?: string;
  attempts: string[];
  latencyMs: number;
  reply: string;
}

export async function runScenario(
  scenario: FaultScenario,
  messages: ChatMessage[],
  systemPrompt: string
): Promise<ScenarioRunResult> {
  const pool: ProviderEntry[] = scenario.providers.map((cfg) => ({
    id: cfg.id,
    name: cfg.name,
    provider: createMockProvider(cfg),
    model: cfg.model,
    isConfigured: true,
  }));

  const localFallback = new MindfulProvider();
  const start = Date.now();
  const result = await runProviderPool(pool, messages, systemPrompt, localFallback);
  const latencyMs = Date.now() - start;

  return {
    scenario: scenario.label,
    description: scenario.description,
    finalProvider: result.provider,
    finalModel: result.model,
    attempts: result.attempts ?? [],
    latencyMs,
    reply: result.reply,
  };
}

export async function runAllScenarios(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<ScenarioRunResult[]> {
  const results: ScenarioRunResult[] = [];
  for (const scenario of SCENARIOS) {
    results.push(await runScenario(scenario, messages, systemPrompt));
  }
  return results;
}
