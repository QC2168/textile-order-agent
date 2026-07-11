import { describe, expect, it } from "vitest";

import {
  buildHistoricalCaseCandidates,
  buildSampleAttempt,
  historyReferenceLab,
} from "./workflow";
import type { ConfirmedRequirement } from "./types";

const confirmed: ConfirmedRequirement = {
  illuminant: "D65",
  reviewIlluminant: "TL84/F11",
  productionMaterial: "纯棉",
  dyeType: "活性染料",
  baseCloth: "本白布",
  targetLab: { l: 70, a: 3, b: 18 },
  deltaEThreshold: 1.5,
  lighting: {
    cctKelvin: 6500,
    illuminanceLux: 1000,
    viewingAngle: 45,
    textureGloss: 20,
  },
  toleranceMode: "deltaE76",
};

describe("historyReferenceLab", () => {
  it("falls back to AI initial Lab when no history case is selected", () => {
    expect(
      historyReferenceLab(
        { l: 70, a: 3, b: 18 },
        null,
        { l: 69.8, a: 3.1, b: 18.1 },
      ),
    ).toEqual({ l: 70, a: 3, b: 18 });
  });

  it("uses the selected history case Lab once a case is selected", () => {
    expect(
      historyReferenceLab(
        { l: 70, a: 3, b: 18 },
        {
          id: "case-1",
          name: "卡其稳定版",
          fabric: "纯棉",
          baseCloth: "本白布",
          lab: { l: 68, a: 3.5, b: 17 },
          similarityReason: "同材质同色相",
          riskNote: "注意黄底",
        },
        { l: 69.8, a: 3.1, b: 18.1 },
      ),
    ).toEqual({ l: 68, a: 3.5, b: 17 });
  });
});

describe("buildHistoricalCaseCandidates", () => {
  it("generates demand-driven history cases around the current target Lab", () => {
    const cases = buildHistoricalCaseCandidates({
      orderId: "order-1",
      targetColorName: "卡其色",
      colorIntent: "卡其色参考样品",
      fabric: "纯棉",
      avoidHueRisk: "避免偏绿",
      confirmed,
      referenceLab: { l: 69.8, a: 3.1, b: 18.1 },
    });

    expect(cases).toHaveLength(3);
    expect(cases[0]).toMatchObject({
      id: "order-1-history-01",
      name: "卡其色纯棉稳定版",
      fabric: "纯棉",
      baseCloth: "本白布",
      lab: { l: 69.2, a: 3.3, b: 18.5 },
    });
    expect(cases[0].similarityReason).toContain("卡其色参考样品");
    expect(cases[1].riskNote).toContain("避免偏绿");
  });
});

describe("buildSampleAttempt", () => {
  it("builds V1 as a selectable scheme from the confirmed render target", () => {
    const sample = buildSampleAttempt({
      id: "sample-v1",
      version: "V1",
      attemptIndex: 0,
      confirmed,
      renderLab: { l: 69.8, a: 3.1, b: 18.1 },
    });

    expect(sample).toMatchObject({
      id: "sample-v1",
      version: "V1",
      lab: { l: 69.8, a: 3.1, b: 18.1 },
      targetLab: { l: 69.8, a: 3.1, b: 18.1 },
      deltaE: 0,
      passed: true,
    });
    expect(sample.deviation).toContain("V1 方案成品预览");
  });

  it("names later schemes and keeps them selectable", () => {
    const sample = buildSampleAttempt({
      id: "sample-v2",
      version: "V2",
      attemptIndex: 1,
      confirmed,
      renderLab: { l: 69.8, a: 3.1, b: 18.1 },
    });

    expect(sample).toMatchObject({
      id: "sample-v2",
      version: "V2",
      lab: { l: 69.8, a: 3.1, b: 18.1 },
      deltaE: 0,
      passed: true,
    });
    expect(sample.deviation).toContain("推荐参数");
  });
});
