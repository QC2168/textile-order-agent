# ColorBridge Demo 数据表说明

## 目标

这份文档定义 ColorBridge Demo 阶段需要的数据表和字段。

当前目标不是建立完整的工厂 MES 或生产执行系统，而是支撑一条清晰的演示闭环：

用户输入需求 -> 匹配历史批次 -> 基于历史方案微调参数 -> 预览颜色和光源风险 -> 生成方案卡 -> 显示订单追踪。

## 设计原则

- 字段只保留 Demo 能用到、页面能展示、逻辑能解释的内容。
- 复杂生产数据先不拆细，例如完整温度曲线、pH 曲线、加料记录、供应商批号、设备统计看板。
- `parameter_deviation`、`optical_preview`、`trace_event` 可以先作为 JSON 字段放在主表中；后续复杂后再拆成独立表。
- AI 只提供基于历史数据和工艺经验的调整建议，不声称自动生成生产级准确配方。

## 1. 用户意图表 `intent_request`

用于保存用户原始输入，以及系统识别出的业务意图和关键实体。

| 字段 | 类型建议 | 说明 |
|---|---|---|
| `id` | string | 意图记录 ID。 |
| `raw_text` | text | 用户原始输入，例如“这个雾霾蓝棉针织怎么染”。 |
| `intent_type` | enum/string | 意图类型：历史查询、配方咨询、模拟调参、方案生成。 |
| `fabric` | string | 面料关键词，例如纯棉针织、涤棉、锦纶。 |
| `color_name` | string | 颜色名称或色号，例如雾霾蓝、藏青、Pantone 色号。 |
| `target_lab` | json/null | 目标 Lab 值；用户没有提供时可以为空。 |
| `dye_type` | string/null | 染料体系，例如活性、分散、酸性、阳离子。 |
| `confidence` | number | AI 意图识别置信度。 |
| `created_at` | datetime | 创建时间。 |

## 2. 历史批次表 `historical_batch`

用于保存历史成功或失败批次，是历史匹配、参数微调和风险提示的基础。

| 字段 | 类型建议 | 说明 |
|---|---|---|
| `id` | string | 历史批次 ID。 |
| `batch_no` | string | 历史批次号。 |
| `fabric` | string | 历史批次面料。 |
| `color_name` | string | 历史目标颜色。 |
| `target_lab` | json | 历史目标 Lab。 |
| `actual_lab` | json | 实际染出 Lab。 |
| `delta_e` | number | 历史色差。Demo 阶段可统一用一个字段表达。 |
| `rft` | boolean | 是否一次成功。 |
| `reworked` | boolean | 是否回修。 |
| `dye_type` | string | 染料体系。 |
| `dye_formula` | json | 染料配方，保存各染料名称、用量和单位。 |
| `process_params` | json | 工艺参数，保存温度、pH、浴比、元明粉、纯碱、保温时间。 |
| `machine_id` | string/null | 机器编号，Demo 可选展示。 |
| `result_note` | text | 结果说明，例如“首次偏深，回修后通过”。 |

### `dye_formula` 建议结构

```json
[
  { "name": "活性蓝 B-19", "dosage": 1.18, "unit": "% o.w.f." },
  { "name": "活性红 3BS", "dosage": 0.35, "unit": "% o.w.f." }
]
```

### `process_params` 建议结构

```json
{
  "temperature": 60,
  "pH": 10.6,
  "liquor_ratio": 8,
  "salt": 60,
  "alkali": 20,
  "hold_time": 45
}
```

## 3. 历史匹配表 `batch_match`

用于记录某次用户需求匹配到了哪些历史批次，以及每个批次为什么可参考。

| 字段 | 类型建议 | 说明 |
|---|---|---|
| `id` | string | 匹配记录 ID。 |
| `intent_id` | string | 关联 `intent_request.id`。 |
| `batch_id` | string | 关联 `historical_batch.id`。 |
| `similarity_score` | number | 相似度评分。 |
| `rank` | number | 排名，例如 1、2、3。 |
| `difference_note` | text | 与当前需求的差异，例如克重不同、底布不同、设备不同。 |
| `risk_note` | text | 使用该历史批次作为参考时的风险提示。 |
| `selected` | boolean | 用户是否选择这个历史批次作为基础方案。 |

## 4. 调参方案表 `tuning_recipe`

用于保存基于历史批次微调后的当前方案。一个需求可以有多个版本，例如 V1、V2、V3。

| 字段 | 类型建议 | 说明 |
|---|---|---|
| `id` | string | 调参方案 ID。 |
| `intent_id` | string | 关联 `intent_request.id`。 |
| `base_batch_id` | string/null | 基于哪个历史批次调整；没有历史批次时为空。 |
| `version` | string | 方案版本，例如 V1、V2、V3。 |
| `current_formula` | json | 当前染料配方。 |
| `current_params` | json | 当前工艺参数。 |
| `locked_params` | json | 被锁定不能调整的参数列表。 |
| `deviations` | json | 参数偏差列表。Demo 阶段建议先作为 JSON 存在这里。 |
| `risk_level` | enum/string | 当前综合风险：低、中、高。 |
| `warnings` | json | 风险提示列表。 |
| `status` | enum/string | 草稿、已确认、已废弃。 |
| `created_at` | datetime | 创建时间。 |

### `deviations` 建议结构

```json
[
  {
    "parameter_name": "温度",
    "current_value": 64,
    "success_min": 59,
    "success_max": 61,
    "deviation_percent": 150,
    "status": "warning",
    "message": "温度偏高，可能导致颜色偏深"
  }
]
```

## 5. 光学预览数据 `optical_preview`

Demo 阶段建议作为 `tuning_recipe` 或 `recipe_card` 的 JSON 字段保存，不必先拆独立表。

用于保存当前方案的预测颜色、偏色方向和光源风险。

| 字段 | 类型建议 | 说明 |
|---|---|---|
| `target_lab` | json | 目标 Lab。 |
| `predicted_lab` | json | 根据当前参数偏差推算出的预测 Lab。 |
| `delta_l` | number | 明度偏差。 |
| `delta_a` | number | 红绿偏差。 |
| `delta_b` | number | 黄蓝偏差。 |
| `delta_e` | number | 预测色差。 |
| `color_shift` | string | 偏色方向，例如偏深、偏红、偏黄。 |
| `illuminant_previews` | json | 多光源预览，例如 D65、A、TL84 下的 Lab 或色块值。 |
| `metamerism_risk` | enum/string | 同色异谱风险：低、中、高。 |
| `base_cloth_note` | text | 底布影响说明，例如“客户原布偏黄，可能放大 b 值偏差”。 |

## 6. 方案卡表 `recipe_card`

用于保存最终给工艺员、业务员或演示评委看的完整方案。

| 字段 | 类型建议 | 说明 |
|---|---|---|
| `id` | string | 方案卡 ID。 |
| `recipe_id` | string | 关联 `tuning_recipe.id`。 |
| `recipe_no` | string | 方案编号。 |
| `version` | string | 方案版本。 |
| `fabric` | string | 面料。 |
| `color_name` | string | 目标颜色。 |
| `target_lab` | json | 目标 Lab。 |
| `dye_formula` | json | 最终染料配方。 |
| `process_params` | json | 最终工艺参数。 |
| `source_batch_id` | string/null | 参考的历史批次。 |
| `optical_preview` | json/null | 当前方案的光学预览结果。 |
| `risk_notes` | json | 风险提示。 |
| `checklist` | json | 执行检查清单。 |
| `status` | enum/string | 草稿、已确认、已下发。 |
| `created_at` | datetime | 生成时间。 |

### `checklist` 建议内容

```json
[
  "确认面料和克重一致",
  "确认元明粉和纯碱称量",
  "确认 pH 计校准",
  "确认 D65/TL84 下看样"
]
```

## 7. 订单追踪表 `order_trace`

用于第六阶段的简单订单显示。Demo 阶段只展示状态和结果摘要，不做完整生产执行采集。

| 字段 | 类型建议 | 说明 |
|---|---|---|
| `id` | string | 订单追踪 ID。 |
| `order_no` | string | 订单号。 |
| `customer_name` | string | 客户名称。 |
| `intent_id` | string | 关联 `intent_request.id`。 |
| `recipe_card_id` | string/null | 关联最终方案卡。 |
| `workflow_status` | enum/string | 当前状态：需求已识别、历史已匹配、方案调试中、方案已确认、已下发、已完成。 |
| `predicted_risk` | enum/string | 方案预测风险：低、中、高。 |
| `actual_lab` | json/null | 实际生产后 Lab；未完成时为空。 |
| `actual_delta_e` | number/null | 实际色差；未完成时为空。 |
| `rft` | boolean/null | 是否一次成功；未完成时为空。 |
| `summary` | text | 订单摘要说明。 |
| `trace_events` | json | 追踪事件列表。Demo 阶段建议先作为 JSON 存在这里。 |
| `updated_at` | datetime | 更新时间。 |

### `trace_events` 建议结构

```json
[
  {
    "event_time": "2026-07-12 10:30",
    "event_type": "match_history",
    "title": "匹配历史批次",
    "detail": "找到 3 条雾霾蓝棉针织相似批次，已选择 RFT 最高案例作为基础方案",
    "operator": "system"
  }
]
```

## 最小落地表清单

Demo 第一版建议只建或模拟以下 6 张主表：

1. `intent_request`
2. `historical_batch`
3. `batch_match`
4. `tuning_recipe`
5. `recipe_card`
6. `order_trace`

以下内容先作为 JSON 字段，不单独建表：

- `parameter_deviation`
- `optical_preview`
- `trace_event`

## 演示链路对应关系

| 演示阶段 | 使用的数据 |
|---|---|
| 用户输入需求 | `intent_request` |
| 查找历史订单 | `historical_batch` + `batch_match` |
| 基于历史方案微调 | `tuning_recipe.current_formula` + `tuning_recipe.current_params` |
| 显示参数风险 | `tuning_recipe.deviations` + `tuning_recipe.warnings` |
| 显示光源和色块影响 | `optical_preview` |
| 输出最终方案 | `recipe_card` |
| 简单订单显示 | `order_trace` |

## 后续可扩展但暂不做

以下内容适合后续产品化阶段再做：

- 完整温度曲线表。
- 完整 pH 曲线表。
- 实际加料记录表。
- 染料供应商和批号表。
- 设备 RFT 统计表。
- 预测准确性评估表。
- 异常回修处理流程表。
