import { describe, expect, it } from "vitest";

import {
  adjustDraftLab,
  buildConfirmationDraft,
  confirmationDraftToRequirement,
  draftTargetLabToValue,
} from "./confirmation";
import type { StructuredAnalysis } from "./types";

const analysis: StructuredAnalysis = {
  colorIntent: "黑色棉卫衣",
  targetColorName: "黑色",
  avoidHueRisk: "避免发红",
  fabric: "棉卫衣",
  baseCloth: null,
  illuminant: "D65",
  targetLab: null,
  deltaEThreshold: null,
  missingFields: ["baseCloth", "targetLab", "deltaEThreshold"],
  confidence: 0.8,
  followUpQuestions: [],
};

describe("buildConfirmationDraft", () => {
  it("does not inject a fixed base cloth when AI did not extract one", () => {
    expect(buildConfirmationDraft({ analysis, confirmedFields: null })).toMatchObject({
      illuminant: "D65",
      baseCloth: "",
      targetLab: { l: "", a: "", b: "" },
      deltaEThreshold: "",
    });
  });

  it("prefers the latest analysis over stale previous draft values", () => {
    expect(
      buildConfirmationDraft(
        { analysis, confirmedFields: null },
        {
          illuminant: "D50",
          baseCloth: "暖底白布",
          targetLab: { l: "62.4", a: "-3.1", b: "-11.8" },
          deltaEThreshold: "1.5",
        },
      ),
    ).toMatchObject({
      illuminant: "D65",
      baseCloth: "",
      targetLab: { l: "", a: "", b: "" },
      deltaEThreshold: "",
    });
  });

  it("keeps an AI suggested target Lab ready for visual confirmation", () => {
    expect(
      buildConfirmationDraft({
        analysis: {
          ...analysis,
          baseCloth: "本白布",
          targetLab: { l: 61.5, a: -2.4, b: -10.8 },
          deltaEThreshold: 1.5,
        },
        confirmedFields: null,
      }),
    ).toMatchObject({
      illuminant: "D65",
      baseCloth: "本白布",
      targetLab: { l: "61.5", a: "-2.4", b: "-10.8" },
      deltaEThreshold: "1.5",
    });
  });

  it("adds lighting, prompt, and reference defaults for old analysis data", () => {
    expect(buildConfirmationDraft({ analysis, confirmedFields: null })).toMatchObject({
      productionMaterial: "棉卫衣",
      dyeType: "活性染料",
      reviewIlluminant: "TL84/F11",
      lighting: {
        cctKelvin: 6500,
        illuminanceLux: 1000,
        viewingAngle: 45,
        textureGloss: 20,
      },
      toleranceMode: "deltaE76",
      confirmationNote: "",
      imagePromptHints: {
        colorDescription: "按客户描述提取目标色，图片仅作辅助参考。",
        imageRisk: "图片白平衡、屏幕显示和局部阴影可能影响判断。",
        materialHint: "以已确认面料和基布为准。",
        followUpSuggestion: "确认看样环境、对照环境和实体标准样。",
      },
      referenceSource: "ai-extracted-fallback",
    });
  });

  it("preserves extended confirmed fields when revisiting Step 3", () => {
    expect(
      buildConfirmationDraft({
        analysis,
        confirmedFields: {
          illuminant: "D65",
          reviewIlluminant: "A 光源",
          baseCloth: "客户原布",
          targetLab: { l: 61.8, a: -3.8, b: -10.6 },
          deltaEThreshold: 1.2,
          productionMaterial: "锦纶",
          dyeType: "酸性染料",
          lighting: {
            cctKelvin: 5000,
            illuminanceLux: 750,
            viewingAngle: 30,
            textureGloss: 12,
          },
          toleranceMode: "cmc",
          confirmationNote: "TL84 不可明显偏紫",
          imagePromptHints: {
            colorDescription: "低饱和蓝灰",
            imageRisk: "客户图有阴影",
            materialHint: "棉针织暖底白布",
            followUpSuggestion: "确认实体标准样",
          },
          referenceSource: "history-case",
        },
      }),
    ).toMatchObject({
      illuminant: "D65",
      reviewIlluminant: "A 光源",
      baseCloth: "客户原布",
      targetLab: { l: "61.8", a: "-3.8", b: "-10.6" },
      deltaEThreshold: "1.2",
      productionMaterial: "锦纶",
      dyeType: "酸性染料",
      lighting: {
        cctKelvin: 5000,
        illuminanceLux: 750,
        viewingAngle: 30,
        textureGloss: 12,
      },
      toleranceMode: "cmc",
      confirmationNote: "TL84 不可明显偏紫",
      imagePromptHints: {
        colorDescription: "低饱和蓝灰",
        imageRisk: "客户图有阴影",
        materialHint: "棉针织暖底白布",
        followUpSuggestion: "确认实体标准样",
      },
      referenceSource: "history-case",
    });
  });
});

describe("adjustDraftLab", () => {
  it("adjusts Lab from visual slider deltas without changing other fields", () => {
    expect(
      adjustDraftLab(
        {
          illuminant: "D65",
          baseCloth: "本白布",
          targetLab: { l: "61.5", a: "-2.4", b: "-10.8" },
          deltaEThreshold: "1.5",
        },
        { l: 2, a: -1.5, b: 3 },
      ),
    ).toEqual({
      illuminant: "D65",
      baseCloth: "本白布",
      targetLab: { l: "63.5", a: "-3.9", b: "-7.8" },
      deltaEThreshold: "1.5",
    });
  });
});

describe("draftTargetLabToValue", () => {
  it("returns a Lab value for a partially unconfirmed but numeric draft", () => {
    expect(
      draftTargetLabToValue({
        illuminant: "",
        baseCloth: "",
        targetLab: { l: "62", a: "-3", b: "-12" },
        deltaEThreshold: "",
      }),
    ).toEqual({ l: 62, a: -3, b: -12 });
  });

  it("returns null until all Lab axes are numeric", () => {
    expect(
      draftTargetLabToValue({
        illuminant: "",
        baseCloth: "",
        targetLab: { l: "62", a: "", b: "-12" },
        deltaEThreshold: "",
      }),
    ).toBeNull();
  });
});

describe("confirmationDraftToRequirement", () => {
  it("requires base cloth, target Lab, and Delta E before confirmation", () => {
    expect(
      confirmationDraftToRequirement({
        illuminant: "D65",
        baseCloth: "",
        targetLab: { l: "", a: "", b: "" },
        deltaEThreshold: "",
      }),
    ).toBeNull();
  });

  it("converts a complete draft into confirmed requirement", () => {
    expect(
      confirmationDraftToRequirement({
        illuminant: "D65",
        reviewIlluminant: "TL84/F11",
        baseCloth: "本白布",
        targetLab: { l: "20", a: "0", b: "-1" },
        deltaEThreshold: "1.2",
        productionMaterial: "涤棉混纺",
        dyeType: "分散染料",
        lighting: {
          cctKelvin: 6500,
          illuminanceLux: 1000,
          viewingAngle: 45,
          textureGloss: 20,
        },
        toleranceMode: "deltaE76",
        confirmationNote: "D65 为准",
        imagePromptHints: {
          colorDescription: "低饱和蓝灰",
          imageRisk: "手机白平衡未知",
          materialHint: "棉针织",
          followUpSuggestion: "确认 TL84 复核",
        },
        referenceSource: "ai-extracted-fallback",
      }),
    ).toEqual({
      illuminant: "D65",
      reviewIlluminant: "TL84/F11",
      baseCloth: "本白布",
      targetLab: { l: 20, a: 0, b: -1 },
      deltaEThreshold: 1.2,
      productionMaterial: "涤棉混纺",
      dyeType: "分散染料",
      lighting: {
        cctKelvin: 6500,
        illuminanceLux: 1000,
        viewingAngle: 45,
        textureGloss: 20,
      },
      toleranceMode: "deltaE76",
      confirmationNote: "D65 为准",
      imagePromptHints: {
        colorDescription: "低饱和蓝灰",
        imageRisk: "手机白平衡未知",
        materialHint: "棉针织",
        followUpSuggestion: "确认 TL84 复核",
      },
      referenceSource: "ai-extracted-fallback",
    });
  });
});
