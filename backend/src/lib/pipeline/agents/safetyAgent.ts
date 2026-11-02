import { HIGH_RISK_RESPONSE } from "../../safety/safetyResponse";
import type { SafetyGateInput, SafetyGateOutput } from "../types";

/** Agent 5 - pre-generation gate: high-risk input never reaches a generation model. */
export async function safetyAgent(input: SafetyGateInput): Promise<SafetyGateOutput> {
  if (input.risk.level === "high") {
    return { level: "high", shortCircuit: true, shortCircuitReply: HIGH_RISK_RESPONSE };
  }
  return { level: input.risk.level, shortCircuit: false };
}
