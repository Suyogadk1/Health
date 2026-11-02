import type { RiskLevel } from "@/types";
export type { RiskLevel };

export interface RiskAssessment {
  level: RiskLevel;
  matchedSignals: string[];
}
