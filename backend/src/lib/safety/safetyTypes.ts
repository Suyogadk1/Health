export type RiskLevel = "none" | "moderate" | "high";

export interface ClassifierTrace {
  status: "success" | "fallback" | "not_called";
  elapsedMs: number;
  errorCategory?: string;
  bypassReason?: "rules_high" | "not_configured";
  invalidLevel?: boolean;
}

export interface RiskAssessment {
  level: RiskLevel;
  matchedSignals: string[];
}

