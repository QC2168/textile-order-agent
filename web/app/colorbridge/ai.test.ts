import { describe, expect, it } from "vitest";

import {
  buildAnalysisMessages,
  completeAnalysisFromInput,
  parseAnalysisJson,
} from "./ai";

const completeAnalysis = {
  colorIntent: "高级感、低饱和雾霾蓝",
  targetColorName: "低饱和雾霾蓝",
  avoidHueRisk: "避免偏紫",
  fabric: "棉针织",
  baseCloth: null,
  illuminant: null,
  targetLab: null,
  deltaEThreshold: null,
  missingFields: ["光源"],
  confidence: 0.86,
  followUpQuestions: ["本次确认使用 D65 光源吗？"],
};

describe("parseAnalysisJson", () => {
  it("parses structured analysis JSON returned by an OpenAI-compatible model", () => {
    expect(parseAnalysisJson(JSON.stringify(completeAnalysis))).toEqual(
      completeAnalysis,
    );
  });

  it("parses JSON wrapped in a markdown code fence", () => {
    expect(
      parseAnalysisJson(`\`\`\`json\n${JSON.stringify(completeAnalysis)}\n\`\`\``),
    ).toEqual(completeAnalysis);
  });

  it("rejects malformed model output", () => {
    expect(() => parseAnalysisJson("not json")).toThrow("AI 输出不是有效 JSON");
  });

  it("keeps valid model JSON even when required display fields are null", () => {
    expect(
      parseAnalysisJson(
        JSON.stringify({
          ...completeAnalysis,
          colorIntent: null,
          targetColorName: null,
          avoidHueRisk: null,
          fabric: null,
          missingFields: ["colorIntent"],
        }),
      ),
    ).toMatchObject({
      colorIntent: "未识别",
      targetColorName: "未识别",
      avoidHueRisk: "未识别",
      fabric: "未识别",
      missingFields: ["colorIntent"],
    });
  });
});

describe("buildAnalysisMessages", () => {
  it("includes the real customer input and a JSON shape example", () => {
    const messages = buildAnalysisMessages("客户要黑色棉卫衣，不能发红");

    expect(messages[0].content).toContain("JSON");
    expect(messages[0].content).toContain("colorIntent");
    expect(messages[0].content).toContain("targetLab");
    expect(messages[1].content).toContain("客户要黑色棉卫衣，不能发红");
  });
});

describe("completeAnalysisFromInput", () => {
  it("fills obvious color, fabric, and risk from the real customer input", () => {
    expect(
      completeAnalysisFromInput(
        {
          ...completeAnalysis,
          colorIntent: "未识别",
          targetColorName: "未识别",
          avoidHueRisk: "未识别",
          fabric: "未识别",
          missingFields: ["targetColorName", "fabric", "avoidHueRisk"],
        },
        "客户要黑色棉卫衣，不能发红，D65 下验收。",
      ),
    ).toMatchObject({
      colorIntent: "黑色",
      targetColorName: "黑色",
      avoidHueRisk: "避免发红",
      fabric: "棉卫衣",
      missingFields: [],
    });
  });
});
