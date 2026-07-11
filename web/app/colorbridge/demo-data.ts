import type {
  ConfirmedRequirement,
  HistoricalCaseView,
  SampleAttemptView,
  StructuredAnalysis,
} from "./types";

export const DEMO_CUSTOMER_INPUT =
  "高级一点的雾霾蓝，别太紫，像上次那块，做在棉针织上。";

export const CACHED_ANALYSIS: StructuredAnalysis = {
  colorIntent: "高级感、低饱和雾霾蓝",
  targetColorName: "低饱和雾霾蓝",
  avoidHueRisk: "避免偏紫，控制红相和蓝紫相漂移",
  fabric: "棉针织",
  baseCloth: null,
  illuminant: null,
  targetLab: null,
  deltaEThreshold: null,
  missingFields: ["光源", "基布", "目标 Lab", "Delta E 阈值"],
  confidence: 0.86,
  followUpQuestions: [
    "本次确认使用 D65 光源吗？",
    "基布是否沿用暖底白布？",
    "Delta E 阈值按 1.0 还是 1.5 验收？",
  ],
};

export const DEFAULT_CONFIRMATION: ConfirmedRequirement = {
  illuminant: "D65",
  baseCloth: "暖底白布",
  targetLab: { l: 62.4, a: -3.1, b: -11.8 },
  deltaEThreshold: 1.5,
};

export const SEED_HISTORICAL_CASES: HistoricalCaseView[] = [
  {
    id: "case-fog-blue-knit-01",
    name: "雾蓝针织稳定版",
    fabric: "棉针织",
    baseCloth: "暖底白布",
    lab: { l: 61.9, a: -2.8, b: -12.4 },
    similarityReason:
      "同为棉针织，低饱和蓝灰方向接近，历史返修少。",
    riskNote: "二浴后略偏灰，需要盯紧红相。",
  },
  {
    id: "case-muted-blue-jersey-02",
    name: "低饱和蓝灰客供样",
    fabric: "棉氨汗布",
    baseCloth: "暖底白布",
    lab: { l: 63.1, a: -3.6, b: -10.9 },
    similarityReason:
      "客户描述包含高级感和不偏紫，语义风险相近。",
    riskNote: "氨纶比例变化会放大黄底影响。",
  },
  {
    id: "case-smoky-blue-rib-03",
    name: "烟蓝罗纹修正版",
    fabric: "棉罗纹",
    baseCloth: "本白布",
    lab: { l: 60.8, a: -2.2, b: -13.1 },
    similarityReason: "目标色名和 Lab 蓝灰区间相近，可给调色师对照。",
    riskNote: "本白布比暖底白布更易显冷，不能直接套用。",
  },
];

export const SEED_SAMPLE_ATTEMPTS: SampleAttemptView[] = [
  {
    id: "sample-v1",
    version: "V1",
    lab: { l: 60.7, a: -1.5, b: -14.2 },
    deltaE: 2.1,
    passed: false,
    deviation:
      "亮度偏低，蓝相偏重，视觉上更冷并接近偏紫风险。",
  },
  {
    id: "sample-v2",
    version: "V2",
    lab: { l: 62.1, a: -2.9, b: -12.0 },
    deltaE: 0.6,
    passed: true,
    deviation: "亮度和蓝灰方向已收敛，满足当前 Delta E 阈值。",
  },
];
