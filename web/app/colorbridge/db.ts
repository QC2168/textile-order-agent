import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../generated/prisma/client";
import { analyzeCustomerInput } from "./ai";
import {
  CACHED_ANALYSIS,
  DEFAULT_CONFIRMATION,
  DEMO_CUSTOMER_INPUT,
  SEED_HISTORICAL_CASES,
  SEED_SAMPLE_ATTEMPTS,
} from "./demo-data";
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

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({
    url: "file:./prisma/dev.db",
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

function asConfirmed(value: unknown): ConfirmedRequirement | null {
  if (!value) return null;
  const fields = value as ConfirmedRequirement;

  return {
    illuminant: fields.illuminant,
    baseCloth: fields.baseCloth,
    targetLab: asLab(fields.targetLab),
    deltaEThreshold: Number(fields.deltaEThreshold),
  };
}

async function seedHistoricalCases() {
  await Promise.all(
    SEED_HISTORICAL_CASES.map((item) =>
      prisma.historicalCase.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          fabric: item.fabric,
          baseCloth: item.baseCloth,
          lab: item.lab,
          similarityReason: item.similarityReason,
          riskNote: item.riskNote,
        },
        create: {
          id: item.id,
          name: item.name,
          fabric: item.fabric,
          baseCloth: item.baseCloth,
          lab: item.lab,
          similarityReason: item.similarityReason,
          riskNote: item.riskNote,
        },
      }),
    ),
  );
}

async function stateFromOrder(orderId: string): Promise<WorkbenchState> {
  await seedHistoricalCases();

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

  const historicalCases = await prisma.historicalCase.findMany({
    orderBy: { createdAt: "asc" },
  });
  const latestTrace = order.traceEvents.at(-1);

  return {
    orderId: order.id,
    customerInput: order.customerInput,
    status: order.status,
    analysis: order.analysis?.extractedJson as StructuredAnalysis | null,
    analysisSource: order.analysis?.source ?? null,
    analysisError:
      order.status === "analysis_failed" ? (latestTrace?.detail ?? null) : null,
    confirmedFields: asConfirmed(order.confirmedFields),
    historicalCases: historicalCases.map((item): HistoricalCaseView => ({
      id: item.id,
      name: item.name,
      fabric: item.fabric,
      baseCloth: item.baseCloth,
      lab: asLab(item.lab),
      similarityReason: item.similarityReason,
      riskNote: item.riskNote,
    })),
    sampleAttempts: order.sampleAttempts.map((item): SampleAttemptView => ({
      id: item.id,
      version: item.version,
      lab: asLab(item.lab),
      deltaE: item.deltaE,
      passed: item.passed,
      deviation: item.deviation,
    })),
    traceEvents: order.traceEvents.map((item): TraceEventView => ({
      id: item.id,
      label: item.label,
      detail: item.detail,
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
        label: "载入缓存演示",
        detail: "数据库或实时 AI 不可用时使用内置数据继续完整流程。",
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
    await seedHistoricalCases();
    await prisma.colorOrder.deleteMany();
    const order = await prisma.colorOrder.create({
      data: {
        customerInput: DEMO_CUSTOMER_INPUT,
        status: "chat_loaded",
        traceEvents: {
          create: {
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
    await seedHistoricalCases();
    await prisma.colorOrder.deleteMany();
    const normalizedInput = normalizeCustomerRequirementInput(customerInput);
    const order = await prisma.colorOrder.create({
      data: {
        customerInput: normalizedInput,
        status: "requirements_loaded",
        traceEvents: {
          create: {
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
        traceEvents: {
          create: {
            label: "运行 AI 分析",
            detail: `调用 ${result.source} 完成结构化提取。`,
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
  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: "requirements_confirmed",
      confirmedFields: fields,
      traceEvents: {
        create: {
          label: "人工确认字段",
          detail: `${fields.illuminant} / ${fields.baseCloth} / Delta E ${fields.deltaEThreshold}`,
        },
      },
    },
  });

  return stateFromOrder(orderId);
}

export async function attachHistoricalCases(
  orderId: string,
): Promise<WorkbenchState> {
  await seedHistoricalCases();
  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: "history_matched",
      selectedCaseId: SEED_HISTORICAL_CASES[0].id,
      traceEvents: {
        create: {
          label: "检索历史案例",
          detail: "命中 3 条确定性种子案例，供调色师审核参考。",
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
  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      selectedCaseId: caseId,
      traceEvents: {
        create: {
          label: "选择参考案例",
          detail: `已选择 ${caseId} 作为本次调色参考。`,
        },
      },
    },
  });

  return stateFromOrder(orderId);
}

export async function attachNextSampleAttempt(
  orderId: string,
): Promise<WorkbenchState> {
  const existing = await prisma.sampleAttempt.findMany({
    where: { orderId },
    orderBy: { version: "asc" },
  });
  const next = SEED_SAMPLE_ATTEMPTS[existing.length];

  if (!next) {
    return stateFromOrder(orderId);
  }

  await prisma.sampleAttempt.upsert({
    where: { id: next.id },
    update: {
      lab: next.lab,
      deltaE: next.deltaE,
      passed: next.passed,
      deviation: next.deviation,
    },
    create: {
      id: next.id,
      orderId,
      version: next.version,
      lab: next.lab,
      deltaE: next.deltaE,
      passed: next.passed,
      deviation: next.deviation,
    },
  });

  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: next.passed ? "sample_ready" : "sample_failed",
      traceEvents: {
        create: {
          label: "对比打样结果",
          detail: `${next.version} Delta E ${next.deltaE.toFixed(1)}，${
            next.passed
              ? "已达标，等待人工采用样版。"
              : "未达标，需要继续打样。"
          }`,
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

  if (!sample?.passed) {
    await prisma.colorOrder.update({
      where: { id: orderId },
      data: {
        status: "sample_failed",
        traceEvents: {
          create: {
            label: "拒绝采用样版",
            detail: "当前样版未达标，不能进入确认与追溯。",
          },
        },
      },
    });

    return stateFromOrder(orderId);
  }

  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: "sample_passed",
      selectedSampleId: sampleId,
      traceEvents: {
        create: {
          label: "采用达标样版",
          detail: `${sample.version} 已锁定为客户确认样版。`,
        },
      },
    },
  });

  return stateFromOrder(orderId);
}
