import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import type { LabValue, StructuredAnalysis } from "./types";

type AnalysisResult = {
  analysis: StructuredAnalysis;
  source: string;
};

function asDisplayString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "未识别";
  return value;
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  return value;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isUnknown(value: string) {
  return !value.trim() || value === "未识别" || value === "未指定";
}

function firstMatch(input: string, values: string[]) {
  return values.find((value) => input.includes(value)) ?? null;
}

function withoutFields(fields: string[], removed: string[]) {
  return fields.filter((field) => !removed.includes(field));
}

function asNullableLab(value: unknown): LabValue | null {
  if (!value || typeof value !== "object") return null;
  const lab = value as Partial<LabValue>;
  const l = Number(lab.l);
  const a = Number(lab.a);
  const b = Number(lab.b);

  if (![l, a, b].every(Number.isFinite)) return null;
  return { l, a, b };
}

function stripJsonFence(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ?? trimmed;
}

export function buildAnalysisMessages(
  customerInput: string,
): ChatCompletionMessageParam[] {
  return [
    {
      role: "system",
      content:
        '你是纺织打样颜色需求分析助手。只输出 JSON，不要输出解释。响应必须是 JSON。必须从客户自然语言中抽取可见信息：出现“黑色、雾霾蓝、米白”等颜色词时，targetColorName 必须填该颜色；出现“棉、针织、卫衣、汗布、罗纹”等面料或品类词时，fabric 必须填对应词；出现“不能发红、别太紫、不要偏黄”等约束时，avoidHueRisk 必须填该风险。只有文本完全没有的信息才写入 missingFields。colorIntent、targetColorName、avoidHueRisk、fabric 必须输出字符串，不能输出 null。JSON 字段示例：{"colorIntent":"低饱和雾霾蓝","targetColorName":"雾霾蓝","avoidHueRisk":"避免偏紫","fabric":"棉针织","baseCloth":null,"illuminant":null,"targetLab":null,"deltaEThreshold":null,"missingFields":["targetLab"],"confidence":0.8,"followUpQuestions":["请补充目标 Lab"]}。',
    },
    {
      role: "user",
      content: `把以下客户颜色需求集合结构化为 JSON：${customerInput}`,
    },
  ];
}

export function parseAnalysisJson(raw: string): StructuredAnalysis {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch {
    throw new Error("AI 输出不是有效 JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI 输出不是对象");
  }

  const value = parsed as Record<string, unknown>;

  return {
    colorIntent: asDisplayString(value.colorIntent),
    targetColorName: asDisplayString(value.targetColorName),
    avoidHueRisk: asDisplayString(value.avoidHueRisk),
    fabric: asDisplayString(value.fabric),
    baseCloth: asNullableString(value.baseCloth),
    illuminant: asNullableString(value.illuminant),
    targetLab: asNullableLab(value.targetLab),
    deltaEThreshold: asNullableNumber(value.deltaEThreshold),
    missingFields: asStringArray(value.missingFields),
    confidence: Math.max(0, Math.min(1, Number(value.confidence ?? 0))),
    followUpQuestions: asStringArray(value.followUpQuestions),
  };
}

export function completeAnalysisFromInput(
  analysis: StructuredAnalysis,
  customerInput: string,
): StructuredAnalysis {
  const color = firstMatch(customerInput, [
    "雾霾蓝",
    "黑色",
    "米白",
    "本白",
    "藏青",
    "灰色",
    "红色",
    "蓝色",
    "绿色",
    "黄色",
    "紫色",
  ]);
  const fabric =
    firstMatch(customerInput, ["棉针织", "棉卫衣", "棉氨汗布", "罗纹"]) ??
    (customerInput.includes("棉") && customerInput.includes("卫衣")
      ? "棉卫衣"
      : null);
  const risk = customerInput.includes("发红")
    ? "避免发红"
    : customerInput.includes("偏紫") || customerInput.includes("太紫")
      ? "避免偏紫"
      : customerInput.includes("偏黄")
        ? "避免偏黄"
        : null;

  const filledFields: string[] = [];
  const next = { ...analysis };

  if (color && isUnknown(next.targetColorName)) {
    next.targetColorName = color;
    filledFields.push("targetColorName");
  }
  if (color && isUnknown(next.colorIntent)) {
    next.colorIntent = color;
    filledFields.push("colorIntent");
  }
  if (fabric && isUnknown(next.fabric)) {
    next.fabric = fabric;
    filledFields.push("fabric");
  }
  if (risk && isUnknown(next.avoidHueRisk)) {
    next.avoidHueRisk = risk;
    filledFields.push("avoidHueRisk");
  }

  return {
    ...next,
    missingFields: withoutFields(next.missingFields, filledFields),
  };
}

export async function analyzeCustomerInput(
  customerInput: string,
): Promise<AnalysisResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  const baseURL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 未配置");
  }

  const client = new OpenAI({ apiKey, baseURL });
  const completion = await client.chat.completions.create({
    model,
    messages: buildAnalysisMessages(customerInput),
    response_format: { type: "json_object" },
    temperature: 0,
    stream: false,
  });

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("AI 未返回内容");
  }

  return {
    analysis: completeAnalysisFromInput(parseAnalysisJson(content), customerInput),
    source: model,
  };
}
