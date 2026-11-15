export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIProvider {
  name: string;
  generate(messages: ChatMessage[], systemPrompt: string, options?: { signal?: AbortSignal }): Promise<string>;
}

export interface GenerationResult {
  reply: string;
  provider: string;
  model?: string;
  attempts?: string[];
}
