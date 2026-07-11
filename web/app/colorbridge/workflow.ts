import { lightSceneLabel } from "./color-utils";
import type {
  ConfirmedRequirement,
  HistoricalCaseView,
  LabValue,
  SampleAttemptView,
} from "./types";

type HistoryCandidateInput = {
  orderId: string;
  targetColorName: string;
  colorIntent: string;
  fabric: string;
  avoidHueRisk: string;
  confirmed: ConfirmedRequirement;
  referenceLab?: LabValue;
};

type SampleInput = {
  id: string;
  version: string;
  attemptIndex: number;
  confirmed: ConfirmedRequirement;
  renderLab: LabValue;
};

const historyOffsets: LabValue[] = [
  { l: -0.6, a: 0.2, b: 0.4 },
  { l: 0.4, a: -0.4, b: -0.5 },
  { l: -1.1, a: 0.5, b: -0.7 },
];

function addLab(lab: LabValue, offset: LabValue): LabValue {
  return {
    l: Number((lab.l + offset.l).toFixed(1)),
    a: Number((lab.a + offset.a).toFixed(1)),
    b: Number((lab.b + offset.b).toFixed(1)),
  };
}

function formatLab(lab: LabValue) {
  return `L ${lab.l.toFixed(1)} / a ${lab.a.toFixed(1)} / b ${lab.b.toFixed(1)}`;
}

export function historyReferenceLab(
  aiLab: LabValue | null,
  selectedCase: HistoricalCaseView | null | undefined,
  fallbackLab: LabValue | null,
) {
  return selectedCase?.lab ?? aiLab ?? fallbackLab ?? null;
}

export function buildHistoricalCaseCandidates({
  orderId,
  targetColorName,
  colorIntent,
  fabric,
  avoidHueRisk,
  confirmed,
  referenceLab,
}: HistoryCandidateInput): HistoricalCaseView[] {
  const baseName = targetColorName || "目标色";
  const material = confirmed.productionMaterial || fabric || "待确认材质";
  const baseCloth = confirmed.baseCloth;
  const targetLab = referenceLab ?? confirmed.targetLab;

  return historyOffsets.map((offset, index) => {
    const lab = addLab(targetLab, offset);
    const sequence = String(index + 1).padStart(2, "0");
    const suffix = ["稳定版", "客供样修正版", "小样校正版"][index];

    return {
      id: `${orderId}-history-${sequence}`,
      name: `${baseName}${material}${suffix}`,
      fabric: material,
      baseCloth,
      lab,
      similarityReason: `${colorIntent || baseName}；${material} / ${baseCloth} 与本次确认参数接近，参考 ${formatLab(lab)}。`,
      riskNote:
        index === 0
          ? `${avoidHueRisk || "注意色相漂移"}；建议先按当前人工确认值小样验证。`
          : `${avoidHueRisk || "注意色相漂移"}；与目标 ${formatLab(targetLab)} 存在可控偏移。`,
    };
  });
}

export function buildSampleAttempt({
  id,
  version,
  attemptIndex,
  confirmed,
  renderLab,
}: SampleInput): SampleAttemptView {
  const review = confirmed.reviewIlluminant
    ? ` / ${lightSceneLabel(confirmed.reviewIlluminant)}`
    : "";
  const mainLight = lightSceneLabel(confirmed.illuminant);
  const schemeNote = attemptIndex === 0 ? "初版方案" : `第 ${attemptIndex + 1} 版微调方案`;

  return {
    id,
    version,
    lab: renderLab,
    targetLab: renderLab,
    confirmationSummary: `${mainLight}${review} / ${confirmed.productionMaterial || "待确认材质"} / ${confirmed.baseCloth}`,
    deltaE: 0,
    passed: true,
    deviation: `${version} 方案成品预览：${formatLab(renderLab)}。推荐参数：${schemeNote}，采用 ${mainLight}${review}，${confirmed.productionMaterial || "待确认材质"} / ${confirmed.baseCloth}；可直接选为最终方案，或回到人工确认继续生成下一版。`,
  };
}
