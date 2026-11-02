import type { AIProvider } from "./provider";
import { GeminiProvider } from "./geminiProvider";
import { GrokProvider } from "./grokProvider";
import { NemotronProvider, NemotronUltraProvider } from "./nemotronProvider";
import { MindfulProvider } from "./mindfulProvider";
import { MultiAIProvider } from "./multiProvider";

export { GeminiProvider, GrokProvider, NemotronProvider, NemotronUltraProvider, MindfulProvider, MultiAIProvider };
export type { AIProvider, ChatMessage, GenerationResult } from "./provider";

let sharedMultiProvider: MultiAIProvider | null = null;

export function getMultiAIProvider(): MultiAIProvider {
  if (!sharedMultiProvider) {
    sharedMultiProvider = new MultiAIProvider();
  }
  return sharedMultiProvider;
}

// Default provider function returning the multi-AI orchestrator
export function getAIProvider(): AIProvider {
  return getMultiAIProvider();
}
