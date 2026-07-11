# 数据库字段说明文档

基于 `web/prisma/schema.prisma`，数据库使用 **PostgreSQL**，通过 **Prisma ORM** 管理。

---

## ColorOrder（订单表）

打样颜色订单主表，存储每个颜色匹配任务的核心信息。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | String (CUID) | ✅ | 主键，自动生成唯一标识 |
| `taskNo` | String? | ❌ | 任务编号，唯一索引，例如 `"TSK-20260712-001"` |
| `customerName` | String | ✅ | 客户名称，默认值 `"默认客户"` |
| `customerInput` | String | ✅ | 客户原始输入（自然语言描述的颜色需求） |
| `requestedColor` | String? | ❌ | 客户请求的目标颜色描述 |
| `colorIntent` | String? | ❌ | AI 解析出的颜色意图/色系分类 |
| `productionMaterial` | String? | ❌ | 生产材料类型（如棉、涤纶等） |
| `baseCloth` | String? | ❌ | 底布/基布类型 |
| `dyeType` | String? | ❌ | 染料类型（如活性染料、分散染料等） |
| `targetLab` | JSON? | ❌ | 目标颜色 Lab 值（CIELAB 色彩空间），JSON 对象 |
| `finalRenderLab` | JSON? | ❌ | 最终确认方案的渲染 Lab 值，JSON 对象 |
| `status` | String | ✅ | 订单状态（如 `pending` / `analyzing` / `matched` / `confirmed`） |
| `confirmedFields` | JSON? | ❌ | 客户已确认的字段集合 |
| `selectedCaseId` | String? | ❌ | 选中的历史案例 ID |
| `selectedSampleId` | String? | ❌ | 选中的打样尝试 ID |
| `finalSchemeId` | String? | ❌ | 最终确认的方案 ID |
| `finalConfirmedAt` | DateTime? | ❌ | 最终方案确认时间 |
| `createdAt` | DateTime | ✅ | 创建时间，自动填充 |
| `updatedAt` | DateTime | ✅ | 更新时间，自动更新 |

### 关联关系

| 关联 | 类型 | 说明 |
|---|---|---|
| `analysis` | 1:1 → AnalysisResult | 一次 AI 分析结果 |
| `historicalCases` | 1:N → HistoricalCase | 匹配到的历史案例列表 |
| `sampleAttempts` | 1:N → SampleAttempt | 打样尝试记录列表 |
| `traceEvents` | 1:N → TraceEvent | 订单操作追踪事件列表 |

---

## AnalysisResult（AI 分析结果表）

存储 AI 对客户输入进行解析后的结构化结果。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | String (CUID) | ✅ | 主键 |
| `orderId` | String | ✅ | 关联订单 ID，唯一索引，级联删除 |
| `extractedJson` | JSON | ✅ | AI 提取的结构化数据（包含颜色参数、材料等） |
| `missingFields` | JSON | ✅ | 标记哪些字段未能从输入中提取 |
| `confidence` | Float | ✅ | AI 提取置信度（0.0 ~ 1.0） |
| `source` | String | ✅ | 数据来源标识（如 `"llm"` / `"manual"`） |
| `createdAt` | DateTime | ✅ | 创建时间 |

### 关联

| 关联 | 类型 | 说明 |
|---|---|---|
| `order` | 1:1 ← ColorOrder | 所属订单 |

---

## HistoricalCase（历史案例表）

存储历史打样案例数据，用于相似色匹配和参考。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | String | ✅ | 主键 |
| `orderId` | String? | ❌ | 关联订单 ID，级联删除 |
| `name` | String | ✅ | 案例名称/编号 |
| `sourceType` | String | ✅ | 数据来源类型，默认 `"seed"`（`seed` / `history` / `import`） |
| `fabric` | String | ✅ | 面料类型 |
| `dyeType` | String? | ❌ | 染料类型 |
| `baseCloth` | String | ✅ | 底布类型 |
| `lab` | JSON | ✅ | 该案例的 CIELAB 色彩值，JSON 对象 |
| `similarityScore` | Float? | ❌ | 与目标颜色的相似度得分（0.0 ~ 1.0） |
| `similarityReason` | String | ✅ | 相似度匹配的判定理由 |
| `riskNote` | String | ✅ | 风险提示（如色差风险、工艺难度等） |
| `selected` | Boolean | ✅ | 是否被用户选中，默认 `false` |
| `createdAt` | DateTime | ✅ | 创建时间 |

### 关联

| 关联 | 类型 | 说明 |
|---|---|---|
| `order` | N:1 → ColorOrder | 所属订单（可为空，即独立案例库） |

---

## SampleAttempt（打样尝试表）

记录每一次物理或虚拟打样尝试的过程与结果。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | String | ✅ | 主键 |
| `orderId` | String | ✅ | 关联订单 ID，级联删除 |
| `version` | String | ✅ | 方案版本号 |
| `schemeName` | String | ✅ | 方案名称，默认 `"方案"` |
| `targetLab` | JSON? | ❌ | 目标 Lab 值，JSON 对象 |
| `lab` | JSON | ✅ | 实际打样测得的 Lab 值，JSON 对象 |
| `aiLab` | JSON? | ❌ | AI 预测的 Lab 值，JSON 对象 |
| `historicalCaseId` | String? | ❌ | 参考的历史案例 ID |
| `productionMaterial` | String? | ❌ | 生产材料 |
| `baseCloth` | String? | ❌ | 底布 |
| `dyeType` | String? | ❌ | 染料类型 |
| `illuminant` | String? | ❌ | 照明体/光源代码（如 `"D65"`） |
| `illuminantLabel` | String? | ❌ | 照明体中文标签（如 `"D65 标准日光"`） |
| `reviewIlluminant` | String? | ❌ | 复核使用的照明体代码 |
| `reviewIlluminantLabel` | String? | ❌ | 复核照明体中文标签 |
| `cctKelvin` | Int? | ❌ | 色温（开尔文，如 6500） |
| `illuminanceLux` | Int? | ❌ | 照度（勒克斯） |
| `viewingAngle` | Int? | ❌ | 观测角度（度） |
| `textureGloss` | Int? | ❌ | 纹理光泽度（0-100） |
| `confirmationSnapshot` | JSON? | ❌ | 确认时的数据快照，JSON 对象 |
| `deltaE` | Float | ✅ | 色差值（与目标的偏差），默认 0 |
| `passed` | Boolean | ✅ | 是否通过检测，默认 `true` |
| `recommendation` | String | ✅ | AI 推荐说明，默认空字符串 |
| `deviation` | String | ✅ | 偏差描述 |
| `selected` | Boolean | ✅ | 是否被选中为最终方案，默认 `false` |
| `confirmedAt` | DateTime? | ❌ | 方案确认时间 |
| `createdAt` | DateTime | ✅ | 创建时间 |

### 关联

| 关联 | 类型 | 说明 |
|---|---|---|
| `order` | N:1 → ColorOrder | 所属订单 |

---

## TraceEvent（追踪事件表）

记录订单生命周期中的关键操作和状态变更。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | String (CUID) | ✅ | 主键 |
| `orderId` | String | ✅ | 关联订单 ID，级联删除 |
| `eventType` | String | ✅ | 事件类型，默认 `"note"`（如 `note` / `status_change` / `confirm` 等） |
| `actor` | String | ✅ | 操作者标识，默认 `"system"`（`system` / `user` / `ai`） |
| `label` | String | ✅ | 事件简短标签/标题 |
| `detail` | String | ✅ | 事件详细描述 |
| `snapshot` | JSON? | ❌ | 事件发生时的数据快照 |
| `createdAt` | DateTime | ✅ | 创建时间 |

### 关联

| 关联 | 类型 | 说明 |
|---|---|---|
| `order` | N:1 → ColorOrder | 所属订单 |

---

## 实体关系图（ER）

```
ColorOrder (1) ──── (0..1) AnalysisResult   [orderId 唯一]
ColorOrder (1) ──── (0..N) HistoricalCase    [orderId 可空]
ColorOrder (1) ──── (0..N) SampleAttempt     [orderId 必填]
ColorOrder (1) ──── (0..N) TraceEvent        [orderId 必填]
```

- **AnalysisResult** 与订单是 1:1，由 `orderId` 唯一索引保证。
- **HistoricalCase** 的 `orderId` 可空，表示案例可独立存在于全局案例库中。
- **SampleAttempt** 和 **TraceEvent** 的 `orderId` 必填，必须依附于订单存在。
- 所有子表均设置 `onDelete: Cascade`，删除订单时级联删除关联数据。

---

## 色彩相关字段说明

本系统围绕 CIELAB 色彩空间建模，核心色彩字段统一使用 JSON 类型存储：

```json
{
  "L": 55.2,   // 明度 (0~100)
  "a": 32.1,   // 红绿轴 (-128~128)
  "b": 18.7    // 黄蓝轴 (-128~128)
}
```

涉及 Lab 值的字段：`ColorOrder.targetLab`、`ColorOrder.finalRenderLab`、`HistoricalCase.lab`、`SampleAttempt.targetLab`、`SampleAttempt.lab`、`SampleAttempt.aiLab`。
