import type { AIProvider, ChatMessage, GenerationResult } from "./provider";
import { GeminiProvider } from "./geminiProvider";
import { GrokProvider } from "./grokProvider";
import { NemotronProvider } from "./nemotronProvider";
import { MindfulProvider } from "./mindfulProvider";
import { boundedCall } from "./boundedCall";

export interface ProviderEntry {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  isConfigured: boolean;
}

export type RoutingStrategy = "failover" | "round-robin" | "grok-first";

/**
 * Runs a pool of providers in order, failing over to the next on error or
 * empty response, then finally to `fallback`. Extracted as a standalone
 * function (rather than kept private inside MultiAIProvider) so the fault-
 * injection eval harness (eval/faultInjector.ts) can exercise the exact
 * same failover code path with mock providers, instead of re-implementing
 * failover logic separately and risking it drifting from production
 * behavior.
 */
export async function runProviderPool(
  pool: ProviderEntry[],
  messages: ChatMessage[],
  systemPrompt: string,
  fallback: AIProvider,
  fallbackModel = "offline-mindful-engine"
): Promise<GenerationResult> {
  const attempts: string[] = [];

  for (const entry of pool) {
    attempts.push(entry.name);
    try {
      const reply = await boundedCall(entry.provider, messages, systemPrompt, 45000);
      if (reply && reply.trim().length > 0) {
        return { reply, provider: entry.name, model: entry.model, attempts };
      }
    } catch (err: any) {
      console.warn(
        `[runProviderPool] ${entry.name} failed (${err?.message || err}). Failing over to next provider...`
      );
    }
  }

  attempts.push("Mindful Local (Fallback)");
  const fallbackReply = await fallback.generate(messages, systemPrompt);
  return {
    reply: fallbackReply,
    provider: "Mindful Local",
    model: fallbackModel,
    attempts,
  };
}

export class MultiAIProvider implements AIProvider {
  public readonly name = "Multi-AI Orchestrator (2x Gemini + 1x Grok + 1x NVIDIA Nemotron)";
  private providers: ProviderEntry[] = [];
  private fallback: MindfulProvider;
  private roundRobinIndex = 0;

  constructor() {
    this.fallback = new MindfulProvider();
    this.initProviders();
  }

  private initProviders() {
    this.providers = [];

    // 1. Gemini API 1 (Primary)
    const geminiKey1 = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
    const geminiModel1 = process.env.GEMINI_MODEL_1 || process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const isGemini1Valid = Boolean(geminiKey1 && !geminiKey1.includes("placeholder"));

    if (isGemini1Valid) {
      try {
        const p1 = new GeminiProvider({
          apiKey: geminiKey1,
          model: geminiModel1,
          name: "Gemini 1 (Primary)",
        });
        this.providers.push({
          id: "gemini-1",
          name: "Gemini 1 (Primary)",
          provider: p1,
          model: geminiModel1,
          isConfigured: true,
        });
      } catch (err) {
        console.warn("Failed to initialize Gemini 1:", err);
      }
    }

    // 2. Gemini API 2 (Secondary)
    const geminiKey2 = process.env.GEMINI_API_KEY_2;
    const geminiModel2 = process.env.GEMINI_MODEL_2 || "gemini-3.6-flash";
    const isGemini2Valid = Boolean(geminiKey2 && !geminiKey2.includes("placeholder"));

    if (isGemini2Valid) {
      try {
        const p2 = new GeminiProvider({
          apiKey: geminiKey2,
          model: geminiModel2,
          name: "Gemini 2 (Secondary)",
        });
        this.providers.push({
          id: "gemini-2",
          name: "Gemini 2 (Secondary)",
          provider: p2,
          model: geminiModel2,
          isConfigured: true,
        });
      } catch (err) {
        console.warn("Failed to initialize Gemini 2:", err);
      }
    }

    // 3. Grok API (xAI)
    const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    const grokModel = process.env.GROK_MODEL || "grok-2-latest";
    const isGrokValid = Boolean(grokKey && !grokKey.includes("placeholder"));

    if (isGrokValid) {
      try {
        const grok = new GrokProvider({
          apiKey: grokKey,
          model: grokModel,
          name: grokKey!.startsWith("gsk_") ? "Groq Cloud" : "Grok (xAI)",
        });
        this.providers.push({
          id: "grok",
          name: grok.name,
          provider: grok,
          model: grokModel,
          isConfigured: true,
        });
      } catch (err) {
        console.warn("Failed to initialize Grok:", err);
      }
    }

    // 4. NVIDIA Nemotron API (NIM) - smaller/faster variant for responsive failover chat tier
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const nemotronModel = process.env.NEMOTRON_MODEL || "nvidia/nemotron-3-nano-30b-a3b";
    const isNvidiaValid = Boolean(nvidiaKey && !nvidiaKey.includes("placeholder"));

    if (isNvidiaValid) {
      try {
        const nemotron = new NemotronProvider({
          apiKey: nvidiaKey,
          model: nemotronModel,
          name: "NVIDIA Nemotron Nano (NIM)",
        });
        this.providers.push({
          id: "nemotron",
          name: "NVIDIA Nemotron Nano (NIM)",
          provider: nemotron,
          model: nemotronModel,
          isConfigured: true,
        });
      } catch (err) {
        console.warn("Failed to initialize NVIDIA Nemotron:", err);
      }
    }
  }

  private getStrategy(): RoutingStrategy {
    const raw = (process.env.AI_STRATEGY || "failover").toLowerCase();
    if (raw === "round-robin" || raw === "roundrobin") return "round-robin";
    if (raw === "grok-first" || raw === "grok") return "grok-first";
    return "failover";
  }

  /**
   * Returns the list of providers in the execution order dictated by strategy
   */
  private getExecutionPool(): ProviderEntry[] {
    // Re-check in case env variables were updated dynamically
    if (this.providers.length === 0) {
      this.initProviders();
    }

    if (this.providers.length === 0) return [];

    const strategy = this.getStrategy();

    if (strategy === "round-robin") {
      const pool = [...this.providers];
      const startIdx = this.roundRobinIndex % pool.length;
      this.roundRobinIndex = (this.roundRobinIndex + 1) % pool.length;
      // Rotate pool so current index is first, followed by the others as failover
      return [...pool.slice(startIdx), ...pool.slice(0, startIdx)];
    }

    if (strategy === "grok-first") {
      const grok = this.providers.find((p) => p.id === "grok");
      const others = this.providers.filter((p) => p.id !== "grok");
      return grok ? [grok, ...others] : others;
    }

    // Default: failover in order of registration (Gemini 1 -> Gemini 2 -> Grok)
    return [...this.providers];
  }

  async generateWithDetails(
    messages: ChatMessage[],
    systemPrompt: string
  ): Promise<GenerationResult> {
    const pool = this.getExecutionPool();
    return runProviderPool(pool, messages, systemPrompt, this.fallback);
  }

  /** In-process evaluation access; never expose provider objects through HTTP. */
  getEvaluationProviders(): ProviderEntry[] { return [...this.getExecutionPool()]; }

  async generate(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    const result = await this.generateWithDetails(messages, systemPrompt);
    return result.reply;
  }

  getStatus() {
    const geminiKey1 = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
    const geminiKey2 = process.env.GEMINI_API_KEY_2;
    const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;

    const mask = (k?: string) => {
      if (!k || k.includes("placeholder")) return "Not configured (placeholder)";
      if (k.length <= 8) return "••••••••";
      return `${k.slice(0, 4)}••••${k.slice(-4)}`;
    };

    return {
      strategy: this.getStrategy(),
      providers: [
        {
          id: "gemini-1",
          name: "Gemini 1 (Primary)",
          model: process.env.GEMINI_MODEL_1 || process.env.GEMINI_MODEL || "gemini-3.6-flash",
          configured: Boolean(geminiKey1 && !geminiKey1.includes("placeholder")),
          keyPreview: mask(geminiKey1),
        },
        {
          id: "gemini-2",
          name: "Gemini 2 (Secondary)",
          model: process.env.GEMINI_MODEL_2 || "gemini-3.6-flash",
          configured: Boolean(geminiKey2 && !geminiKey2.includes("placeholder")),
          keyPreview: mask(geminiKey2),
        },
        {
          id: "grok",
          name: "Grok (xAI)",
          model: process.env.GROK_MODEL || "grok-2-latest",
          configured: Boolean(grokKey && !grokKey.includes("placeholder")),
          keyPreview: mask(grokKey),
        },
        {
          id: "nemotron",
          name: "NVIDIA Nemotron Nano (NIM)",
          model: process.env.NEMOTRON_MODEL || "nvidia/nemotron-3-nano-30b-a3b",
          configured: Boolean(process.env.NVIDIA_API_KEY && !process.env.NVIDIA_API_KEY.includes("placeholder")),
          keyPreview: mask(process.env.NVIDIA_API_KEY),
        },
        {
          id: "mindful-local",
          name: "Mindful Local Fallback",
          model: "contextual-mindfulness-rules",
          configured: true,
          keyPreview: "Built-in offline engine",
        },
      ],
      activeExternalCount: this.providers.length,
    };
  }
}

