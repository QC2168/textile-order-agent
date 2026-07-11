# ColorBridge 调色协同 Agent 开发文档

## 当前目标

在 `xiaolai` 分支现有 Chainlit 智能体里，接入第一版 ColorBridge 调色协同能力：

用户输入调色需求 -> 创建任务订单 -> 系统识别 Demo 意图 -> 查找相似历史批次 -> 给出历史依据、风险等级、调整方向和光源影响提示 -> 保存 V1 方案草稿 -> 再交给大模型组织回答。

这一版不新建独立项目，不改数据库 schema，不做完整前端工作台。

## 当前文件

| 文件 | 作用 |
|---|---|
| `colorbridge_data.py` | Demo 种子数据，字段对齐 `intent_request`、`historical_batch`、`batch_match`。 |
| `colorbridge_tuning.py` | 纯业务逻辑：意图匹配、历史匹配、风险等级、调整建议、光源提示、格式化上下文。 |
| `colorbridge_orders.py` | 轻量任务订单工具：创建订单、查询订单、列订单、查历史、生成调参建议、保存方案版本。 |
| `tests/test_colorbridge_tuning.py` | stdlib `unittest` 测试，覆盖雾霾蓝成功批次、锦纶深紫风险建议、口径提示。 |
| `tests/test_colorbridge_orders.py` | 订单闭环测试，覆盖创建订单、历史匹配、调参建议、方案卡和状态查询。 |
| `app.py` | Chainlit 入口。对纺织调色相关问题追加 ColorBridge 历史匹配上下文。 |
| `docs/superpowers/plans/2026-07-12-colorbridge-tuning-agent-implementation.md` | 本次实现计划。 |

## 数据口径

当前运行时先使用 `colorbridge_data.py` 中的种子数据。

原因：

- `xiaolai` 分支当前主干是 Python/Chainlit 外壳。
- 本地 `.env` 有 `DATABASE_URL`，但当前开发环境连接 PostgreSQL 时服务端关闭连接。
- 为了不阻塞 Demo，先把业务逻辑写成纯函数，后续只需要把 `colorbridge_data.py` 替换成数据库 repository 查询。

## Demo 支持的问题

当前覆盖 4 个 Demo 意图：

1. 雾霾蓝棉针织方案生成。
2. 涤纶四面弹黑色历史查询。
3. 锦纶塔丝隆深紫调参风险。
4. 腈纶围巾宝蓝色花风险。

普通聊天不会追加 ColorBridge 上下文；只有命中颜色、染色、面料、历史、订单、光源、pH、温度等关键词时才触发。

## 任务订单工具

`colorbridge_orders.py` 当前提供这些内部工具：

| 函数 | 作用 |
|---|---|
| `create_task_order(user_text)` | 创建任务订单，生成 `CB-20260712-xxx` 编号，保存用户原文和识别意图。 |
| `get_task_order(order_id)` | 查询单个任务订单。 |
| `list_task_orders(status=None)` | 查询当前进程内的任务订单列表，可按状态过滤。 |
| `search_historical_batches(order_id)` | 为订单查询历史匹配，并把订单状态改为“历史已匹配”。 |
| `generate_tuning_advice(order_id)` | 生成风险等级、调参方向、光源提示，并把订单状态改为“调参建议已生成”。 |
| `save_recipe_version(order_id, adjustments=None)` | 保存一个方案草稿版本，例如 V1。 |
| `get_recipe_card(order_id)` | 查询订单最新方案卡。 |
| `run_order_demo_flow(user_text)` | Demo 快捷流：创建订单、查历史、生成建议、保存 V1 方案。 |
| `submit_recipe_for_review(order_id)` | 提交方案审核，状态改为“方案待审核”。 |
| `confirm_recipe(order_id, reviewer)` | 工艺员确认方案，状态改为“方案已确认”。 |
| `dispatch_to_workshop(order_id, workshop)` | 下发车间，状态改为“已下发车间”。 |
| `update_production_status(order_id, status)` | 更新生产状态，例如“生产中”。 |
| `record_production_result(order_id, actual_lab, actual_delta_e, rft, customer_accepted)` | 录入实际 Lab、色差、RFT 和客户确认。 |
| `create_after_sales_ticket(order_id, issue_type, description)` | 创建售后/客户复核记录，状态改为“售后处理中”。 |
| `close_order(order_id)` | 关闭售后记录并归档订单。 |

这些工具对应的数据概念：

- `intent_request`：由 `create_task_order()` 的 `intent` 字段承载。
- `order_trace`：由订单对象和 `trace_events` 承载。
- `historical_batch`：由 `colorbridge_data.HISTORICAL_BATCHES` 承载。
- `batch_match`：由 `colorbridge_data.BATCH_MATCHES` 承载。
- `recipe_card`：由 `save_recipe_version()` 生成。
- 售后记录：由订单对象里的 `after_sales_tickets` 承载。

## 全链路状态

当前支持的 Demo 状态流：

```text
需求已识别
-> 历史已匹配
-> 调参建议已生成
-> 方案草稿已保存
-> 方案待审核
-> 方案已确认
-> 已下发车间
-> 生产中
-> 生产完成 / 客户已确认
-> 售后处理中
-> 已归档
```

其中前四步由 `run_order_demo_flow()` 自动完成。后续步骤由用户提示词触发，可以一次触发一个工具，也可以一句话触发多个工具。

## 业务规则

### 意图识别

`find_intent(text)` 使用关键词匹配，不调用大模型。

这是有意保留的 Demo 简化：规则可解释、可测试、不会被模型幻觉影响。

### 历史匹配

`matches_for_intent(intent_id)` 返回 `batch_match` 中的 Top 匹配。

`selected_batch_for_intent(intent_id)` 使用 `selected=true` 的匹配记录作为当前基础方案。

### 风险等级

`risk_level(batch)` 规则：

- 没有历史批次：中风险。
- 非一次成功、回修、或 `delta_e >= 2`：高风险。
- `delta_e > 1`：中风险。
- 其他：低风险。

### 调整建议

`adjustment_advice(batch)` 只输出调整方向，不输出“正确配方”。

典型建议：

- 升温过快：降低升温速率。
- pH 偏离：回到该染料体系成功区间。
- 温度偏高：回到成功温度范围。
- 缓染剂不足：提高缓染剂并放慢升温。
- 分散剂偏低：补足分散剂和匀染剂。

### 光源提示

`optical_note(batch)` 给出演示级光源风险：

- 蓝紫系：重点看 D65 和 TL84。
- 深色：关注 A 光源下偏红和 D65 下深浅差异。
- 其他：保留 D65、A、TL84 三光源对照。

## Chainlit 接入方式

`app.py` 中新增：

- `SYSTEM_PROMPT`：限定 ColorBridge 回答口径。
- `COLORBRIDGE_KEYWORDS`：判断是否需要历史匹配上下文。
- `should_use_colorbridge_context(content)`：关键词路由。

在 `on_message` 中：

1. 先保存用户消息。
2. 如果命中 ColorBridge 关键词，进入 `ColorBridge 任务订单` step。
3. 如果用户问订单列表，调用 `list_task_orders()`。
4. 如果用户问当前订单状态，调用 `get_task_order()` 和 `format_task_order()`。
5. 如果用户说提交审核、确认方案、下发、生产中、生产完成、售后、归档等动作，按关键词调用一个或多个订单工具。
6. 其他调色需求调用 `run_order_demo_flow()`，自动完成创建订单、历史匹配、调参建议和方案草稿保存。
7. 把格式化后的确定性上下文作为 system message 追加给模型。
8. 模型基于上下文流式回答。

## 全链路演示提示词

先创建订单：

```text
客户要高级一点的雾霾蓝，别太紫，做在棉针织上
```

查询状态：

```text
这个任务订单现在怎么样？
```

提交审核并确认：

```text
提交审核，审核通过并确认方案
```

下发并进入生产：

```text
确认方案后下发车间，状态改为生产中
```

录入生产结果：

```text
生产完成，实际色差 Delta E 0.7，RFT 一次成功，客户已确认
```

创建售后记录：

```text
客户复核要求补充 TL84 看样照片，创建售后记录
```

归档订单：

```text
售后处理完成，关闭订单并归档
```

## 测试

运行：

```bash
uv run python -m unittest tests.test_colorbridge_tuning -v
uv run python -m unittest tests.test_colorbridge_orders -v
```

当前测试覆盖：

- 雾霾蓝需求命中 `intent_demo_fog_blue_cotton`。
- 雾霾蓝选择一次成功批次 `hist_cotton_fog_blue_001`。
- 锦纶深紫风险案例给出升温和 pH 调整方向。
- 格式化上下文明确写出“调整方向”和“调色师确认”。
- 任务订单创建后状态为“需求已识别”。
- 历史匹配后状态为“历史已匹配”。
- 调参建议生成后状态为“调参建议已生成”。
- 保存方案后生成 V1 草稿方案卡。
- 审核、确认、下发、生产、售后、归档状态按顺序更新。

## 后续替换数据库的方式

后续数据库连接可用后，建议新增一个很薄的 repository 文件，例如 `colorbridge_repository.py`：

- `load_intents()`
- `load_historical_batches()`
- `load_batch_matches(intent_id)`

然后让 `colorbridge_tuning.py` 接收数据参数，或把 `colorbridge_data.py` 的常量替换成 repository 查询结果。

第一版不这样做，是为了保持当前 Chainlit Demo 可运行、可测试、可解释。
