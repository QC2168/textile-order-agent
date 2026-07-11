# ColorBridge MVP 实施计划

> **给智能代理执行者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务实施本计划。步骤使用复选框（`- [ ]`）语法跟踪。

**目标：** 构建一个稳定的单页 ColorBridge Demo，把客户模糊的颜色表达转成已确认、可打样、可追溯的标准色需求。

**架构：** 主体验保留在现有 Next.js 应用中。新增最小 Prisma + SQLite 持久化层，用于保存演示订单、缓存分析、历史案例、打样记录和追溯事件；主 Demo 路径使用确定性种子数据。数据变更使用 Server Actions，前端使用紧凑的客户端工作台承载 6 步流程。

**技术栈：** Next.js 16 App Router、React 19、TypeScript 严格模式、Tailwind CSS 4、shadcn/ui、Radix UI primitives、lucide-react、Prisma Client、SQLite（`prisma/dev.db`）、Vitest。

## 全局约束

- 主 Demo 入口是 Next.js；Chainlit 只保留为提示词调优或备用演示入口。
- MVP 是一个 6 步单页流程：载入聊天、AI 分析、人工确认、历史案例、打样对比、确认与追溯。
- 不做登录、外部设备、ERP、MES、真实文件上传、生产部署、完整 PDF 生成或自动染料配方生成。
- 模型或网络不可用时，Demo 必须通过种子数据和缓存分析继续运行。
- AI 输出必须约束为结构化 JSON 字段：颜色意图、目标颜色名称、需避免色相/风险、面料、基布、光源、目标 Lab、Delta E 阈值、缺失字段、置信度、追问问题。
- SQLite 必须使用本地 `prisma/dev.db`。
- 因为项目当前没有 Prisma，所以新增 Prisma 和 Prisma Client。
- 包管理必须统一使用 `pnpm`；禁止使用 `npm`、`yarn` 或手工修改 lockfile。
- 使用任何第三方依赖前，必须先用 Context7 MCP 查询该依赖当前文档；步骤至少包含 `resolve-library-id` 和针对本任务的 `query-docs`。
- 依赖保持最少；能使用成熟 `pnpm` 包稳定替代的通用逻辑，不要手写实现；只有没有合适依赖、依赖过重或会扩大 MVP 范围时，才保留最小本地实现，并在对应任务步骤写明原因。
- 本计划明确新增 Vitest 作为最小单元测试框架；业务逻辑辅助函数必须先写单元测试再实现。
- UI 组件库必须使用 shadcn/ui；只添加 MVP 需要的组件，禁止执行 `shadcn add --all` 或引入整套重型组件库。
- 基础交互控件优先使用 `web/components/ui/*` 中的 shadcn/ui 组件；页面网格、业务排版、Lab 色块和工厂工作台视觉仍使用 Tailwind CSS 4 直接实现。
- UI 气质必须接近紧凑的工厂打样工作台，而不是营销落地页。

---

## 文件结构

- 修改 `web/package.json`：新增 Prisma、Vitest 和 shadcn/ui 相关依赖，以及 schema 校验、客户端生成和单元测试脚本。
- 创建 `web/components.json`：shadcn/ui 配置，使用现有 `@/*` alias、Tailwind CSS 4 和 lucide 图标。
- 创建 `web/lib/utils.ts`：shadcn/ui 的 `cn` 样式合并工具。
- 创建 `web/components/ui/*`：仅包含 `button`、`input`、`label`、`card`、`badge`、`separator`、`alert`、`tabs`、`tooltip`。
- 创建 `web/prisma/schema.prisma`：定义 `ColorOrder`、`AnalysisResult`、`HistoricalCase`、`SampleAttempt` 和 `TraceEvent`。
- 创建 `web/app/colorbridge/types.ts`：共享 TypeScript 类型，覆盖结构化分析、确认字段、Lab 值、工作台状态和步骤 ID。
- 创建 `web/app/colorbridge/demo-data.ts`：确定性的客户输入、缓存分析 JSON、默认确认字段、历史案例、打样记录和追溯事件文案。
- 创建 `web/app/colorbridge/color-utils.ts`：本地 Lab 色块辅助函数和 Delta E 辅助函数，保证展示一致。
- 创建 `web/app/colorbridge/color-utils.test.ts`：覆盖 Delta E 计算和 Lab 色块输出的单元测试。
- 创建 `web/app/colorbridge/db.ts`：Prisma 单例、种子数据加载、重置/订单变更辅助函数和兜底状态构造。
- 创建 `web/app/actions.ts`：客户端工作台使用的 Server Actions。
- 替换 `web/app/page.tsx`：客户端 6 步 ColorBridge 工作台，调用 Server Actions 并渲染所有流程状态。
- 修改 `web/app/layout.tsx`：ColorBridge metadata 和 `lang="zh-CN"`。
- 修改 `web/app/globals.css`：紧凑工作台的全局基础样式。

---

### 任务 1：Prisma 基础和演示数据契约

**文件：**
- 修改：`web/package.json`
- 创建：`web/components.json`
- 创建：`web/lib/utils.ts`
- 创建：`web/components/ui/button.tsx`
- 创建：`web/components/ui/input.tsx`
- 创建：`web/components/ui/label.tsx`
- 创建：`web/components/ui/card.tsx`
- 创建：`web/components/ui/badge.tsx`
- 创建：`web/components/ui/separator.tsx`
- 创建：`web/components/ui/alert.tsx`
- 创建：`web/components/ui/tabs.tsx`
- 创建：`web/components/ui/tooltip.tsx`
- 创建：`web/prisma/schema.prisma`
- 创建：`web/app/colorbridge/types.ts`
- 创建：`web/app/colorbridge/demo-data.ts`

**接口：**
- 产出：`LabValue`、`StructuredAnalysis`、`ConfirmedRequirement`、`WorkbenchState`、`StepId`
- 产出：`DEMO_CUSTOMER_INPUT`、`CACHED_ANALYSIS`、`DEFAULT_CONFIRMATION`、`SEED_HISTORICAL_CASES`、`SEED_SAMPLE_ATTEMPTS`
- 依赖：现有 Next.js TypeScript 配置和应用路由

- [ ] **步骤 1：用 Context7 确认第三方依赖用法**

执行者在安装依赖前必须查询当前文档：

```text
1. resolve-library-id: Prisma
2. query-docs: 当前 Prisma CLI 如何校验 schema、生成 Prisma Client，并如何通过 pnpm 脚本运行
3. resolve-library-id: Vitest
4. query-docs: 当前 Vitest 如何在 TypeScript 项目中安装、编写 `.test.ts` 单元测试、通过 pnpm 运行
5. resolve-library-id: shadcn/ui
6. query-docs: 当前 shadcn/ui 如何初始化 Next.js App Router + Tailwind CSS 4 项目，以及如何用 pnpm 添加指定组件
```

预期：确认 `prisma validate`、`prisma generate`、`.test.ts`、`describe` / `it` / `expect`、shadcn/ui 初始化和 pnpm 运行脚本仍是当前推荐用法。若 Context7 返回的当前用法与本计划命令不一致，必须先停止并更新本计划后再继续执行。

- [ ] **步骤 2：新增 Prisma、Vitest 包和脚本**

运行：

```powershell
pnpm --dir web add @prisma/client
pnpm --dir web add -D prisma vitest
```

预期：`package.json` 的 `dependencies` 中新增 `@prisma/client`，`devDependencies` 中新增 `prisma` 和 `vitest`，`pnpm-lock.yaml` 由 pnpm 自动更新。

然后修改 `web/package.json` 的 scripts，包含：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "prisma:validate": "prisma validate",
    "prisma:generate": "prisma generate"
  }
}
```

- [ ] **步骤 3：初始化 shadcn/ui 并只添加必要组件**

运行：

```powershell
pnpm --dir web dlx shadcn@latest init
pnpm --dir web dlx shadcn@latest add button input label card badge separator alert tabs tooltip
```

初始化问答必须按以下取值执行：

```text
Style: New York
Base color: Neutral
CSS variables: yes
CSS file: app/globals.css
Components alias: @/components
Utils alias: @/lib/utils
UI alias: @/components/ui
Icon library: lucide
```

预期：

```text
- 创建 web/components.json。
- 创建 web/lib/utils.ts。
- 创建 web/components/ui/button.tsx、input.tsx、label.tsx、card.tsx、badge.tsx、separator.tsx、alert.tsx、tabs.tsx、tooltip.tsx。
- package.json 和 pnpm-lock.yaml 只增加 shadcn/ui 组件实际需要的依赖。
- 不添加未列出的 shadcn/ui 组件。
```

- [ ] **步骤 4：创建 Prisma schema**

创建 `web/prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model ColorOrder {
  id               String          @id @default(cuid())
  customerInput    String
  status           String
  confirmedFields  Json?
  selectedCaseId   String?
  selectedSampleId String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  analysis         AnalysisResult?
  sampleAttempts   SampleAttempt[]
  traceEvents      TraceEvent[]
}

model AnalysisResult {
  id            String     @id @default(cuid())
  orderId       String     @unique
  order         ColorOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  extractedJson Json
  missingFields Json
  confidence    Float
  source        String
  createdAt     DateTime   @default(now())
}

model HistoricalCase {
  id               String   @id
  name             String
  fabric           String
  baseCloth        String
  lab              Json
  similarityReason String
  riskNote         String
  createdAt        DateTime @default(now())
}

model SampleAttempt {
  id          String     @id
  orderId     String
  order       ColorOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  version     String
  lab         Json
  deltaE      Float
  passed      Boolean
  deviation   String
  createdAt   DateTime   @default(now())
}

model TraceEvent {
  id        String     @id @default(cuid())
  orderId   String
  order     ColorOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  label     String
  detail    String
  createdAt DateTime   @default(now())
}
```

- [ ] **步骤 5：在编写应用代码前校验 schema**

运行：

```powershell
pnpm --dir web prisma:validate
```

预期：命令以 `0` 退出，并打印 `prisma\schema.prisma` 中的 schema 有效。

- [ ] **步骤 6：创建共享演示类型**

创建 `web/app/colorbridge/types.ts`：

```ts
export type StepId =
  | "load"
  | "analysis"
  | "confirm"
  | "history"
  | "sampling"
  | "trace";

export type LabValue = {
  l: number;
  a: number;
  b: number;
};

export type StructuredAnalysis = {
  colorIntent: string;
  targetColorName: string;
  avoidHueRisk: string;
  fabric: string;
  baseCloth: string | null;
  illuminant: string | null;
  targetLab: LabValue | null;
  deltaEThreshold: number | null;
  missingFields: string[];
  confidence: number;
  followUpQuestions: string[];
};

export type ConfirmedRequirement = {
  illuminant: string;
  baseCloth: string;
  targetLab: LabValue;
  deltaEThreshold: number;
};

export type HistoricalCaseView = {
  id: string;
  name: string;
  fabric: string;
  baseCloth: string;
  lab: LabValue;
  similarityReason: string;
  riskNote: string;
};

export type SampleAttemptView = {
  id: string;
  version: string;
  lab: LabValue;
  deltaE: number;
  passed: boolean;
  deviation: string;
};

export type TraceEventView = {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
};

export type WorkbenchState = {
  orderId: string | null;
  customerInput: string;
  status: string;
  analysis: StructuredAnalysis | null;
  confirmedFields: ConfirmedRequirement | null;
  historicalCases: HistoricalCaseView[];
  sampleAttempts: SampleAttemptView[];
  traceEvents: TraceEventView[];
  selectedCaseId: string | null;
  selectedSampleId: string | null;
  error: string | null;
};
```

- [ ] **步骤 7：创建确定性种子数据**

创建 `web/app/colorbridge/demo-data.ts`：

```ts
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
    similarityReason: "同为棉针织，低饱和蓝灰方向接近，历史返修少。",
    riskNote: "二浴后略偏灰，需盯紧红相。",
  },
  {
    id: "case-muted-blue-jersey-02",
    name: "低饱和蓝灰客供样",
    fabric: "棉氨汗布",
    baseCloth: "暖底白布",
    lab: { l: 63.1, a: -3.6, b: -10.9 },
    similarityReason: "客户描述包含高级感和不偏紫，语义风险相近。",
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
    deviation: "亮度偏低，蓝相偏重，视觉上更冷并接近偏紫风险。",
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
```

- [ ] **步骤 8：提交**

```powershell
git add web/package.json web/pnpm-lock.yaml web/components.json web/lib/utils.ts web/components/ui web/prisma/schema.prisma web/app/colorbridge/types.ts web/app/colorbridge/demo-data.ts
git commit -m "feat: add colorbridge prisma foundation"
```

预期：提交成功。如果依赖安装只改了 `package.json`，没有产生 lockfile 变化，只添加实际存在的文件，不要手动创建 lockfile。

---

### 任务 2：服务端状态、种子数据和兜底路径

**文件：**
- 创建：`web/app/colorbridge/color-utils.ts`
- 创建：`web/app/colorbridge/color-utils.test.ts`
- 创建：`web/app/colorbridge/db.ts`
- 创建：`web/app/actions.ts`

**接口：**
- 依赖：`DEFAULT_CONFIRMATION`、`CACHED_ANALYSIS`、`SEED_HISTORICAL_CASES`、`SEED_SAMPLE_ATTEMPTS`
- 产出：`deltaE76(target: LabValue, sample: LabValue): number`
- 产出：`labToCssColor(lab: LabValue): string`
- 产出：`getWorkbenchState(): Promise<WorkbenchState>`
- 产出：`resetDemoOrder(): Promise<WorkbenchState>`
- 产出：`runCachedAnalysis(orderId: string): Promise<WorkbenchState>`
- 产出：`confirmRequirement(orderId: string, fields: ConfirmedRequirement): Promise<WorkbenchState>`
- 产出：`attachHistoricalCases(orderId: string): Promise<WorkbenchState>`
- 产出：`attachSampleAttempts(orderId: string): Promise<WorkbenchState>`

- [ ] **步骤 1：生成 Prisma Client**

运行：

```powershell
pnpm --dir web prisma:generate
```

预期：Prisma Client 成功生成，没有 schema 错误。

- [ ] **步骤 2：写颜色辅助函数的失败单元测试**

创建 `web/app/colorbridge/color-utils.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { deltaE76, labToCssColor } from "./color-utils";

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
  it("maps a Lab value to the deterministic HSL swatch used by the demo", () => {
    expect(labToCssColor({ l: 62.4, a: -3.1, b: -11.8 })).toBe(
      "hsl(198 27% 62%)",
    );
  });

  it("clamps extreme Lab values into the display-safe range", () => {
    expect(labToCssColor({ l: 90, a: 40, b: 40 })).toBe("hsl(228 30% 78%)");
  });
});
```

- [ ] **步骤 3：运行单元测试并确认失败**

运行：

```powershell
pnpm --dir web test -- color-utils
```

预期：测试失败，原因是 `web/app/colorbridge/color-utils.ts` 尚未创建或未导出 `deltaE76` / `labToCssColor`。如果失败原因是 Vitest 未安装或脚本缺失，先回到任务 1 修正依赖和 `scripts`，不要跳过测试。

- [ ] **步骤 4：创建颜色辅助函数**

创建 `web/app/colorbridge/color-utils.ts`：

```ts
import type { LabValue } from "./types";

export function deltaE76(target: LabValue, sample: LabValue) {
  const l = target.l - sample.l;
  const a = target.a - sample.a;
  const b = target.b - sample.b;
  return Number(Math.sqrt(l * l + a * a + b * b).toFixed(1));
}

export function labToCssColor(lab: LabValue) {
  const lightness = Math.max(20, Math.min(78, lab.l));
  const hue = 210 + Math.max(-18, Math.min(18, lab.b));
  const saturation = 18 + Math.max(0, Math.min(12, Math.abs(lab.a) + Math.abs(lab.b) / 2));
  return `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
}
```

- [ ] **步骤 5：运行颜色辅助函数单元测试并确认通过**

运行：

```powershell
pnpm --dir web test -- color-utils
```

预期：`color-utils.test.ts` 全部通过。该文件保留本地实现的原因：MVP 只需要确定性演示色块和 CIE76 展示值，当前引入完整颜色科学库会扩大依赖面；若后续需要 CIEDE2000、ICC 或真实色彩管理，再按全局约束先用 Context7 查询并评估第三方包。

- [ ] **步骤 6：创建基于 Prisma 的状态辅助函数**

创建 `web/app/colorbridge/db.ts`，包含以下导出函数：

```ts
import "server-only";

import { PrismaClient } from "@prisma/client";
import {
  CACHED_ANALYSIS,
  DEFAULT_CONFIRMATION,
  DEMO_CUSTOMER_INPUT,
  SEED_HISTORICAL_CASES,
  SEED_SAMPLE_ATTEMPTS,
} from "./demo-data";
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

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

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

  return {
    orderId: order.id,
    customerInput: order.customerInput,
    status: order.status,
    analysis: order.analysis?.extractedJson as StructuredAnalysis | null,
    confirmedFields: asConfirmed(order.confirmedFields),
    historicalCases: historicalCases.map((item) => ({
      id: item.id,
      name: item.name,
      fabric: item.fabric,
      baseCloth: item.baseCloth,
      lab: asLab(item.lab),
      similarityReason: item.similarityReason,
      riskNote: item.riskNote,
    })),
    sampleAttempts: order.sampleAttempts.map((item) => ({
      id: item.id,
      version: item.version,
      lab: asLab(item.lab),
      deltaE: item.deltaE,
      passed: item.passed,
      deviation: item.deviation,
    })),
    traceEvents: order.traceEvents.map((item) => ({
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
    confirmedFields: DEFAULT_CONFIRMATION,
    historicalCases: SEED_HISTORICAL_CASES,
    sampleAttempts: SEED_SAMPLE_ATTEMPTS,
    traceEvents: [
      {
        id: "fallback-trace-1",
        label: "载入缓存演示",
        detail: "Prisma 不可用时使用内置数据继续完整流程。",
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
    const order = await prisma.colorOrder.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!order) return resetDemoOrder();
    return stateFromOrder(order.id);
  } catch (error) {
    return getFallbackState(error instanceof Error ? error.message : "数据库访问失败。");
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
            label: "载入客户聊天",
            detail: "已创建新的 ColorBridge 演示订单。",
          },
        },
      },
    });
    return stateFromOrder(order.id);
  } catch (error) {
    return getFallbackState(error instanceof Error ? error.message : "重置演示失败。");
  }
}

export async function runCachedAnalysis(orderId: string): Promise<WorkbenchState> {
  await prisma.analysisResult.upsert({
    where: { orderId },
    update: {
      extractedJson: CACHED_ANALYSIS,
      missingFields: CACHED_ANALYSIS.missingFields,
      confidence: CACHED_ANALYSIS.confidence,
      source: "cached-demo-json",
    },
    create: {
      orderId,
      extractedJson: CACHED_ANALYSIS,
      missingFields: CACHED_ANALYSIS.missingFields,
      confidence: CACHED_ANALYSIS.confidence,
      source: "cached-demo-json",
    },
  });
  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: "analysis_ready",
      traceEvents: {
        create: {
          label: "运行 AI 分析",
          detail: "使用缓存 JSON 完成结构化提取，保证演示稳定。",
        },
      },
    },
  });
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

export async function attachHistoricalCases(orderId: string): Promise<WorkbenchState> {
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

export async function attachSampleAttempts(orderId: string): Promise<WorkbenchState> {
  await prisma.sampleAttempt.deleteMany({ where: { orderId } });
  await prisma.sampleAttempt.createMany({
    data: SEED_SAMPLE_ATTEMPTS.map((item) => ({
      id: item.id,
      orderId,
      version: item.version,
      lab: item.lab,
      deltaE: item.deltaE,
      passed: item.passed,
      deviation: item.deviation,
    })),
  });
  await prisma.colorOrder.update({
    where: { id: orderId },
    data: {
      status: "sample_passed",
      selectedSampleId: SEED_SAMPLE_ATTEMPTS[1].id,
      traceEvents: {
        create: {
          label: "对比打样结果",
          detail: "V1 未达标，V2 Delta E 0.6 达标。",
        },
      },
    },
  });
  return stateFromOrder(orderId);
}
```

- [ ] **步骤 7：创建 Server Actions**

创建 `web/app/actions.ts`：

```ts
"use server";

import {
  attachHistoricalCases,
  attachSampleAttempts,
  confirmRequirement,
  getWorkbenchState,
  resetDemoOrder,
  runCachedAnalysis,
} from "./colorbridge/db";
import type { ConfirmedRequirement } from "./colorbridge/types";

export async function loadWorkbenchAction() {
  return getWorkbenchState();
}

export async function resetDemoAction() {
  return resetDemoOrder();
}

export async function runAnalysisAction(orderId: string | null) {
  if (!orderId) return resetDemoOrder();
  return runCachedAnalysis(orderId);
}

export async function confirmRequirementAction(
  orderId: string | null,
  fields: ConfirmedRequirement,
) {
  if (!orderId) return resetDemoOrder();
  return confirmRequirement(orderId, fields);
}

export async function matchHistoryAction(orderId: string | null) {
  if (!orderId) return resetDemoOrder();
  return attachHistoricalCases(orderId);
}

export async function compareSamplesAction(orderId: string | null) {
  if (!orderId) return resetDemoOrder();
  return attachSampleAttempts(orderId);
}
```

- [ ] **步骤 8：验证服务端代码可编译并通过单元测试**

运行：

```powershell
pnpm --dir web lint
pnpm --dir web test
```

预期：两个命令均以 `0` 退出。如果 lint 报告无法解析 `server-only`，先用 Context7 查询 `server-only` 在 Next.js 中的当前用法；确认仍需要该包后，执行 `pnpm --dir web add server-only` 安装，然后重新运行 `pnpm --dir web lint` 和 `pnpm --dir web test`。

- [ ] **步骤 9：提交**

```powershell
git add web/app/colorbridge/color-utils.ts web/app/colorbridge/color-utils.test.ts web/app/colorbridge/db.ts web/app/actions.ts web/package.json web/pnpm-lock.yaml
git commit -m "feat: add colorbridge demo state actions"
```

预期：提交成功，且只包含本任务触碰的文件。

---

### 任务 3：单页工作台 UI

**文件：**
- 替换：`web/app/page.tsx`

**接口：**
- 依赖：`web/app/actions.ts` 中的 Server Actions
- 依赖：`WorkbenchState`、`StepId`、`ConfirmedRequirement`
- 依赖：`@/components/ui/button`、`@/components/ui/input`、`@/components/ui/label`、`@/components/ui/card`、`@/components/ui/badge`、`@/components/ui/alert`、`@/components/ui/tabs`、`@/components/ui/tooltip`
- 产出：首屏即进入可交互的 6 步 Demo 工作台

- [ ] **步骤 1：确认 shadcn/ui 使用边界**

`web/app/page.tsx` 必须按以下映射使用 shadcn/ui：

```text
- 所有 button 元素使用 Button。
- 所有文本输入和数字输入使用 Input，并配合 Label。
- 单个信息块、历史案例、打样记录、右侧栏模块使用 Card / CardHeader / CardContent。
- 通过 / 未通过、流程状态、缓存兜底状态使用 Badge。
- Prisma 兜底提示使用 Alert。
- 6 步流程主内容使用 Tabs / TabsList / TabsTrigger / TabsContent。
- 不明显的图标按钮或短标签状态使用 TooltipProvider / Tooltip / TooltipTrigger / TooltipContent。
```

以下内容继续使用 Tailwind CSS 直接实现：

```text
- 页面三栏网格和响应式布局。
- 工厂工作台的颜色、边框、间距、密度。
- Lab 色块。
- 业务数据渲染循环。
```

禁止新增未在任务 1 安装的 shadcn/ui 组件。如果确实需要新组件，必须先停止并更新本计划。

- [ ] **步骤 2：用客户端工作台替换初始页面**

将 `web/app/page.tsx` 替换为以下客户端组件；实现时必须遵守步骤 1 的 shadcn/ui 映射，不得退回原生 `button`、`input`、裸 `label` 或手写基础交互控件：

```tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  compareSamplesAction,
  confirmRequirementAction,
  loadWorkbenchAction,
  matchHistoryAction,
  resetDemoAction,
  runAnalysisAction,
} from "./actions";
import { DEFAULT_CONFIRMATION } from "./colorbridge/demo-data";
import { labToCssColor } from "./colorbridge/color-utils";
import type {
  ConfirmedRequirement,
  StepId,
  WorkbenchState,
} from "./colorbridge/types";

const steps: { id: StepId; label: string }[] = [
  { id: "load", label: "载入客户聊天" },
  { id: "analysis", label: "AI 分析" },
  { id: "confirm", label: "人工确认" },
  { id: "history", label: "历史案例" },
  { id: "sampling", label: "打样对比" },
  { id: "trace", label: "确认追溯" },
];

const stepOrder = steps.map((step) => step.id);

function completedIndex(state: WorkbenchState | null) {
  if (!state?.orderId && state?.status !== "fallback") return -1;
  if (state?.status === "fallback") return 5;
  if (state?.selectedSampleId) return 5;
  if (state?.sampleAttempts.length) return 4;
  if (state?.selectedCaseId) return 3;
  if (state?.confirmedFields) return 2;
  if (state?.analysis) return 1;
  if (state?.customerInput) return 0;
  return -1;
}

function formatLab(lab: { l: number; a: number; b: number }) {
  return `L ${lab.l.toFixed(1)} / a ${lab.a.toFixed(1)} / b ${lab.b.toFixed(1)}`;
}

export default function Home() {
  const [state, setState] = useState<WorkbenchState | null>(null);
  const [activeStep, setActiveStep] = useState<StepId>("load");
  const [form, setForm] = useState<ConfirmedRequirement>(DEFAULT_CONFIRMATION);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const next = await loadWorkbenchAction();
      setState(next);
      setForm(next.confirmedFields ?? DEFAULT_CONFIRMATION);
    });
  }, []);

  const done = completedIndex(state);
  const targetLab = state?.confirmedFields?.targetLab ?? form.targetLab;

  const statusText = useMemo(() => {
    if (!state) return "初始化";
    if (state.error) return "缓存兜底";
    if (done >= 5) return "已生成确认卡";
    return `流程 ${Math.max(done + 1, 1)}/6`;
  }, [done, state]);

  function run(action: () => Promise<WorkbenchState>, nextStep: StepId) {
    startTransition(async () => {
      const next = await action();
      setState(next);
      setForm(next.confirmedFields ?? form);
      setActiveStep(nextStep);
    });
  }

  function updateLab(key: "l" | "a" | "b", value: string) {
    setForm((current) => ({
      ...current,
      targetLab: { ...current.targetLab, [key]: Number(value) },
    }));
  }

  return (
    <main className="min-h-screen bg-[#f4f1ec] text-[#1f2933]">
      <header className="border-b border-[#d6d0c6] bg-[#fbfaf7] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#607d8b]">
              ColorBridge
            </p>
            <h1 className="text-2xl font-semibold text-[#16202a]">
              色译通打样工作台
            </h1>
            <p className="mt-1 text-sm text-[#51606d]">
              将模糊颜色表达转成可确认、可打样、可追溯的标准色需求。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded border border-[#9aa9b2] bg-white px-3 py-2 text-sm font-medium">
              {statusText}
            </span>
            <button
              className="rounded bg-[#1f6f78] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={isPending}
              onClick={() => run(resetDemoAction, "load")}
            >
              载入演示案例
            </button>
            <button
              className="rounded border border-[#b8aea2] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={isPending}
              onClick={() => run(resetDemoAction, "load")}
            >
              重置 Demo
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:px-6">
        <aside className="rounded border border-[#d6d0c6] bg-[#fbfaf7] p-3">
          <nav className="grid gap-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                className={`flex items-center gap-2 rounded px-3 py-2 text-left text-sm ${
                  activeStep === step.id
                    ? "bg-[#1f6f78] text-white"
                    : "bg-white text-[#33424f]"
                }`}
                onClick={() => setActiveStep(step.id)}
              >
                <span className="grid h-6 w-6 place-items-center rounded border border-current text-xs">
                  {index + 1}
                </span>
                <span>{step.label}</span>
                <span className="ml-auto text-xs">{index <= done ? "完成" : "待办"}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-h-[620px] rounded border border-[#d6d0c6] bg-white p-4">
          {state?.error ? (
            <div className="mb-4 rounded border border-[#d7a64a] bg-[#fff7df] px-3 py-2 text-sm text-[#6f4d00]">
              Prisma 访问失败，当前展示缓存演示路径：{state.error}
            </div>
          ) : null}

          {activeStep === "load" && (
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">1. 载入客户聊天</h2>
              <div className="rounded border border-[#d6d0c6] bg-[#f8faf9] p-4 text-lg">
                {state?.customerInput ?? "点击载入演示案例。"}
              </div>
              <button
                className="w-fit rounded bg-[#1f6f78] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isPending}
                onClick={() => run(resetDemoAction, "analysis")}
              >
                创建 / 重置演示订单
              </button>
            </div>
          )}

          {activeStep === "analysis" && (
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">2. AI 结构化分析</h2>
              <button
                className="w-fit rounded bg-[#1f6f78] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isPending}
                onClick={() => run(() => runAnalysisAction(state?.orderId ?? null), "confirm")}
              >
                运行 AI 分析
              </button>
              {state?.analysis && (
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="颜色意图" value={state.analysis.colorIntent} />
                  <Info label="目标颜色" value={state.analysis.targetColorName} />
                  <Info label="风险" value={state.analysis.avoidHueRisk} />
                  <Info label="面料" value={state.analysis.fabric} />
                  <Info label="置信度" value={`${Math.round(state.analysis.confidence * 100)}%`} />
                  <Info label="缺失字段" value={state.analysis.missingFields.join("、")} />
                </div>
              )}
            </div>
          )}

          {activeStep === "confirm" && (
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">3. 人工确认缺失字段</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="光源" value={form.illuminant} onChange={(value) => setForm({ ...form, illuminant: value })} />
                <Field label="基布" value={form.baseCloth} onChange={(value) => setForm({ ...form, baseCloth: value })} />
                <NumberField label="Lab L" value={form.targetLab.l} onChange={(value) => updateLab("l", value)} />
                <NumberField label="Lab a" value={form.targetLab.a} onChange={(value) => updateLab("a", value)} />
                <NumberField label="Lab b" value={form.targetLab.b} onChange={(value) => updateLab("b", value)} />
                <NumberField label="Delta E 阈值" value={form.deltaEThreshold} onChange={(value) => setForm({ ...form, deltaEThreshold: Number(value) })} />
              </div>
              <button
                className="w-fit rounded bg-[#1f6f78] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isPending}
                onClick={() => run(() => confirmRequirementAction(state?.orderId ?? null, form), "history")}
              >
                确认需求字段
              </button>
            </div>
          )}

          {activeStep === "history" && (
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">4. 相似历史案例</h2>
              <button
                className="w-fit rounded bg-[#1f6f78] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isPending}
                onClick={() => run(() => matchHistoryAction(state?.orderId ?? null), "sampling")}
              >
                检索 3 条候选案例
              </button>
              <div className="grid gap-3">
                {state?.historicalCases.map((item) => (
                  <article key={item.id} className="rounded border border-[#d6d0c6] p-3">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-[#51606d]">{item.fabric} / {item.baseCloth} / {formatLab(item.lab)}</p>
                    <p className="mt-2 text-sm">{item.similarityReason}</p>
                    <p className="mt-1 text-sm text-[#8a4a1f]">{item.riskNote}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeStep === "sampling" && (
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">5. 打样 Lab 与 Delta E 对比</h2>
              <button
                className="w-fit rounded bg-[#1f6f78] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={isPending}
                onClick={() => run(() => compareSamplesAction(state?.orderId ?? null), "trace")}
              >
                生成打样对比
              </button>
              <div className="grid gap-3 md:grid-cols-2">
                {state?.sampleAttempts.map((item) => (
                  <article key={item.id} className="rounded border border-[#d6d0c6] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">{item.version}</h3>
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${item.passed ? "bg-[#d9efe4] text-[#0f6842]" : "bg-[#f8ded7] text-[#9a3412]"}`}>
                        {item.passed ? "通过" : "未通过"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{formatLab(item.lab)}</p>
                    <p className="text-sm">Delta E {item.deltaE.toFixed(1)}</p>
                    <p className="mt-2 text-sm text-[#51606d]">{item.deviation}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeStep === "trace" && (
            <div className="grid gap-4">
              <h2 className="text-xl font-semibold">6. 客户确认卡与追溯</h2>
              <div className="rounded border border-[#d6d0c6] bg-[#f8faf9] p-4">
                <h3 className="font-semibold">报告预览</h3>
                <p className="mt-2 text-sm">需求：{state?.analysis?.targetColorName ?? "低饱和雾霾蓝"}，避免偏紫。</p>
                <p className="text-sm">条件：{state?.confirmedFields?.illuminant} / {state?.confirmedFields?.baseCloth} / Delta E {state?.confirmedFields?.deltaEThreshold}</p>
                <p className="text-sm">达标版本：{state?.sampleAttempts.find((item) => item.passed)?.version ?? "V2"}</p>
              </div>
              <div className="grid gap-2">
                {state?.traceEvents.map((event) => (
                  <div key={event.id} className="rounded border border-[#d6d0c6] px-3 py-2 text-sm">
                    <p className="font-medium">{event.label}</p>
                    <p className="text-[#51606d]">{event.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="grid gap-4">
          <section className="rounded border border-[#d6d0c6] bg-[#fbfaf7] p-3">
            <h2 className="font-semibold">订单摘要</h2>
            <p className="mt-2 text-sm text-[#51606d]">{state?.customerInput}</p>
          </section>
          <section className="rounded border border-[#d6d0c6] bg-[#fbfaf7] p-3">
            <h2 className="font-semibold">Lab 色块</h2>
            <div className="mt-3 h-24 rounded border border-[#b8aea2]" style={{ backgroundColor: labToCssColor(targetLab) }} />
            <p className="mt-2 text-sm">{formatLab(targetLab)}</p>
          </section>
          <section className="rounded border border-[#d6d0c6] bg-[#fbfaf7] p-3">
            <h2 className="font-semibold">风险提示</h2>
            <p className="mt-2 text-sm text-[#8a4a1f]">{state?.analysis?.avoidHueRisk ?? "避免偏紫，确认光源和基布后再打样。"}</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#d6d0c6] p-3">
      <p className="text-xs font-semibold text-[#607d8b]">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input className="rounded border border-[#b8aea2] px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input className="rounded border border-[#b8aea2] px-3 py-2" type="number" step="0.1" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
```

- [ ] **步骤 3：检查页面没有残留原生基础交互控件**

运行：

```powershell
rg -n "<button|<input|<label" web\app\page.tsx
```

预期：命令没有输出。如果仍有匹配，必须把对应位置替换为 `Button`、`Input` 或 `Label` 后再继续。

- [ ] **步骤 4：运行 lint 并修复 JSX 风格问题**

运行：

```powershell
pnpm --dir web lint
```

预期：lint 通过。如果出现行长或格式问题，只拆分 JSX props，不改变组件行为。

- [ ] **步骤 5：提交**

```powershell
git add web/app/page.tsx
git commit -m "feat: build colorbridge workbench"
```

预期：提交成功。

---

### 任务 4：完善布局、metadata 和全局样式

**文件：**
- 修改：`web/app/layout.tsx`
- 修改：`web/app/globals.css`

**接口：**
- 依赖：现有应用路由根布局
- 依赖：任务 1 中 shadcn/ui 初始化生成的 `web/app/globals.css` 变量和层级
- 产出：中文 metadata、紧凑的全局页面基线、保留 shadcn/ui 主题变量、无初始模板品牌露出

- [ ] **步骤 1：更新 metadata 和语言**

修改 `web/app/layout.tsx`：

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ColorBridge 色译通",
  description: "模糊颜色表达转标准打样需求的演示工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
```

- [ ] **步骤 2：保留 shadcn/ui 变量并追加全局基线**

修改 `web/app/globals.css` 时，必须保留 shadcn/ui 初始化生成的所有 `@import`、`@theme`、`:root`、`.dark`、`@layer` 和 CSS 变量；只在文件末尾追加或调整以下项目基线。禁止把文件替换成不含 shadcn/ui 变量的简化版本。

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f4f1ec;
  color: #1f2933;
  font-family: Arial, Helvetica, sans-serif;
}

button,
input,
textarea,
select {
  font: inherit;
}
```

- [ ] **步骤 3：验证构建**

运行：

```powershell
pnpm --dir web build
```

预期：生产构建成功完成。如果 Prisma 报告缺少已生成的 client，运行 `pnpm --dir web prisma:generate` 后重新运行 `pnpm --dir web build`。

- [ ] **步骤 4：提交**

```powershell
git add web/app/layout.tsx web/app/globals.css
git commit -m "feat: polish colorbridge app shell"
```

预期：提交成功。

---

### 任务 5：端到端 Demo 验证

**文件：**
- 预期不改生产代码
- 只有在验证失败且有明确原因时，才修改对应任务文件

**接口：**
- 依赖：前面所有任务
- 产出：已验证的 MVP Demo 路径

- [ ] **步骤 1：校验 Prisma schema**

运行：

```powershell
pnpm --dir web prisma:validate
```

预期：schema 有效。

- [ ] **步骤 2：运行 lint**

运行：

```powershell
pnpm --dir web lint
```

预期：lint 以 `0` 退出。

- [ ] **步骤 3：运行单元测试**

运行：

```powershell
pnpm --dir web test
```

预期：Vitest 以 `0` 退出，`color-utils.test.ts` 全部通过。

- [ ] **步骤 4：运行生产构建**

运行：

```powershell
pnpm --dir web build
```

预期：build 以 `0` 退出，并报告 Next.js 生产构建成功。

- [ ] **步骤 5：启动开发服务器**

运行：

```powershell
pnpm --dir web dev
```

预期：Next.js 在 `http://localhost:3000` 提供应用；如果 `3000` 被占用，则打印替代端口。

- [ ] **步骤 6：手动浏览器流程验证**

在浏览器中：

```text
1. Open the local dev URL.
2. Click "载入演示案例".
3. Click step 2 and run "运行 AI 分析".
4. Confirm the prefilled fields in step 3.
5. Click historical matching in step 4.
6. Generate sample comparison in step 5.
7. Confirm step 6 shows report preview and trace events.
8. Click "重置 Demo".
9. Repeat steps 2-7 once more.
```

预期：

```text
- Both runs complete all 6 steps.
- V1 shows 未通过 and Delta E 2.1.
- V2 shows 通过 and Delta E 0.6.
- The right rail updates the Lab swatch and risk note.
- No page goes blank.
```

- [ ] **步骤 7：模拟 Prisma 兜底路径**

在开发服务器停止时，临时把 `web/prisma/dev.db` 移动到 `web/prisma/dev.db.bak`，然后重新启动：

```powershell
if (Test-Path web\prisma\dev.db) { Move-Item web\prisma\dev.db web\prisma\dev.db.bak }
pnpm --dir web dev
```

预期：应用要么重新创建演示数据，要么显示清晰的缓存兜底提示条，并且仍然允许跑完 6 步 Demo。检查后恢复数据库：

```powershell
if (Test-Path web\prisma\dev.db.bak) { Move-Item -Force web\prisma\dev.db.bak web\prisma\dev.db }
```

- [ ] **步骤 8：如果验证修复改了代码，则做最终提交**

如果验证过程需要修改代码：

```powershell
git add web
git commit -m "fix: stabilize colorbridge demo flow"
```

预期：没有未提交的验证修复残留。

---

## 自检

**规格覆盖：** 已覆盖单页 6 步流程、确定性缓存 AI JSON、可编辑确认字段、3 条历史种子案例、2 次打样记录及通过/未通过状态、报告预览、追溯时间线、Prisma + SQLite 持久化，以及数据库失败时的兜底展示。

**依赖纪律覆盖：** 已明确所有 JavaScript 包管理使用 `pnpm`，使用第三方依赖前必须先通过 Context7 MCP 查询当前文档；已把 Prisma、Vitest 和可能新增的 `server-only` 纳入该规则。

**UI 组件库覆盖：** 已明确使用 shadcn/ui 作为唯一 UI 组件库，基础交互控件使用 `web/components/ui/*`，只添加 MVP 必需组件，并保留 Tailwind CSS 4 承担业务布局和工厂工作台视觉。

**测试覆盖：** 已新增 Vitest 作为最小单元测试框架，`color-utils.test.ts` 覆盖 Delta E 计算、HSL 色块映射和极值钳制；最终验证链路包含 `pnpm --dir web test`。

**占位内容扫描：** 每个任务都列出了精确文件、命令、预期结果和具体接口；没有保留占位式实现语言。

**类型一致性：** `ConfirmedRequirement`、`StructuredAnalysis`、`HistoricalCaseView`、`SampleAttemptView` 和 `WorkbenchState` 在任务 1 中定义，并被 server actions 和 UI 任务一致复用。

**已知执行备注：** 全新 Next.js 安装中可能没有 `server-only` 包。如果 lint 报告该模块缺失，任务 2 已包含明确修复命令。
