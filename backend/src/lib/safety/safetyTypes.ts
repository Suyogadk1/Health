export type RiskLevel = "none" | "moderate" | "high";

export interface RiskAssessment {
  level: RiskLevel;
  matchedSignals: string[];
}

