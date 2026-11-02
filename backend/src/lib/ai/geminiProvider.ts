import type { AIProvider, ChatMessage } from "./provider";

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  name?: string;
}

// Server-side only. GEMINI_API_KEY must never be exposed to the browser.
export class GeminiProvider implements AIProvider {
  private apiKey: string;
  public readonly model: string;
  public readonly name: string;

  constructor(options?: GeminiProviderOptions) {
    const key = options?.apiKey || process.env.GEMINI_API_KEY;
    if (!key || key.includes("placeholder")) {
      throw new Error(`Gemini API key is not configured for ${options?.name || "Gemini"}`);
    }
    this.apiKey = key;
    this.model = options?.model || process.env.GEMINI_MODEL || "gemini-3.6-flash";
    this.name = options?.name || "Gemini";
  }

  async generate(messages: ChatMessage[], systemPrompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${this.name} API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`${this.name} returned an empty response`);
    return text.trim();
  }
}
