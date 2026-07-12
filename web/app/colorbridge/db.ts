import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { analyzeCustomerInput } from "./ai";
import {
  CACHED_ANALYSIS,
  DEFAULT_CONFIRMATION,
  DEMO_CUSTOMER_INPUT,
  SEED_HISTORICAL_CASES,
  SEED_SAMPLE_ATTEMPTS,
} from "./demo-data";
import { lightSceneLabel, previewLabForRendering } from "./color-utils";
import { DEFAULT_LIGHTING } from "./confirmation";
import { normalizeCustomerRequirementInput } from "./customer-input";
import type {
  ConfirmedRequirement,
  HistoricalCaseView,
  LabValue,
  SampleAttemptView,
  StructuredAnalysis,
  TraceEventView,
  WorkbenchState,
} from "./types";
import {
  buildHistoricalCaseCandidates,
  buildSampleAttempt,
  MAX_SAMPLE_ATTEMPTS,
} from "./workflow";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function asLab(value: unknown): LabValue {
  const lab = value as LabValue;
  return { l: Number(lab.l), a: Number(lab.a), b: Number(lab.b) };
}

function maybeLab(value: unknown): LabValue | undefined {
  return value ? asLab(value) : undefined;
}

function createTaskNo() {
  const stamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/\D/g, "");
  return `CB-${stamp}`;
}

function inferCustomerName(input: string) {
  const match = input.match(
    /(?:客户|客人|客户名)[:：\s]*([\u4e00-\u9fa5A-Za-z0-9_-]{2,12})/,
  );
  return match?.[1] ?? "默认客户";
}

function asConfirmed(value: unknown): ConfirmedRequirement | null {
  if (!value) return null;
  const fields = value as ConfirmedRequirement;

  return {
    illuminant: fields.illuminant,
    reviewIlluminant: fields.reviewIlluminant,
    productionMaterial: fields.productionMaterial,
    dyeType: fields.dyeType,
    baseCloth: fields.baseCloth,
    targetLab: asLab(fields.targetLab),
    deltaEThreshold: Number(fields.deltaEThreshold),
    lighting: fields.lighting,
    toleranceMode: fields.toleranceMode,
    confirmationNote: fields.confirmationNote,
    imagePromptHints: fields.imagePromptHints,
    referenceSource: fields.referenceSource,
  };
}

async function seedHistoricalCases() {
  await Promise.all(
    SEED_HISTORICAL_CASES.map((item) =>
      prisma.historicalCase.upsert({
        where: { id: item.id },
        update: {
          orderId: null,
          name: item.name,
          sourceType: "seed",
          fabric: item.fabric,
          dyeType: null,
          baseCloth: item.baseCloth,
          lab: item.lab,
          similarityScore: null,
          similarityReason: item.similarityReason,
          riskNote: item.riskNote,
          selected: false,
        },
        create: {
          id: item.id,
          orderId: null,
          name: item.name,
          sourceType: "seed",
          fabric: item.fabric,
          dyeType: null,
          baseCloth: item.baseCloth,
          lab: item.lab,
          similarityScore: null,
          similarityReason: item.similarityReason,
          riskNote: item.riskNote,
          selected: false,
        },
      }),
    ),
  );
}

async function stateFromOrder(orderId: string): Promise<WorkbenchState> {
  const order = await prisma.colorOrder.findUnique({
    where: { id: orderId },
    include: {
      analysis: true,
      sampleAttempts: { orderBy: { version: "asc" } },
      traceEvents: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    return getFallbackState("未找到演示订单，已显示缓存路径。");
  }

  const orderCases = await prisma.historicalCase.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
  const historicalCases = orderCases.length
    ? orderCases
    : await prisma.historicalCase.findMany({
        where: { orderId: null },
        orderBy: { createdAt: "asc" },
      });
  const latestTrace = order.traceEvents.at(-1);
  const confirmedFields = asConfirmed(order.confirmedFields);
  const confirmedRenderLab = confirmedFields
    ? previewLabForRendering(
        confirmedFields.targetLab,
        confirmedFields.illuminant,
        confirmedFields.lighting ?? DEFAULT_LIGHTING,
        confirmedFields.productionMaterial ?? "",
        confirmedFields.baseCloth,
      )
    : null;
  const confirmationSummary = confirmedFields
    ? `${confirmedFields.illuminant}${confirmedFields.reviewIlluminant ? ` / ${confirmedFields.reviewIlluminant}` : ""} / ${confirmedFields.productionMaterial ?? "待确认材质"} / ${confirmedFields.baseCloth}`
    : undefined;

  return {
    orderId: order.id,
    taskNo: order.taskNo,
    customerName: order.customerName,
    customerInput: order.customerInput,
    status: order.status,
    analysis: order.analysis?.extractedJson as StructuredAnalysis | null,
    analysisSource: order.analysis?.source ?? null,
    analysisError:
      order.status === "analysis_failed" ? (latestTrace?.detail ?? null) : null,
    confirmedFields,
    historicalCases: historicalCases.map((item): HistoricalCaseView => ({
      id: item.id,
      name: item.name,
      sourceType: item.sourceType,
      fabric: item.fabric,
      dyeType: item.dyeType,
      baseCloth: item.baseCloth,
      lab: asLab(item.lab),
      similarityScore: item.similarityScore,
      similarityReason: item.similarityReason,
      riskNote: item.riskNote,
      selected: item.selected,
    })),
    sampleAttempts: order.sampleAttempts.map((item): SampleAttemptView => ({
      id: item.id,
      version: item.version,
      schemeName: item.schemeName,
      lab: asLab(item.lab),
      targetLab: maybeLab(item.targetLab) ?? confirmedRenderLab ?? undefined,
      aiLab: maybeLab(item.aiLab) ?? null,
      historicalCaseId: item.historicalCaseId,
      productionMaterial: item.productionMaterial,
      baseCloth: item.baseCloth,
      dyeType: item.dyeType,
      illuminant: item.illuminant,
      illuminantLabel: item.illuminantLabel,
      reviewIlluminant: item.reviewIlluminant,
      reviewIlluminantLabel: item.reviewIlluminantLabel,
      cctKelvin: item.cctKelvin,
      illuminanceLux: item.illuminanceLux,
      viewingAngle: item.viewingAngle,
      textureGloss: item.textureGloss,
      confirmationSummary: item.recommendation || confirmationSummary,
      confirmationSnapshot:
        (item.confirmationSnapshot as ConfirmedRequirement | null) ?? null,
      deltaE: item.deltaE,
      passed: item.passed,
      recommendation: item.recommendation,
      deviation: item.deviation,
      selected: item.selected,
      confirmedAt: item.confirmedAt?.toISOString() ?? null,
    })),
    traceEvents: order.traceEvents.map((item): TraceEventView => ({
      id: item.id,
      eventType: item.eventType,
      actor: item.actor,
      label: item.label,
      detail: item.detail,
      snapshot: item.snapshot,
      createdAt: item.createdAt.toISOString(),
    })),
    selectedCaseId: order.selectedCaseId,
    selectedSampleId: order.selectedSampleId,
    error: null,
  };
}

function getFallbackState(error: string): WorkbenchState {
  return {
    orderId: null,
    taskNo: "CB-FALLBACK",
    customerName: "演示客户",
    customerInput: DEMO_CUSTOMER_INPUT,
    status: "fallback",
    analysis: CACHED_ANALYSIS,
    analysisSource: "cached-demo-json",
    analysisError: null,
    confirmedFields: DEFAULT_CONFIRMATION,
    historicalCases: SEED_HISTORICAL_CASES,
    sampleAttempts: SEED_SAMPLE_ATTEMPTS,
    traceEvents: [
      {
        id: "fallback-trace-1",
        eventType: "fallback",
        actor: "system",
        label: "载入缓存演示",
        detail: "数据库或实时 AI 不可用时使用内置数据继续完整流程。",
        snapshot: null,
        createdAt: new Date().toISOString(),
      },
    ],
    selectedCaseId: SEED_HISTORICAL_CASES[0].id,
    selectedSampleId: SEED_SAMPLE_ATTEMPTS[1].id,
    error,
  };
}

export async function getWorkbenchState(): Promise<WorkbenchState> {
  try {
    const order = await prisma.colorOrder.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (!order) return resetDemoOrder();
    return stateFromOrder(order.id);
  } catch (error) {
    return getFallbackState(
      error instanceof Error ? error.message : "数据库访问失败。",
    );
  }
}

export async function resetDemoOrder(): Promise<WorkbenchState> {
  try {
    await prisma.historicalCase.deleteMany();
    await seedHistoricalCases();
    await prisma.colorOrder.deleteMany();
    const order = await prisma.colorOrder.create({
      data: {
        taskNo: createTaskNo(),
        customerName: inferCustomerName(DEMO_CUSTOMER_INPUT),
        customerInput: DEMO_CUSTOMER_INPUT,
        status: "chat_loaded",
        traceEvents: {
          create: {
            eventType: "demo_loaded",
            label: "使用演示样例",
            detail: "已创建新的 ColorBridge 演示需求集合。",
          },
        },
      },
    });

    return stateFromOrder(order.id);
  } catch (error) {
    return getFallbackState(
      error instanceof Error ? error.message : "重置演示失败。",
    );
  }
}

export async function createCustomerRequirementOrder(
  customerInput: string,
): Promise<WorkbenchState> {
  try {
    await prisma.colorOrder.deleteMany();
    await prisma.historicalCase.deleteMany();
    const normalizedInput = normalizeCustomerRequirementInput(customerInput);
    const order = await prisma.colorOrder.create({
      data: {
        taskNo: createTaskNo(),
        customerName: inferCustomerName(normalizedInput),
        customerInput: normalizedInput,
        status: "requirements_loaded",
        traceEvents: {
          create: {
            eventType: "order_created",
            label: "创建客户需求集合",
            detail: "已基于输入内容创建新的 ColorBridge 需求集合。",
          },
        },
      },
    });

    return stateFromOrder(order.id);
  } catch (error) {
    return getFallbackState(
      error instanceof Error ? error.message : "创建客户需求集合失败。",
    );
  }
}

export async function runAnalysis(orderId: string): Promise<WorkbenchState> {
  const order = await prisma.colorOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    return getFallbackState("未找到演示订单，已显示缓存路径。");
  }

  try {
    const result = await analyzeCustomerInput(order.customerInput);
    await prisma.analysisResult.upsert({
      where: { orderId },
      update: {
        extractedJson: result.analysis,
        missingFields: result.analysis.missingFields,
        confidence: result.analysis.confidence,
        source: result.source,
      },
      create: {
        orderId,
        extractedJson: result.analysis,
        missingFields: result.analysis.missingFields,
        confidence: result.analysis.confidence,
        source: result.source,
      },
    });
    await prisma.colorOrder.update({
      where: { id: orderId },
      data: {
        status: "analysis_ready",
        requestedColor: result.analysis.targetColorName,
        colorIntent: result.analysis.colorIntent,
        productionMaterial: result.analysis.fabric,
        baseCloth: result.analysis.baseCloth,
        targetLab: result.analysis.targetLab ?? undefined,
        traceEvents: {
          create: {
            eventType: "analysis_ready",
            label: "运行 AI 分析",
            detail: `调用 ${result.source} 完成结构化提取。`,
            snapshot: result.analysis,
          },
        },
      },
    });
  } catch (error) {
    const detail = `实时 AI 分析失败，未写入缓存假数据：${
      error instanceof Error ? error.message : "未知错误"
    }`;
    await prisma.colorOrder.update({
      where: { id: orderId },
      data: {
        status: "analysis_failed",
        traceEvents: {
          create: {
            eventType: "analysis_failed",
            label: "AI 分析失败",
            detail,
          },
        },
      },
    });
    const state = await stateFromOrder(orderId);
    return {
      ...state,
      analysis: null,
      analysisSource: null,
      analysisError: detail,
    };
  }

  return stateFromOrder(orderId);
}

export async function confirmRequirement(
  orderId: string,
  fields: ConfirmedRequirement,
): Promise<WorkbenchState> {
  const renderLab = previewLabForRendering(
    fields.targetLab,
    fields.illuminant,
    fields.lighting ?? DEFAULT_LIGHTING,
    fields.productionMaterial ?? "",
    fields.baseCloth,
  );

  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: "requirements_confirmed",
      confirmedFields: fields,
      productionMaterial: fields.productionMaterial ?? null,
      baseCloth: fields.baseCloth,
      dyeType: fields.dyeType ?? null,
      targetLab: fields.targetLab,
      finalRenderLab: renderLab,
      traceEvents: {
        create: {
          eventType: "manual_confirmation",
          label: "人工确认字段",
          detail: `${lightSceneLabel(fields.illuminant)} / ${fields.baseCloth} / Delta E ${fields.deltaEThreshold}`,
          snapshot: {
            confirmedFields: fields,
            renderLab,
          },
        },
      },
    },
  });

  return stateFromOrder(orderId);
}

export async function attachHistoricalCases(
  orderId: string,
): Promise<WorkbenchState> {
  const order = await prisma.colorOrder.findUnique({
    where: { id: orderId },
    include: { analysis: true },
  });
  const confirmed = asConfirmed(order?.confirmedFields);
  const analysis = order?.analysis?.extractedJson as StructuredAnalysis | null;

  if (!order || !confirmed) return stateFromOrder(orderId);
  const referenceLab = previewLabForRendering(
    confirmed.targetLab,
    confirmed.illuminant,
    confirmed.lighting ?? DEFAULT_LIGHTING,
    confirmed.productionMaterial ?? "",
    confirmed.baseCloth,
  );

  const candidates = buildHistoricalCaseCandidates({
    orderId,
    targetColorName: analysis?.targetColorName ?? "目标色",
    colorIntent: analysis?.colorIntent ?? "按人工确认目标色参考",
    fabric: analysis?.fabric ?? confirmed.productionMaterial ?? "待确认材质",
    avoidHueRisk: analysis?.avoidHueRisk ?? "注意色相漂移",
    confirmed,
    referenceLab,
  });

  await prisma.historicalCase.deleteMany();
  await Promise.all(
    candidates.map((item, index) =>
      prisma.historicalCase.create({
        data: {
          id: item.id,
          orderId,
          name: item.name,
          sourceType: "generated",
          fabric: item.fabric,
          dyeType: confirmed.dyeType,
          baseCloth: item.baseCloth,
          lab: item.lab,
          similarityScore: Number((0.92 - index * 0.05).toFixed(2)),
          similarityReason: item.similarityReason,
          riskNote: item.riskNote,
          selected: index === 0,
        },
      }),
    ),
  );
  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: "history_matched",
      selectedCaseId: candidates[0].id,
      traceEvents: {
        create: {
          eventType: "history_cases_generated",
          label: "检索历史案例",
          detail: `基于 ${confirmed.productionMaterial || analysis?.fabric || "当前材质"} / ${confirmed.baseCloth} / ${lightSceneLabel(confirmed.illuminant)} 生成 3 条候选案例。`,
          snapshot: { candidates },
        },
      },
    },
  });

  return stateFromOrder(orderId);
}

export async function selectHistoricalCase(
  orderId: string,
  caseId: string,
): Promise<WorkbenchState> {
  await prisma.historicalCase.updateMany({
    where: { orderId },
    data: { selected: false },
  });
  await prisma.historicalCase.update({
    where: { id: caseId },
    data: { selected: true },
  });
  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      selectedCaseId: caseId,
      traceEvents: {
        create: {
          label: "选择参考案例",
          detail: `已选择 ${caseId} 作为本次调色参考。`,
          eventType: "history_case_selected",
          snapshot: { caseId },
        },
      },
    },
  });

  return stateFromOrder(orderId);
}

export async function attachNextSampleAttempt(
  orderId: string,
): Promise<WorkbenchState> {
  const order = await prisma.colorOrder.findUnique({
    where: { id: orderId },
    include: { analysis: true },
  });
  const confirmed = asConfirmed(order?.confirmedFields);

  if (!confirmed) return stateFromOrder(orderId);

  const existing = await prisma.sampleAttempt.findMany({
    where: { orderId },
    orderBy: { version: "asc" },
  });
  const attemptIndex = existing.length;
  const version = `V${attemptIndex + 1}`;
  const renderLab = previewLabForRendering(
    confirmed.targetLab,
    confirmed.illuminant,
    confirmed.lighting ?? DEFAULT_LIGHTING,
    confirmed.productionMaterial ?? "",
    confirmed.baseCloth,
  );
  const next = buildSampleAttempt({
    id: `${orderId}-sample-${version.toLowerCase()}`,
    version,
    attemptIndex,
    confirmed,
    renderLab,
  });

  if (attemptIndex >= MAX_SAMPLE_ATTEMPTS) {
    return stateFromOrder(orderId);
  }
  const selectedCaseId = order?.selectedCaseId ?? null;
  const aiLab = (order?.analysis?.extractedJson as StructuredAnalysis | null)
    ?.targetLab;
  const lighting = confirmed.lighting ?? DEFAULT_LIGHTING;
  const recommendation = next.confirmationSummary ?? next.deviation;

  await prisma.sampleAttempt.upsert({
    where: { id: next.id },
    update: {
      schemeName: `${version} 方案`,
      targetLab: renderLab,
      lab: next.lab,
      aiLab: aiLab ?? undefined,
      historicalCaseId: selectedCaseId,
      productionMaterial: confirmed.productionMaterial ?? null,
      baseCloth: confirmed.baseCloth,
      dyeType: confirmed.dyeType ?? null,
      illuminant: confirmed.illuminant,
      illuminantLabel: lightSceneLabel(confirmed.illuminant),
      reviewIlluminant: confirmed.reviewIlluminant ?? null,
      reviewIlluminantLabel: confirmed.reviewIlluminant
        ? lightSceneLabel(confirmed.reviewIlluminant)
        : null,
      cctKelvin: lighting.cctKelvin,
      illuminanceLux: lighting.illuminanceLux,
      viewingAngle: lighting.viewingAngle,
      textureGloss: lighting.textureGloss,
      confirmationSnapshot: confirmed,
      deltaE: next.deltaE,
      passed: next.passed,
      recommendation,
      deviation: next.deviation,
      selected: false,
      confirmedAt: null,
    },
    create: {
      id: next.id,
      orderId,
      version: next.version,
      schemeName: `${version} 方案`,
      targetLab: renderLab,
      lab: next.lab,
      aiLab: aiLab ?? undefined,
      historicalCaseId: selectedCaseId,
      productionMaterial: confirmed.productionMaterial ?? null,
      baseCloth: confirmed.baseCloth,
      dyeType: confirmed.dyeType ?? null,
      illuminant: confirmed.illuminant,
      illuminantLabel: lightSceneLabel(confirmed.illuminant),
      reviewIlluminant: confirmed.reviewIlluminant ?? null,
      reviewIlluminantLabel: confirmed.reviewIlluminant
        ? lightSceneLabel(confirmed.reviewIlluminant)
        : null,
      cctKelvin: lighting.cctKelvin,
      illuminanceLux: lighting.illuminanceLux,
      viewingAngle: lighting.viewingAngle,
      textureGloss: lighting.textureGloss,
      confirmationSnapshot: confirmed,
      deltaE: next.deltaE,
      passed: next.passed,
      recommendation,
      deviation: next.deviation,
    },
  });

  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: "scheme_ready",
      traceEvents: {
        create: {
          eventType: "scheme_saved",
          label: "保存方案版本",
          detail: `${next.version} 已保存为可选方案。${next.deviation}`,
          snapshot: {
            scheme: next,
            confirmedFields: confirmed,
            selectedCaseId,
          },
        },
      },
    },
  });

  return stateFromOrder(orderId);
}

export async function adoptSampleAttempt(
  orderId: string,
  sampleId: string,
): Promise<WorkbenchState> {
  const sample = await prisma.sampleAttempt.findUnique({
    where: { id: sampleId },
  });
  const order = await prisma.colorOrder.findUnique({
    where: { id: orderId },
    include: { analysis: true },
  });
  const confirmed = asConfirmed(order?.confirmedFields);

  if (!sample) {
    await prisma.colorOrder.update({
      where: { id: orderId },
      data: {
        status: "scheme_missing",
        traceEvents: {
          create: {
            label: "未找到方案版本",
            detail: "未找到可确认的方案版本，请先生成方案。",
          },
        },
      },
    });

    return stateFromOrder(orderId);
  }

  await prisma.sampleAttempt.updateMany({
    where: { orderId },
    data: { selected: false, confirmedAt: null },
  });
  await prisma.sampleAttempt.update({
    where: { id: sampleId },
    data: { selected: true, confirmedAt: new Date() },
  });

  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: "scheme_selected",
      selectedSampleId: sampleId,
      finalSchemeId: sampleId,
      finalRenderLab: sample.lab ?? undefined,
      finalConfirmedAt: new Date(),
      traceEvents: {
        create: {
          eventType: "final_scheme_selected",
          actor: "operator",
          label: "确认最终方案",
          detail: `${sample.version} 已锁定为客户确认方案。`,
          snapshot: {
            taskNo: order?.taskNo,
            customerName: order?.customerName,
            requestedColor:
              (order?.analysis?.extractedJson as StructuredAnalysis | null)
                ?.targetColorName ?? order?.requestedColor,
            productionMaterial:
              sample.productionMaterial ?? confirmed?.productionMaterial,
            baseCloth: sample.baseCloth ?? confirmed?.baseCloth,
            dyeType: sample.dyeType ?? confirmed?.dyeType,
            scheme: {
              id: sample.id,
              version: sample.version,
              schemeName: sample.schemeName,
              lab: sample.lab,
              targetLab: sample.targetLab,
              illuminantLabel: sample.illuminantLabel,
              reviewIlluminantLabel: sample.reviewIlluminantLabel,
              cctKelvin: sample.cctKelvin,
              illuminanceLux: sample.illuminanceLux,
              viewingAngle: sample.viewingAngle,
              textureGloss: sample.textureGloss,
              recommendation: sample.recommendation,
            },
            confirmedFields: confirmed,
          },
        },
      },
    },
  });

  return stateFromOrder(orderId);
}
