import { describe, expect, it } from "vitest";
import {
  deltaE76,
  labToCssColor,
  lightingRiskLabel,
  previewLabForRendering,
  previewLabForIlluminant,
  dyePlanForMaterial,
} from "./color-utils";

describe("deltaE76", () => {
  it("calculates CIE76 distance and rounds to one decimal place", () => {
    expect(deltaE76({ l: 50, a: 0, b: 0 }, { l: 47, a: 4, b: 0 })).toBe(5);
    expect(
      deltaE76(
        { l: 62.4, a: -3.1, b: -11.8 },
        { l: 62.1, a: -2.9, b: -12 },
      ),
    ).toBe(0.4);
  });
});

describe("labToCssColor", () => {
  it("converts a Lab value to an sRGB hex swatch", () => {
    expect(labToCssColor({ l: 62, a: -3, b: -12 })).toBe("#8798ab");
  });

  it("clamps display output through the color conversion library", () => {
    expect(labToCssColor({ l: 100, a: 0, b: 0 })).toBe("#ffffff");
    expect(labToCssColor({ l: 0, a: 0, b: 0 })).toBe("#000000");
  });
});

describe("previewLabForIlluminant", () => {
  it("keeps D65 as the neutral preview baseline", () => {
    expect(previewLabForIlluminant({ l: 62, a: -3, b: -12 }, "D65")).toEqual({
      l: 62,
      a: -3,
      b: -12,
    });
  });

  it("warms A light previews without mutating the original Lab", () => {
    const lab = { l: 62, a: -3, b: -12 };

    expect(previewLabForIlluminant(lab, "A 光源")).toEqual({
      l: 60.8,
      a: -1.8,
      b: -7.8,
    });
    expect(lab).toEqual({ l: 62, a: -3, b: -12 });
  });

  it("applies lighting parameters to the preview Lab", () => {
    expect(
      previewLabForIlluminant({ l: 62, a: -3, b: -12 }, "D65", {
        cctKelvin: 7500,
        illuminanceLux: 2000,
        viewingAngle: 75,
        textureGloss: 50,
      }),
    ).toEqual({ l: 63.7, a: -2.9, b: -12.7 });
  });
});

describe("previewLabForRendering", () => {
  const lighting = {
    cctKelvin: 6500,
    illuminanceLux: 1000,
    viewingAngle: 45,
    textureGloss: 20,
  };

  it("uses the same deterministic rendering model for material and base cloth", () => {
    expect(
      previewLabForRendering(
        { l: 65, a: 5, b: 15 },
        "D65",
        lighting,
        "锦纶",
        "本白布",
      ),
    ).toEqual({ l: 65.6, a: 5.3, b: 14.8 });
  });

  it("changes predictably when production material changes", () => {
    const lab = { l: 65, a: 5, b: 15 };
    const cotton = previewLabForRendering(
      lab,
      "D65",
      lighting,
      "纯棉",
      "本白布",
    );
    const polyesterCotton = previewLabForRendering(
      lab,
      "D65",
      lighting,
      "涤棉混纺",
      "本白布",
    );

    expect(cotton).toEqual({ l: 64.8, a: 5.1, b: 15.1 });
    expect(polyesterCotton).toEqual({ l: 65.3, a: 5, b: 15.7 });
  });

  it("changes predictably when base cloth changes", () => {
    const lab = { l: 65, a: 5, b: 15 };

    expect(
      previewLabForRendering(lab, "D65", lighting, "纯棉", "漂白布"),
    ).toEqual({ l: 66.3, a: 4.9, b: 14.4 });
    expect(
      previewLabForRendering(lab, "D65", lighting, "纯棉", "客户原布"),
    ).toEqual({ l: 64.1, a: 5.3, b: 15.8 });
  });
});

describe("lightingRiskLabel", () => {
  it("highlights review-light metamerism risk", () => {
    expect(lightingRiskLabel("D65", "TL84/F11")).toBe(
      "当前看样环境为日照看样，对照环境为商场/办公室光；注意商场光下蓝灰色可能偏紫或偏灰。",
    );
  });

  it("uses a stable baseline note when there is no review illuminant", () => {
    expect(lightingRiskLabel("D65", "")).toBe(
      "当前只按日照看样预览；建议补充对照环境降低同色异谱风险。",
    );
  });
});

describe("dyePlanForMaterial", () => {
  it("maps cellulosic fabrics to reactive dyes", () => {
    expect(dyePlanForMaterial("纯棉针织")).toEqual({
      materialFamily: "纯棉 / 人棉 / 莫代尔",
      dyeType: "活性染料",
    });
    expect(dyePlanForMaterial("人棉汗布").dyeType).toBe("活性染料");
    expect(dyePlanForMaterial("莫代尔罗纹").dyeType).toBe("活性染料");
  });

  it("maps synthetic and protein fibers to the configured dye types", () => {
    expect(dyePlanForMaterial("锦纶").dyeType).toBe("酸性染料");
    expect(dyePlanForMaterial("涤棉混纺").dyeType).toBe("分散染料");
    expect(dyePlanForMaterial("羊毛").dyeType).toBe("酸性染料");
    expect(dyePlanForMaterial("晴纶").dyeType).toBe("阳离子染料");
    expect(dyePlanForMaterial("腈纶").dyeType).toBe("阳离子染料");
  });

  it("marks unknown materials for manual confirmation", () => {
    expect(dyePlanForMaterial("客户原布")).toEqual({
      materialFamily: "待确认材质",
      dyeType: "待确认染料",
    });
  });
});
