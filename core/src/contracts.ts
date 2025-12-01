export type PredictabilityLevel = 1 | 2 | 3 | 4 | 5;

export interface PredictabilityDimensions {
  T: number; // temporal predictability in [0, 1]
  C: number; // confidence predictability in [0, 1]
  L: number; // learning predictability in [0, 1]
}

export interface ModifierScores {
  O: number; // Observability / Transparency
  I: number; // Controllability / Intervention Capability
  X: number; // Cross-Context Consistency
  Lp: number; // Latency Predictability
  F: number; // Feedback Responsiveness
  S: number; // Safety Posture / Risk Exposure
  A: number; // Social Alignment
  D: number; // External Context Drift
}

export type Stakes = 'low' | 'medium' | 'high';
export type Expertise = 'novice' | 'intermediate' | 'expert';

export interface SystemProfilePayload {
  stakes: Stakes;
  expertise: Expertise;
  confidenceBadges: boolean;
  interruptButton: boolean;
  safeMode: boolean;
  rationaleView: boolean;
}

export interface UserAnnotations {
  trust?: number; // perceived trust in outputs (analogous to Q2)
  expectedVariation?: number; // perceived variation across repeated uses (Q3)
  uncertaintyCommunication?: number; // perceived clarity of uncertainty communication (Q4)
  learnability?: number; // perceived learnability after repeated use (Q5)
  checkingFrequency?: number; // how often outputs require checking (Q6)
  transparencyControllabilityEffect?: number; // perceived benefit from added O/I (Q7)
}

export interface PredictabilityMetrics {
  temporalEntropy?: number; // normalized entropy of output distribution [0, 1]
  temporalVariationRate?: number; // proportion of distinct outputs vs total samples [0, 1]
  temporalStabilityFromClassifier?: number; // existing proxy from repeated Gemini classification [0, 1]
}

export interface DimensionRationale {
  overall?: string;
  T?: string;
  C?: string;
  L?: string;
  cues?: string[]; // textual cues (e.g., uncertainty phrases) that influenced assessment
}

export interface ClassificationInput {
  systemId?: string;
  systemDescription?: string;
  prompt: string;
  response?: string;
  responseSamples?: string[]; // optional multiple outputs from the underlying AI system
  profile?: SystemProfilePayload;
  userAnnotations?: UserAnnotations;
  timestamp?: string;
}

export interface DesignGuidanceItem {
  id: string;
  title: string;
  summary: string;
  category: 'interface' | 'explanation' | 'trust' | 'transition';
  level: PredictabilityLevel;
}

export interface ClassificationOutput {
  level: PredictabilityLevel;
  dimensions: PredictabilityDimensions;
  modifiers?: ModifierScores;
  overallScore: number;
  domainScore?: number;
  notes?: string[];
  guidance?: DesignGuidanceItem[];
  metrics?: PredictabilityMetrics;
  rationale?: DimensionRationale;
  version: string;
}


