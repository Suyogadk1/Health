import type { AIProvider, ChatMessage } from "./provider";

export interface NemotronProviderOptions {
  apiKey?: string;
  model?: string;
  name?: string;
}

// Server-side only. NVIDIA_API_KEY must never be exposed to the browser.
export class NemotronProvider implements AIProvider {
  private apiKey: string;
  public readonly model: string;
  public readonly name: string;

  constructor(options?: NemotronProviderOptions) {
    const key = options?.apiKey || process.env.NVIDIA_API_KEY || "";
    this.apiKey = key;
    // Default to the smaller/faster Nemotron variant for responsive chat tier failover
    this.model = options?.model || process.env.NEMOTRON_MODEL || "nvidia/nemotron-3-nano-30b-a3b";
    this.name = options?.name || "NVIDIA Nemotron (NIM)";
  }

  async generate(messages: ChatMessage[], systemPrompt: string, options?: { signal?: AbortSignal }): Promise<string> {
    if (!this.apiKey || this.apiKey.includes("placeholder")) {
      throw new Error(`NVIDIA API key is not configured for ${this.name}`);
    }
    const endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";

    const res = await fetch(endpoint, {
      signal: options?.signal,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${this.name} API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as any;
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${this.name} returned an empty response`);
    return text.trim();
  }
}

/**
 * Dedicated Nemotron Ultra provider for Agent B's safety reviewer.
 * Uses the large reasoning model "nvidia/nemotron-3-ultra-550b-a55b" (or NEMOTRON_ULTRA_MODEL).
 * Latency matters less here than safety reasoning quality.
 */
export class NemotronUltraProvider extends NemotronProvider {
  constructor(options?: NemotronProviderOptions) {
    super({
      apiKey: options?.apiKey,
      model: options?.model || process.env.NEMOTRON_ULTRA_MODEL || "nvidia/nemotron-3-ultra-550b-a55b",
      name: options?.name || "NVIDIA Nemotron Ultra (Safety Reviewer)",
    });
  }
}
