import type { AIProvider, ChatMessage } from "./provider";

export interface GrokProviderOptions {
  apiKey?: string;
  model?: string;
  name?: string;
}

// Server-side only. GROK_API_KEY must never be exposed to the browser.
export class GrokProvider implements AIProvider {
  private apiKey: string;
  public readonly model: string;
  public readonly name: string;
  private isGroqCloud: boolean;

  constructor(options?: GrokProviderOptions) {
    const key = options?.apiKey || process.env.GROK_API_KEY || process.env.GROQ_API_KEY || process.env.XAI_API_KEY;
    if (!key || key.includes("placeholder")) {
      throw new Error(`Grok/Groq API key is not configured for ${options?.name || "Grok"}`);
    }
    this.apiKey = key;
    this.isGroqCloud = key.startsWith("gsk_");
    
    if (this.isGroqCloud) {
      this.model = options?.model || process.env.GROK_MODEL || "openai/gpt-oss-20b";
      this.name = options?.name || "Groq Cloud (Fast LPU)";
    } else {
      this.model = options?.model || process.env.GROK_MODEL || "grok-2-latest";
      this.name = options?.name || "Grok (xAI)";
    }
  }

  async generate(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    const endpoint = this.isGroqCloud
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.x.ai/v1/chat/completions";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 1000,
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
