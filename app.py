"""
ColorBridge 色译通 — AI 调色协同智能体
接入 ModelScope 腾讯混元大模型 (Hy3)
"""
import chainlit as cl
import json
import os
import re
import wave
from typing import Dict, List, Any
from openai import AsyncOpenAI
from fastapi import Request
from dotenv import load_dotenv

# 加载 .env 环境变量
load_dotenv()
from colorbridge_orders import (
    close_order,
    confirm_recipe,
    confirm_visual_recipe,
    create_after_sales_ticket,
    dispatch_to_workshop,
    format_task_order,
    get_task_order,
    list_task_orders,
    record_production_result,
    reset_task_orders,
    run_order_demo_flow,
    submit_recipe_for_review,
    update_production_status,
)
from colorbridge_tuning import build_tuning_summary, format_tuning_summary
from colorbridge_visual import build_workflow_panel_props
import colorbridge_db

# ============ 初始化 LLM 客户端 ============
# 硅基流动 SiliconFlow — 免费模型 Qwen2.5-72B-Instruct
client = AsyncOpenAI(
    base_url="https://api.siliconflow.cn/v1",
    api_key=os.getenv("SILICONFLOW_API_KEY", "sk-syoflclmmwigadvevvdzanrdojhtaseyjfcjmprdwpjkopsa"),
)
MODEL_ID = "Qwen/Qwen2.5-72B-Instruct"

SYSTEM_PROMPT = (
    "你是 ColorBridge 纺织印染调色协同助理。"
    "回答配方、历史订单、调参、色差、光源问题时，必须基于提供的历史匹配上下文。"
    "不要声称 AI 能自动给出绝对正确生产配方；只能给出基于历史订单、成功区间、相似差异和工艺经验的调整方向。"
    "最终方案必须由调色师小样验证和人工确认。"
)

COLORBRIDGE_KEYWORDS = (
    "颜色", "色差", "配方", "染", "面料", "棉", "涤纶", "锦纶", "腈纶",
    "雾霾蓝", "宝蓝", "黑色", "深紫", "历史", "订单", "光源", "D65", "TL84", "pH", "温度",
)


def should_use_colorbridge_context(content: str) -> bool:
    return any(keyword in content for keyword in COLORBRIDGE_KEYWORDS)


def wants_order_status(content: str) -> bool:
    return any(kw in content for kw in ("订单状态", "任务状态", "到哪", "怎么样", "查询订单", "查订单"))


def wants_order_list(content: str) -> bool:
    return any(kw in content for kw in ("订单列表", "任务列表", "有哪些订单", "有哪些任务", "今天有哪些"))


def format_order_list(orders: list[dict]) -> str:
    if not orders:
        return "当前会话还没有任务订单。"
    lines = ["当前任务订单列表："]
    for order in orders:
        lines.append(
            f"- {order['order_id']}：{order['workflow_status']} / {order['summary']} / 风险 {order['predicted_risk']}"
        )
    return "\n".join(lines)


def parse_delta_e(content: str) -> float:
    match = re.search(r"(?:Delta\s*E|DE|色差)\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?)", content, re.IGNORECASE)
    return float(match.group(1)) if match else 0.8


def apply_order_actions(content: str, order_id: str) -> str:
    outputs = []
    if any(kw in content for kw in ("提交审核", "方案审核", "待审核")):
        outputs.append(format_task_order(submit_recipe_for_review(order_id)))
    if any(kw in content for kw in ("确认方案", "审核通过", "方案确认")):
        outputs.append(format_task_order(confirm_recipe(order_id)))
    if any(kw in content for kw in ("下发", "车间")):
        outputs.append(format_task_order(dispatch_to_workshop(order_id)))
    if "生产中" in content:
        outputs.append(format_task_order(update_production_status(order_id, "生产中")))
    if any(kw in content for kw in ("生产完成", "录入结果", "实际 Lab", "实际色差")):
        outputs.append(format_task_order(record_production_result(
            order_id,
            actual_lab={"l": 62.2, "a": -3.0, "b": -12.1},
            actual_delta_e=parse_delta_e(content),
            rft="回修" not in content and "失败" not in content,
            customer_accepted="客户确认" in content or "客户已确认" in content,
        )))
    if any(kw in content for kw in ("售后", "客诉", "复核")):
        create_after_sales_ticket(order_id, "客户复核", content)
        order = get_task_order(order_id)
        outputs.append(format_task_order(order) if order else "未找到任务订单。")
    if any(kw in content for kw in ("归档", "关闭订单", "结束订单")):
        outputs.append(format_task_order(close_order(order_id)))
    return "\n\n".join(outputs)


# ============ Chainlit 事件处理 ============

@cl.on_chat_start
async def on_chat_start():
    cl.user_session.set("messages", [{"role": "system", "content": SYSTEM_PROMPT}])
    cl.user_session.set("active_order_id", None)
    await cl.Message(content=(
        "**ColorBridge 色译通** 已就绪。\n\n"
        "描述你的调色需求，我会匹配历史批次并给出工艺建议。"
    )).send()


@cl.on_message
async def on_message(message: cl.Message):
    # 处理上传的文件附件
    file_context = ""
    if message.elements:
        for elem in message.elements:
            path = getattr(elem, "path", None)
            name = getattr(elem, "name", "未知文件")
            if path and os.path.isfile(path):
                ext = os.path.splitext(path)[1].lower()
                if ext in (".txt", ".csv", ".tsv", ".json", ".md", ".log", ".yaml", ".yml"):
                    try:
                        with open(path, "r", encoding="utf-8", errors="replace") as f:
                            content = f.read()
                        preview = content[:5000]
                        truncated = "（已截断）" if len(content) > 5000 else ""
                        file_context += f"\n\n【文件: {name}】\n{preview}{truncated}"
                    except Exception as e:
                        file_context += f"\n\n【文件: {name}】读取失败: {e}"
                elif ext in (".png", ".jpg", ".jpeg", ".bmp", ".webp"):
                    file_context += f"\n\n【图片: {name}】用户附带了一张图片。"
                else:
                    file_context += f"\n\n【文件: {name}】类型: {ext}"

    user_content = message.content + file_context if file_context else message.content
    messages = cl.user_session.get("messages", [])
    messages.append({"role": "user", "content": user_content})
    request_messages = list(messages)

    if should_use_colorbridge_context(message.content):
        @cl.step(name="ColorBridge 上下文", type="tool")
        async def build_context():
            active_order_id = cl.user_session.get("active_order_id")
            if wants_order_list(message.content):
                return format_order_list(list_task_orders())
            if wants_order_status(message.content) and active_order_id:
                order = get_task_order(active_order_id)
                return format_task_order(order) if order else "当前没有可查询的任务订单。"
            if active_order_id and any(kw in message.content for kw in (
                "提交审核", "方案审核", "待审核", "确认方案", "审核通过", "方案确认",
                "下发", "车间", "生产中", "生产完成", "录入结果", "实际 Lab", "实际色差",
                "售后", "客诉", "复核", "归档", "关闭订单", "结束订单",
            )):
                return apply_order_actions(message.content, active_order_id)
            reset_task_orders()
            order, context = run_order_demo_flow(message.content)
            cl.user_session.set("active_order_id", order["order_id"])
            return context

        ctx = await build_context()
        request_messages.append({
            "role": "system",
            "content": f"以下是确定性历史匹配和调参上下文，回答必须优先引用：\n{ctx}",
        })

    msg = cl.Message(content="")
    reasoning_buffer = ""
    answer_buffer = ""
    done_reasoning = False

    @cl.step(name="AI 推理", type="llm")
    async def call_llm():
        return await client.chat.completions.create(
            model=MODEL_ID, messages=request_messages, stream=True,
        )

    stream = await call_llm()
    async for chunk in stream:
        if chunk.choices:
            delta = chunk.choices[0].delta
            if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                reasoning_buffer += delta.reasoning_content
            if hasattr(delta, 'content') and delta.content:
                if not done_reasoning and reasoning_buffer:
                    await msg.stream_token(
                        f"<details><summary>推理过程</summary>\n\n{reasoning_buffer}\n\n</details>\n\n"
                    )
                    done_reasoning = True
                answer_buffer += delta.content
                await msg.stream_token(delta.content)

    if not done_reasoning and answer_buffer:
        await msg.stream_token(answer_buffer)
    await msg.send()

    messages.append({"role": "assistant", "content": answer_buffer})
    cl.user_session.set("messages", messages)


# ============ 语音输入 ============

@cl.on_audio_start
async def on_audio_start():
    cl.user_session.set("audio_chunks", [])
    return True


@cl.on_audio_chunk
async def on_audio_chunk(chunk):
    chunks = cl.user_session.get("audio_chunks", [])
    chunks.append(chunk.data if hasattr(chunk, "data") else chunk)
    cl.user_session.set("audio_chunks", chunks)


@cl.on_audio_end
async def on_audio_end():
    chunks = cl.user_session.get("audio_chunks", [])
    if not chunks:
        await cl.Message(content="未收到音频数据，请重试。").send()
        return

    pcm_data = b"".join(chunks)
    audio_dir = os.path.join(os.path.dirname(__file__), ".audio_cache")
    os.makedirs(audio_dir, exist_ok=True)
    audio_path = os.path.join(audio_dir, "latest_audio.wav")
    with wave.open(audio_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(pcm_data)

    api_key = os.getenv("SILICONFLOW_API_KEY", "")
    if not api_key:
        await cl.Message(content="未配置 SILICONFLOW_API_KEY，无法语音识别。").send()
        return

    try:
        stt_client = AsyncOpenAI(base_url="https://api.siliconflow.cn/v1", api_key=api_key)
        with open(audio_path, "rb") as f:
            transcription = await stt_client.audio.transcriptions.create(
                model="FunAudioLLM/SenseVoiceSmall", file=f, language="zh",
            )
        text = transcription.text.strip()
        if not text:
            await cl.Message(content="语音识别结果为空，请重试。").send()
            return
        await cl.Message(content=f"[语音识别] {text}").send()
        await on_message(cl.Message(content=text))
    except Exception as e:
        await cl.Message(content=f"语音识别失败: {e}").send()


# ============ FastAPI 路由（供 Next.js 前端调用）============

@cl.on_chat_start
async def _noop():
    pass  # Chainlit 要求 on_chat_start，已在上面定义


from chainlit.server import app as chainlit_app


# ============ Function Calling 工具定义 ============
WORKFLOW_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_historical_batches",
            "description": "根据面料、颜色、染料体系从数据库查询相似历史生产批次。返回批次的染料配方、工艺参数、色差结果和风险评估。",
            "parameters": {
                "type": "object",
                "properties": {
                    "fabric": {"type": "string", "description": "面料关键词，如'纯棉针织'、'涤纶四面弹'、'锦纶塔丝隆'"},
                    "color_name": {"type": "string", "description": "颜色名称，如'雾霾蓝'、'黑色'、'深紫'、'宝蓝'"},
                    "dye_type": {"type": "string", "description": "染料体系", "enum": ["活性染料", "分散染料", "酸性染料", "阳离子染料"]},
                },
                "required": ["color_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "extract_intent",
            "description": "从客户需求文本中提取结构化的调色意图信息，包括意图类型、面料、颜色、染料体系和目标Lab色值。",
            "parameters": {
                "type": "object",
                "properties": {
                    "intent_type": {"type": "string", "enum": ["方案生成", "历史查询", "模拟调参", "风险预警"]},
                    "fabric": {"type": "string", "description": "面料名称"},
                    "color_name": {"type": "string", "description": "颜色名称"},
                    "dye_type": {"type": "string", "enum": ["活性染料", "分散染料", "酸性染料", "阳离子染料"]},
                    "target_lab_l": {"type": "number", "description": "目标Lab的L值（明度0-100）"},
                    "target_lab_a": {"type": "number", "description": "目标Lab的a值（红绿-60到60）"},
                    "target_lab_b": {"type": "number", "description": "目标Lab的b值（黄蓝-60到60）"},
                    "confidence": {"type": "number", "description": "置信度0-1"},
                    "analysis": {"type": "string", "description": "简要分析，说明关键风险和注意事项"},
                },
                "required": ["intent_type", "fabric", "color_name", "dye_type"],
            },
        },
    },
]


def execute_tool(name: str, args: dict) -> str:
    """执行工具调用并返回结果"""
    if name == "search_historical_batches":
        batches = colorbridge_db.get_historical_batches(
            fabric=args.get("fabric", ""),
            color_name=args.get("color_name", ""),
            dye_type=args.get("dye_type", ""),
        )
        if not batches:
            return json.dumps({"result": "未找到匹配的历史批次", "count": 0}, ensure_ascii=False)
        # 返回前5个最相关的（按delta_e排序，越小越好）
        top = sorted(batches, key=lambda b: b["delta_e"])[:5]
        return json.dumps({"result": "查询成功", "count": len(batches), "batches": top}, ensure_ascii=False, default=str)
    elif name == "extract_intent":
        return json.dumps({"result": "意图提取成功", "intent": args}, ensure_ascii=False)
    return json.dumps({"error": f"unknown tool: {name}"})


import asyncio

@chainlit_app.post("/api/workflow/analyze")
async def api_analyze(request: Request):
    """用 LLM + Function Calling 分析调色需求"""
    import time
    start = time.time()
    body = await request.json()
    text = body.get("text", "").strip()
    if not text:
        return {"error": "text is required"}

    ai_intent = None
    llm_used = False
    llm_error = None
    tool_results = []

    try:
        # 第一轮：带工具的 LLM 调用
        messages = [
            {"role": "system", "content": "你是纺织印染调色专家。根据客户需求，使用工具提取意图和查询历史批次。"},
            {"role": "user", "content": f"客户需求：{text}"},
        ]
        llm_resp = await client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            tools=WORKFLOW_TOOLS,
            tool_choice="auto",
            stream=False,
            temperature=0.3,
        )

        # 处理工具调用
        tool_results = []
        msg = llm_resp.choices[0].message
        if msg.tool_calls:
            messages.append(msg)
            for tc in msg.tool_calls:
                args = json.loads(tc.function.arguments) if tc.function.arguments else {}
                result = execute_tool(tc.function.name, args)
                tool_results.append({"name": tc.function.name, "args": args, "result": json.loads(result)})
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

            # 第二轮：让 LLM 基于工具结果生成最终分析
            final_resp = await client.chat.completions.create(
                model=MODEL_ID,
                messages=messages + [
                    {"role": "user", "content": "请基于以上工具返回的结果，总结分析。如果extract_intent被调用了，直接使用其参数。返回JSON格式：{intent_type, fabric, color_name, dye_type, target_lab: {l,a,b}, confidence, analysis}"},
                ],
                stream=False,
                temperature=0.3,
            )
            raw = final_resp.choices[0].message.content or "{}"
        else:
            raw = msg.content or "{}"

        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]
        ai_intent = json.loads(raw)
        llm_used = True
    except Exception as e:
        llm_error = str(e)

    # 创建订单（规则匹配保底）
    reset_task_orders()
    order, context = run_order_demo_flow(text)

    # 用 LLM 结果覆盖
    if ai_intent:
        order["intent"]["intent_type"] = ai_intent.get("intent_type", order["intent"]["intent_type"])
        order["intent"]["fabric"] = ai_intent.get("fabric", order["intent"]["fabric"])
        order["intent"]["color_name"] = ai_intent.get("color_name", order["intent"]["color_name"])
        order["intent"]["dye_type"] = ai_intent.get("dye_type", order["intent"]["dye_type"])
        if "target_lab" in ai_intent and isinstance(ai_intent["target_lab"], dict):
            order["intent"]["target_lab"] = ai_intent["target_lab"]
        elif all(k in ai_intent for k in ("target_lab_l", "target_lab_a", "target_lab_b")):
            order["intent"]["target_lab"] = {"l": ai_intent["target_lab_l"], "a": ai_intent["target_lab_a"], "b": ai_intent["target_lab_b"]}
        if "confidence" in ai_intent:
            order["intent"]["confidence"] = float(ai_intent["confidence"])
        order["ai_analysis"] = ai_intent.get("analysis", "")

    # 确保最低 3 秒
    elapsed = time.time() - start
    if elapsed < 3.0:
        await asyncio.sleep(3.0 - elapsed)

    return {
        "order": order,
        "context": context,
        "llm_used": llm_used,
        "llm_error": llm_error,
        "elapsed": round(time.time() - start, 2),
        "tool_calls": tool_results,
    }


@chainlit_app.post("/api/workflow/action")
async def api_action(request: Request):
    """执行订单操作（审核、确认、下发等）"""
    body = await request.json()
    action = body.get("action", "")
    order_id = body.get("order_id", "")

    if not order_id:
        return {"error": "order_id is required"}

    order = get_task_order(order_id)
    if not order:
        return {"error": "order not found"}

    if action == "submit_review":
        order = submit_recipe_for_review(order_id)
    elif action == "confirm":
        order = confirm_recipe(order_id)
        if order:
            colorbridge_db.save_order(order)
    elif action == "dispatch":
        order = dispatch_to_workshop(order_id)
        if order:
            colorbridge_db.save_order(order)
    elif action == "production":
        order = update_production_status(order_id, "生产中")
    elif action == "record_result":
        order = record_production_result(
            order_id,
            actual_lab=body.get("actual_lab", {"l": 62.2, "a": -3.0, "b": -12.1}),
            actual_delta_e=body.get("actual_delta_e", 0.8),
            rft=body.get("rft", True),
            customer_accepted=body.get("customer_accepted"),
        )
        if order:
            colorbridge_db.save_order(order)
    elif action == "after_sales":
        create_after_sales_ticket(order_id, "客户复核", body.get("description", ""))
        order = get_task_order(order_id)
    elif action == "close":
        order = close_order(order_id)
        if order:
            colorbridge_db.save_order(order)
    elif action == "confirm_visual":
        order = confirm_visual_recipe(order_id, {
            "source": "web_workflow",
            "variant_name": body.get("variant_name", "当前方案"),
            "params": body.get("params", {}),
            "predicted_lab": body.get("predicted_lab"),
            "risk": body.get("risk"),
        })
        if order:
            colorbridge_db.save_order(order)
            for rc in order.get("recipe_cards", []):
                colorbridge_db.save_recipe(rc)
    else:
        return {"error": f"unknown action: {action}"}

    if not order:
        return {"error": "action failed"}

    return {
        "order": order,
        "panel_props": build_workflow_panel_props(order),
    }


@chainlit_app.get("/api/workflow/orders")
async def api_list_orders():
    """列出所有任务订单（内存 + 数据库）"""
    mem_orders = list_task_orders()
    db_orders = colorbridge_db.list_orders(limit=20)
    return {"orders": mem_orders, "db_orders": db_orders}


@chainlit_app.get("/api/workflow/order/{order_id}")
async def api_get_order(order_id: str):
    """查询单个订单（先内存后数据库）"""
    order = get_task_order(order_id)
    if not order:
        order = colorbridge_db.get_order(order_id)
    if not order:
        return {"error": "order not found"}
    return {"order": order}


@chainlit_app.get("/api/workflow/historical")
async def api_historical(fabric: str = "", color_name: str = "", dye_type: str = ""):
    """从数据库查询历史批次"""
    batches = colorbridge_db.get_historical_batches(fabric=fabric, color_name=color_name, dye_type=dye_type)
    return {"batches": batches}


@chainlit_app.post("/api/workflow/chat")
async def api_chat(request: Request):
    """AI 聊天接口"""
    body = await request.json()
    text = body.get("text", "").strip()
    history = body.get("history", [])

    if not text:
        return {"error": "text is required"}

    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history + [{"role": "user", "content": text}]

    # 如果是调色相关问题，注入上下文
    if should_use_colorbridge_context(text):
        active_orders = list_task_orders()
        if active_orders:
            order = active_orders[-1]
            ctx = format_task_order(order)
        else:
            reset_task_orders()
            order, ctx = run_order_demo_flow(text)

        messages.append({
            "role": "system",
            "content": f"以下是确定性历史匹配和调参上下文，回答必须优先引用：\n{ctx}",
        })

    response = await client.chat.completions.create(
        model=MODEL_ID, messages=messages, stream=False,
    )
    answer = response.choices[0].message.content or ""
    return {"answer": answer}
