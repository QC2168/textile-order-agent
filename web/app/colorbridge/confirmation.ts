import type {
  ConfirmedRequirement,
  ImagePromptHints,
  LabValue,
  LightingCondition,
  ReferenceSource,
  StructuredAnalysis,
} from "./types";
import { dyePlanForMaterial } from "./color-utils";

export type ConfirmationDraft = {
  illuminant: string;
  reviewIlluminant: string;
  productionMaterial: string;
  dyeType: string;
  baseCloth: string;
  targetLab: {
    l: string;
    a: string;
    b: string;
  };
  deltaEThreshold: string;
  lighting: LightingCondition;
  toleranceMode: "deltaE76" | "cmc";
  confirmationNote: string;
  imagePromptHints: ImagePromptHints;
  referenceSource: ReferenceSource;
};

type ConfirmationSource = {
  analysis: StructuredAnalysis | null;
  confirmedFields: ConfirmedRequirement | null;
};

export const DEFAULT_LIGHTING: LightingCondition = {
  cctKelvin: 6500,
  illuminanceLux: 1000,
  viewingAngle: 45,
  textureGloss: 20,
};

export const REAL_WORLD_REFERENCE_LIGHTING: LightingCondition = {
  cctKelvin: 6500,
  illuminanceLux: 1000,
  viewingAngle: 45,
  textureGloss: 20,
};

export const DEFAULT_IMAGE_PROMPT_HINTS: ImagePromptHints = {
  colorDescription: "按客户描述提取目标色，图片仅作辅助参考。",
  imageRisk: "图片白平衡、屏幕显示和局部阴影可能影响判断。",
  materialHint: "以已确认面料和基布为准。",
  followUpSuggestion: "确认看样环境、对照环境和实体标准样。",
};

const EMPTY_DRAFT: ConfirmationDraft = {
  illuminant: "",
  reviewIlluminant: "TL84/F11",
  productionMaterial: "",
  dyeType: "待确认染料",
  baseCloth: "",
  targetLab: { l: "", a: "", b: "" },
  deltaEThreshold: "",
  lighting: DEFAULT_LIGHTING,
  toleranceMode: "deltaE76",
  confirmationNote: "",
  imagePromptHints: DEFAULT_IMAGE_PROMPT_HINTS,
  referenceSource: "ai-extracted-fallback",
};

function labToDraft(lab: LabValue | null) {
  if (!lab) return { l: "", a: "", b: "" };
  return {
    l: String(lab.l),
    a: String(lab.a),
    b: String(lab.b),
  };
}

export function buildConfirmationDraft(
  source: ConfirmationSource,
  fallback: ConfirmationDraft = EMPTY_DRAFT,
): ConfirmationDraft {
  if (source.confirmedFields) {
    return {
      illuminant: source.confirmedFields.illuminant,
      reviewIlluminant:
        source.confirmedFields.reviewIlluminant ?? fallback.reviewIlluminant,
      productionMaterial:
        source.confirmedFields.productionMaterial ??
        fallback.productionMaterial,
      dyeType: source.confirmedFields.dyeType ?? fallback.dyeType,
      baseCloth: source.confirmedFields.baseCloth,
      targetLab: labToDraft(source.confirmedFields.targetLab),
      deltaEThreshold: String(source.confirmedFields.deltaEThreshold),
      lighting: source.confirmedFields.lighting ?? fallback.lighting,
      toleranceMode:
        source.confirmedFields.toleranceMode ?? fallback.toleranceMode,
      confirmationNote:
        source.confirmedFields.confirmationNote ?? fallback.confirmationNote,
      imagePromptHints:
        source.confirmedFields.imagePromptHints ?? fallback.imagePromptHints,
      referenceSource:
        source.confirmedFields.referenceSource ?? fallback.referenceSource,
    };
  }

  if (source.analysis) {
    const dyePlan = dyePlanForMaterial(source.analysis.fabric);

    return {
      illuminant: source.analysis.illuminant ?? "",
      reviewIlluminant: fallback.reviewIlluminant,
      productionMaterial: source.analysis.fabric,
      dyeType: dyePlan.dyeType,
      baseCloth: source.analysis.baseCloth ?? "",
      targetLab: labToDraft(source.analysis.targetLab),
      deltaEThreshold:
        source.analysis.deltaEThreshold === null
          ? ""
          : String(source.analysis.deltaEThreshold),
      lighting: fallback.lighting,
      toleranceMode: fallback.toleranceMode,
      confirmationNote: fallback.confirmationNote,
      imagePromptHints: fallback.imagePromptHints,
      referenceSource: fallback.referenceSource,
    };
  }

  return fallback;
}

function parseNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function confirmationDraftToRequirement(
  draft: ConfirmationDraft,
): ConfirmedRequirement | null {
  const l = parseNumber(draft.targetLab.l);
  const a = parseNumber(draft.targetLab.a);
  const b = parseNumber(draft.targetLab.b);
  const deltaEThreshold = parseNumber(draft.deltaEThreshold);

  if (
    !draft.illuminant.trim() ||
    !draft.baseCloth.trim() ||
    l === null ||
    a === null ||
    b === null ||
    deltaEThreshold === null
  ) {
    return null;
  }

  return {
    illuminant: draft.illuminant.trim(),
    reviewIlluminant: draft.reviewIlluminant.trim(),
    productionMaterial: draft.productionMaterial.trim(),
    dyeType: draft.dyeType.trim(),
    baseCloth: draft.baseCloth.trim(),
    targetLab: { l, a, b },
    deltaEThreshold,
    lighting: draft.lighting,
    toleranceMode: draft.toleranceMode,
    confirmationNote: draft.confirmationNote.trim(),
    imagePromptHints: {
      colorDescription: draft.imagePromptHints.colorDescription.trim(),
      imageRisk: draft.imagePromptHints.imageRisk.trim(),
      materialHint: draft.imagePromptHints.materialHint.trim(),
      followUpSuggestion: draft.imagePromptHints.followUpSuggestion.trim(),
    },
    referenceSource: draft.referenceSource,
  };
}

export function draftTargetLabToValue(
  draft: ConfirmationDraft,
): LabValue | null {
  const l = parseNumber(draft.targetLab.l);
  const a = parseNumber(draft.targetLab.a);
  const b = parseNumber(draft.targetLab.b);

  if (l === null || a === null || b === null) return null;
  return { l, a, b };
}

function formatDraftNumber(value: number) {
  return String(Number(value.toFixed(1)));
}

export function adjustDraftLab(
  draft: ConfirmationDraft,
  delta: LabValue,
): ConfirmationDraft {
  const l = parseNumber(draft.targetLab.l) ?? 0;
  const a = parseNumber(draft.targetLab.a) ?? 0;
  const b = parseNumber(draft.targetLab.b) ?? 0;

  return {
    ...draft,
    targetLab: {
      l: formatDraftNumber(l + delta.l),
      a: formatDraftNumber(a + delta.a),
      b: formatDraftNumber(b + delta.b),
    },
  };
}
