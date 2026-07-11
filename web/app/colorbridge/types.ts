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
  baseCloth: string;
  targetLab: LabValue;
  deltaEThreshold: number;
};

export type HistoricalCaseView = {
  id: string;
  name: string;
  fabric: string;
  baseCloth: string;
  lab: LabValue;
  similarityReason: string;
  riskNote: string;
};

export type SampleAttemptView = {
  id: string;
  version: string;
  lab: LabValue;
  deltaE: number;
  passed: boolean;
  deviation: string;
};

export type TraceEventView = {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
};

export type WorkbenchState = {
  orderId: string | null;
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
