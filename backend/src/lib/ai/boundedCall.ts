import type { AIProvider, ChatMessage } from "./provider";

/** Bound calls, cancel supported transports and always clear the timeout. */
export async function boundedCall(provider: AIProvider, messages: ChatMessage[], system: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.generate(messages, system, { signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { reject(new Error("provider_timeout")); controller.abort(); }, timeoutMs);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

/** Persist categories only: upstream error bodies may contain sensitive data. */
export function failureCategory(error: unknown): string {
  if (error instanceof SyntaxError) return "invalid_json";
  const text = error instanceof Error ? error.message : "";
  if (text.includes("provider_timeout")) return "timeout";
  const http = text.match(/\((\d{3})\)/);
  if (http) return `http_${http[1]}`;
  return "provider_error";
}
