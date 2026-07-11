import { formatHex } from "culori";

import type { LabValue, LightingCondition } from "./types";

export function deltaE76(target: LabValue, sample: LabValue) {
  const l = target.l - sample.l;
  const a = target.a - sample.a;
  const b = target.b - sample.b;

  return Number(Math.sqrt(l * l + a * a + b * b).toFixed(1));
}

export function labToCssColor(lab: LabValue) {
  return formatHex({ mode: "lab", l: lab.l, a: lab.a, b: lab.b });
}

export function lightSceneLabel(illuminant: string) {
  if (illuminant.includes("D50")) return "柔和看样灯";
  if (illuminant.includes("TL84") || illuminant.includes("F11")) {
    return "商场/办公室光";
  }
  if (illuminant.includes("A")) return "室内暖光";
  if (illuminant.includes("LED-B3")) return "LED门店光";
  if (illuminant.includes("ID65")) return "冷白日光";
  if (illuminant.includes("D65")) return "日照看样";
  return illuminant.trim() || "日照看样";
}

function roundLab(value: number) {
  return Number(value.toFixed(1));
}

export function previewLabForIlluminant(
  lab: LabValue,
  illuminant: string,
  lighting?: LightingCondition,
): LabValue {
  let preview = { ...lab };

  if (illuminant.includes("A")) {
    preview = {
      l: roundLab(lab.l - 1.2),
      a: roundLab(lab.a + 1.2),
      b: roundLab(lab.b + 4.2),
    };
  } else if (illuminant.includes("TL84") || illuminant.includes("F11")) {
    preview = {
      l: roundLab(lab.l - 0.4),
      a: roundLab(lab.a + 0.8),
      b: roundLab(lab.b + 1.1),
    };
  } else if (illuminant.includes("D50")) {
    preview = {
      l: roundLab(lab.l + 0.5),
      a: roundLab(lab.a + 0.2),
      b: roundLab(lab.b + 1.4),
    };
  }

  if (!lighting) return preview;

  const luxShift = (lighting.illuminanceLux - 1000) / 1000;
  const cctShift = (lighting.cctKelvin - 6500) / 1000;
  const angleShift = Math.abs((lighting.viewingAngle - 45) / 45);
  const glossShift = lighting.textureGloss / 100;

  return {
    l: roundLab(preview.l + luxShift * 2 - angleShift + glossShift * 0.8),
    a: roundLab(preview.a + glossShift * 0.2),
    b: roundLab(preview.b - cctShift * 0.8 + glossShift * 0.3),
  };
}

type LabOffset = {
  l: number;
  a: number;
  b: number;
};

const materialOffsets: Record<string, LabOffset> = {
  cellulosic: { l: -0.2, a: 0, b: -0.1 },
  nylon: { l: 0.6, a: 0.2, b: -0.4 },
  polyesterCotton: { l: 0.3, a: -0.1, b: 0.5 },
  wool: { l: -0.4, a: 0.2, b: -0.2 },
  acrylic: { l: 0.1, a: 0.3, b: 0.2 },
  unknown: { l: 0, a: 0, b: 0 },
};

const baseClothOffsets: Record<string, LabOffset> = {
  本白布: { l: -0.2, a: 0.1, b: 0.1 },
  漂白布: { l: 1.3, a: -0.1, b: -0.6 },
  本白汗布: { l: -0.4, a: 0.1, b: 0.2 },
  本白罗纹: { l: -0.6, a: 0.1, b: 0.3 },
  "客户原布": { l: -0.9, a: 0.3, b: 0.8 },
};

function materialOffset(material: string) {
  if (/涤棉|涤.*棉|棉.*涤/.test(material)) {
    return materialOffsets.polyesterCotton;
  }
  if (/(纯棉|人棉|莫代尔|棉)/.test(material)) {
    return materialOffsets.cellulosic;
  }
  if (/锦纶/.test(material)) return materialOffsets.nylon;
  if (/羊毛/.test(material)) return materialOffsets.wool;
  if (/(晴纶|腈纶)/.test(material)) return materialOffsets.acrylic;
  return materialOffsets.unknown;
}

function addOffset(lab: LabValue, offset: LabOffset) {
  return {
    l: roundLab(lab.l + offset.l),
    a: roundLab(lab.a + offset.a),
    b: roundLab(lab.b + offset.b),
  };
}

export function previewLabForRendering(
  lab: LabValue,
  illuminant: string,
  lighting: LightingCondition,
  material: string,
  baseCloth: string,
): LabValue {
  return addOffset(
    addOffset(
      previewLabForIlluminant(lab, illuminant, lighting),
      materialOffset(material),
    ),
    baseClothOffsets[baseCloth] ?? materialOffsets.unknown,
  );
}

export function lightingRiskLabel(
  illuminant: string,
  reviewIlluminant: string,
) {
  const main = lightSceneLabel(illuminant.trim() || "D65");
  const review = reviewIlluminant.trim();

  if (!review) {
    return `当前只按${main}预览；建议补充对照环境降低同色异谱风险。`;
  }

  return `当前看样环境为${main}，对照环境为${lightSceneLabel(review)}；注意商场光下蓝灰色可能偏紫或偏灰。`;
}

export function dyePlanForMaterial(material: string) {
  if (/涤棉|涤.*棉|棉.*涤/.test(material)) {
    return {
      materialFamily: "涤棉混纺类",
      dyeType: "分散染料",
    };
  }

  if (/(纯棉|人棉|莫代尔|棉)/.test(material)) {
    return {
      materialFamily: "纯棉 / 人棉 / 莫代尔",
      dyeType: "活性染料",
    };
  }

  if (/锦纶/.test(material)) {
    return {
      materialFamily: "锦纶类",
      dyeType: "酸性染料",
    };
  }

  if (/羊毛/.test(material)) {
    return {
      materialFamily: "羊毛类",
      dyeType: "酸性染料",
    };
  }

  if (/(晴纶|腈纶)/.test(material)) {
    return {
      materialFamily: "腈纶 / 晴纶类",
      dyeType: "阳离子染料",
    };
  }

  return {
    materialFamily: "待确认材质",
    dyeType: "待确认染料",
  };
}
