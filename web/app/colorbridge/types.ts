export type StepId =
  | "load"
  | "analysis"
  | "confirm"
  | "history"
  | "sampling"
  | "trace";

export type LabValue = {
  l: number;
  a: number;
  b: number;
};

export type LightingCondition = {
  cctKelvin: number;
  illuminanceLux: number;
  viewingAngle: number;
  textureGloss: number;
};

export type ImagePromptHints = {
  colorDescription: string;
  imageRisk: string;
  materialHint: string;
  followUpSuggestion: string;
};

export type ReferenceSource = "history-case" | "ai-extracted-fallback";

export type StructuredAnalysis = {
  colorIntent: string;
  targetColorName: string;
  avoidHueRisk: string;
  fabric: string;
  baseCloth: string | null;
  illuminant: string | null;
  targetLab: LabValue | null;
  deltaEThreshold: number | null;
  missingFields: string[];
  confidence: number;
  followUpQuestions: string[];
};

export type ConfirmedRequirement = {
  illuminant: string;
  reviewIlluminant?: string;
  productionMaterial?: string;
  dyeType?: string;
  baseCloth: string;
  targetLab: LabValue;
  deltaEThreshold: number;
  lighting?: LightingCondition;
  toleranceMode?: "deltaE76" | "cmc";
  confirmationNote?: string;
  imagePromptHints?: ImagePromptHints;
  referenceSource?: ReferenceSource;
};

export type HistoricalCaseView = {
  id: string;
  name: string;
  sourceType?: string;
  fabric: string;
  dyeType?: string | null;
  baseCloth: string;
  lab: LabValue;
  similarityScore?: number | null;
  similarityReason: string;
  riskNote: string;
  selected?: boolean;
};

export type SampleAttemptView = {
  id: string;
  version: string;
  schemeName?: string;
  lab: LabValue;
  targetLab?: LabValue;
  aiLab?: LabValue | null;
  historicalCaseId?: string | null;
  productionMaterial?: string | null;
  baseCloth?: string | null;
  dyeType?: string | null;
  illuminant?: string | null;
  illuminantLabel?: string | null;
  reviewIlluminant?: string | null;
  reviewIlluminantLabel?: string | null;
  cctKelvin?: number | null;
  illuminanceLux?: number | null;
  viewingAngle?: number | null;
  textureGloss?: number | null;
  confirmationSummary?: string;
  confirmationSnapshot?: ConfirmedRequirement | null;
  deltaE: number;
  passed: boolean;
  recommendation?: string;
  deviation: string;
  selected?: boolean;
  confirmedAt?: string | null;
};

export type TraceEventView = {
  id: string;
  eventType?: string;
  actor?: string;
  label: string;
  detail: string;
  snapshot?: unknown;
  createdAt: string;
};

export type WorkbenchState = {
  orderId: string | null;
  taskNo?: string | null;
  customerName?: string | null;
  customerInput: string;
  status: string;
  analysis: StructuredAnalysis | null;
  analysisSource: string | null;
  analysisError: string | null;
  confirmedFields: ConfirmedRequirement | null;
  historicalCases: HistoricalCaseView[];
  sampleAttempts: SampleAttemptView[];
  traceEvents: TraceEventView[];
  selectedCaseId: string | null;
  selectedSampleId: string | null;
  error: string | null;
};
