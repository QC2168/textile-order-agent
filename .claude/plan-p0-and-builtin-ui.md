# 方案：Chainlit P0 能力补齐 + 现成 UI/功能开关

## 1. 范围与不变项

**修改**：
- `app.py`：实现 Streaming、DataFrame、TaskList、ChatSettings、Message avatar/welcome 优化
- `.chainlit/config.toml`：补全现成功能开关
- `chainlit.md`：重写欢迎页（用 markdown + 内置卡片）
- `public/`：放 logo / favicon（可选，由用户决定）

**绝不碰**：
- `database.py`、`seed_mock_data.py`、`tests/test_app_tools.py`（测试断言要保持通过）
- `route_demo_tools` / `format_fallback_answer` / `execute_tool` 的对外签名（避免破坏 fallback 路径和测试）
- 现有 `cl.user_session` 的 key 名（避免污染既有 session）

---

## 2. P0 实现（Streaming / DataFrame / TaskList）

### 2.1 Streaming（流式输出）

**做法**：模型第一次调用保持非流式（要拿 `tool_calls`），最终回答阶段切流式。

新增：
```python
async def call_model_stream(messages):
    return client.chat.completions.create(model=MODEL_ID, messages=messages, stream=True)
```

`on_message` 改动：
- 把第二次 LLM 调用（生成最终回答）改成流式
- 用 `msg = cl.Message(content="")` → `await msg.send()` → 循环 `await msg.stream_token(token)` → `await msg.update()`
- 工具调用阶段 / 异常 fallback 路径保持非流式（保持简单）
- 流式的中断/异常处理：`try/except` 包住，失败时 `await msg.update()` 显示已流到的内容

**为什么第一次不流式**：OpenAI 流式时 `tool_calls` 在第一个 chunk 才完整，单看首 chunk 不能立刻执行工具调用。如果非要全流式，需要等所有 chunk 拼齐 `tool_calls` 才能动手，反而不省时间。

### 2.2 DataFrame（订单列表 / 时间线）

**做法**：抽 `build_elements(tool_name, args, result) -> list[Element]`，在 `on_message` 收齐 tool_calls 后统一组装 elements 挂到最终 message 上。

- `list_orders` 结果 → `cl.Dataframe(data=pd.DataFrame(...), display="inline", name="orders")`
  - 列：订单号 / 客户 / 面料 / 阶段 / 交期 / 风险等级 / 负责人
  - 如果想给风险等级上色，Chainlit 原生 Dataframe 单元格着色有限，**不依赖**——只用单色表格
- `get_order_timeline` 结果 → `cl.Dataframe(data=pd.DataFrame(...), display="inline", name="timeline")`
  - 列：阶段 / 日期 / 状态 / 说明

**依赖**：需要 `pandas`（项目当前没列在 pyproject，会一并加入 dev/runtime）

**原则**：tool 返回值仍为 dict（保持 LLM 上下文与测试兼容），elements 是表现层。

### 2.3 TaskList（待办 / 风险行动）

**做法**：
- 单订单的 `next_action` → 拆为 `cl.Task` 列表（如"联系客户确认色样"、"同步销售评估交期"）
- 多订单风险扫描（`detect_order_risks`）→ 1 个 `cl.TaskList`，每个风险订单 1 个 `cl.Task`：
  - 标题：`{订单号} · {风险类型}`
  - 状态：高=FAILED、中=RUNNING、低=DONE（与风险等级反向映射，提醒优先处理）
- `cl.TaskList` 用 `await task_list.send()` 单独发送（不挂 message），让它显示在侧边

---

## 3. 现成 UI/功能开关（已确认选型 ✅）

### 3.1 配置文件开关（改 `.chainlit/config.toml`）—— 用户已勾选

| 项 | 改后值 | 效果 |
|---|---|---|
| `default_theme` | `"dark"` | 默认进深色主题 |
| `[features].speech_to_text` | `true` | 输入框出现麦克风按钮 |
| `[features].spontaneous_file_upload.enabled` | `true` | 拖入文件即可上传（无提示即传） |
| `[features].spontaneous_file_upload.accept` | `[".xlsx", ".csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"]` | 只接订单 Excel/CSV |
| `[features].spontaneous_file_upload.max_files` | `5` | 单次最多 5 个 |
| `[features].spontaneous_file_upload.max_size_mb` | `10` | 单文件 ≤ 10MB |
| `multi_modal` | `true` | （保持现状）配合文件上传 |

### 3.2 静态资源 —— 用户本次不启用

跳过 logo / favicon / login image，保持 Chainlit 默认。

### 3.3 代码层小开关 —— 用户已勾选

- `chainlit.md` 重写为项目欢迎页：项目名 + 1 段简介 + 示例查询清单 + 字段说明

---

## 4. 改动顺序

1. `pyproject.toml` —— 加 `pandas` 依赖
2. `app.py` —— 加 `call_model_stream` + `build_elements` + 改写 `on_message`（流式 + 挂 elements）+ 改 `on_chat_start`（avatar + chat settings 触发）
3. `.chainlit/config.toml` —— 按 3.1 表格补开关
4. `chainlit.md` —— 重写欢迎页
5. `public/` —— 跳过（用户未选 logo/favicon）
6. `tests/test_app_tools.py` —— 跑一次确认未破坏既有断言

---

## 5. 风险与回退

- **Streaming 中途断网**：`try/except` 包住 stream loop，失败时 `msg.update()` 把已收到的 token 显示出来，附一句"流式中断，以下是已收到内容"。
- **Pandas 未装**：依赖装不上的话，DataFrame 改成 Chainlit 原生 `cl.Text(name="orders", content=markdown_table, display="inline")` 自绘 markdown 表（不需要 pandas）。
- **TaskList send 后被新消息覆盖**：Chainlit 中 `TaskList` 是侧边独立元素，不会被覆盖，但每条消息都 send 一个会堆叠 → 解决：`cl.user_session` 里缓存 task_list，重复 send 时先清空旧任务。

---

## 6. 验证

- `uv run poe start` 跑起来
- 发 `列出所有订单` → 看是否出 DataFrame
- 发 `扫描今天有哪些订单有延期风险` → 看是否出 TaskList
- 发 `订单 BS-20260711-001 进度` → 看最终回答是否流式
- `uv run pytest tests/` —— 既有测试必须通过
