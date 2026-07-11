"""
Chainlit Demo - 智能体外壳
接入 ModelScope 腾讯混元大模型 (Hy3)
"""
import chainlit as cl
import json
import os
import re
from typing import Dict, List, Any
from openai import AsyncOpenAI
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
    run_order_demo_flow,
    submit_recipe_for_review,
    update_production_status,
)
from colorbridge_visual import build_workflow_panel_props

# ============ 初始化 ModelScope 客户端 ============
# 使用 ModelScope 腾讯混元 Hy3 模型
client = AsyncOpenAI(
    base_url="https://api-inference.modelscope.cn/v1",
    api_key="ms-688e0483-f717-4656-ad95-743e0fa9513f",  # ModelScope Token
)
MODEL_ID = "Tencent-Hunyuan/Hy3"  # ModelScope Model-Id

SYSTEM_PROMPT = (
    "你是 ColorBridge 纺织印染调色协同助理。"
    "回答配方、历史订单、调参、色差、光源问题时，必须基于提供的历史匹配上下文。"
    "不要声称 AI 能自动给出绝对正确生产配方；只能给出基于历史订单、成功区间、相似差异和工艺经验的调整方向。"
    "最终方案必须由调色师小样验证和人工确认。"
)

COLORBRIDGE_KEYWORDS = (
    "颜色",
    "色差",
    "配方",
    "染",
    "面料",
    "棉",
    "涤纶",
    "锦纶",
    "腈纶",
    "雾霾蓝",
    "宝蓝",
    "黑色",
    "深紫",
    "历史",
    "订单",
    "光源",
    "D65",
    "TL84",
    "pH",
    "温度",
)


def should_use_colorbridge_context(content: str) -> bool:
    return any(keyword in content for keyword in COLORBRIDGE_KEYWORDS)


def wants_order_status(content: str) -> bool:
    return any(keyword in content for keyword in ("订单状态", "任务状态", "到哪", "怎么样", "查询订单", "查订单"))


def wants_order_list(content: str) -> bool:
    return any(keyword in content for keyword in ("订单列表", "任务列表", "有哪些订单", "有哪些任务", "今天有哪些"))


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
    if any(keyword in content for keyword in ("提交审核", "方案审核", "待审核")):
        outputs.append(format_task_order(submit_recipe_for_review(order_id)))
    if any(keyword in content for keyword in ("确认方案", "审核通过", "方案确认")):
        outputs.append(format_task_order(confirm_recipe(order_id)))
    if any(keyword in content for keyword in ("下发", "车间")):
        outputs.append(format_task_order(dispatch_to_workshop(order_id)))
    if "生产中" in content:
        outputs.append(format_task_order(update_production_status(order_id, "生产中")))
    if any(keyword in content for keyword in ("生产完成", "录入结果", "实际 Lab", "实际色差")):
        outputs.append(
            format_task_order(
                record_production_result(
                    order_id,
                    actual_lab={"l": 62.2, "a": -3.0, "b": -12.1},
                    actual_delta_e=parse_delta_e(content),
                    rft="回修" not in content and "失败" not in content,
                    customer_accepted="客户确认" in content or "客户已确认" in content,
                )
            )
        )
    if any(keyword in content for keyword in ("售后", "客诉", "复核")):
        create_after_sales_ticket(order_id, "客户复核", content)
        order = get_task_order(order_id)
        outputs.append(format_task_order(order) if order else "未找到任务订单。")
    if any(keyword in content for keyword in ("归档", "关闭订单", "结束订单")):
        outputs.append(format_task_order(close_order(order_id)))
    return "\n\n".join(outputs)


# ============ MCP 工具配置说明 ============
"""
【如何配置 MCP 工具】

1. 定义工具（OpenAI Function Calling 格式）:
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge",
            "description": "搜索知识库",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"]
            }
        }
    },
]

2. 执行工具函数:
async def execute_tool(tool_name: str, parameters: Dict[str, Any]) -> str:
    if tool_name == "search_knowledge":
        # 这里调用你的 MCP 服务器
        return f"搜索结果: {parameters.get('query')}"
    return "未知工具"

3. 在 call_llm() 中传入 tools 参数:
   response = await client.chat.completions.create(
       model=MODEL_ID,
       messages=messages,
       tools=TOOLS,        # <-- 添加这行
       tool_choice="auto", # <-- 添加这行
       stream=True,
   )

4. 处理 tool_calls 响应（参考之前版本代码）
"""


# ============ Chainlit 事件处理 ============

@cl.on_chat_start
async def on_chat_start():
    """聊天开始时的初始化"""
    # 初始化对话历史
    cl.user_session.set("messages", [
        {"role": "system", "content": SYSTEM_PROMPT}
    ])
    cl.user_session.set("active_order_id", None)

    # 发送欢迎消息
    await cl.Message(
        content="👋 欢迎使用 **ColorBridge 调色协同 Demo**！\n\n"
                "可以问：雾霾蓝棉针织怎么做、历史黑色涤纶配方、锦纶深紫如何降低偏深风险、宝蓝腈纶怎么减少色花。"
    ).send()


@cl.on_message
async def on_message(message: cl.Message):
    """
    处理用户消息 - 调用腾讯混元 Hy3 模型
    """
    # 获取对话历史
    messages = cl.user_session.get("messages", [])
    messages.append({"role": "user", "content": message.content})
    request_messages = list(messages)

    if should_use_colorbridge_context(message.content):
        @cl.step(name="🔎 ColorBridge 任务订单", type="tool")
        async def build_colorbridge_context():
            active_order_id = cl.user_session.get("active_order_id")
            if wants_order_list(message.content):
                cl.user_session.set("workflow_panel_props", None)
                return format_order_list(list_task_orders())
            if wants_order_status(message.content) and active_order_id:
                order = get_task_order(active_order_id)
                if order:
                    cl.user_session.set("workflow_panel_props", build_workflow_panel_props(order))
                return format_task_order(order) if order else "当前会话没有可查询的任务订单。"
            if active_order_id and any(
                keyword in message.content
                for keyword in (
                    "提交审核",
                    "方案审核",
                    "待审核",
                    "确认方案",
                    "审核通过",
                    "方案确认",
                    "下发",
                    "车间",
                    "生产中",
                    "生产完成",
                    "录入结果",
                    "实际 Lab",
                    "实际色差",
                    "售后",
                    "客诉",
                    "复核",
                    "归档",
                    "关闭订单",
                    "结束订单",
                )
            ):
                context = apply_order_actions(message.content, active_order_id)
                order = get_task_order(active_order_id)
                if order:
                    cl.user_session.set("workflow_panel_props", build_workflow_panel_props(order))
                return context

            order, context = run_order_demo_flow(message.content)
            cl.user_session.set("active_order_id", order["order_id"])
            cl.user_session.set("workflow_panel_props", build_workflow_panel_props(order))
            return context

        colorbridge_context = await build_colorbridge_context()
        request_messages.append(
            {
                "role": "system",
                "content": f"以下是确定性历史匹配和调参上下文，回答必须优先引用：\n{colorbridge_context}",
            }
        )

    # 创建消息对象用于流式输出
    msg = cl.Message(content="")

    # 思考过程暂存
    reasoning_buffer = ""
    answer_buffer = ""
    done_reasoning = False

    # ========== 调用 Hy3 模型 ==========
    @cl.step(name="🧠 腾讯混元思考中...", type="llm")
    async def call_llm():
        response = await client.chat.completions.create(
            model=MODEL_ID,
            messages=request_messages,
            stream=True,
            # TODO: 如需工具调用，取消下面注释并配置 TOOLS
            # tools=TOOLS,
            # tool_choice="auto",
        )
        return response

    stream = await call_llm()

    # 流式处理响应
    async for chunk in stream:
        if chunk.choices:
            delta = chunk.choices[0].delta

            # 处理推理过程 (reasoning_content)
            if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                reasoning_buffer += delta.reasoning_content

            # 处理最终答案 (content)
            if hasattr(delta, 'content') and delta.content:
                if not done_reasoning and reasoning_buffer:
                    # 第一次输出答案前，先显示思考过程
                    await msg.stream_token(f"🤔 **思考过程**:\n```\n{reasoning_buffer}\n```\n\n")
                    done_reasoning = True

                answer_buffer += delta.content
                await msg.stream_token(delta.content)

    # 如果没有检测到 reasoning_content，直接输出答案
    if not done_reasoning and answer_buffer:
        await msg.stream_token(answer_buffer)

    panel_props = cl.user_session.get("workflow_panel_props")
    if panel_props:
        msg.elements = [
            cl.CustomElement(
                name="RecipeWorkflowPanel",
                props=panel_props,
                display="side",
            )
        ]

    await msg.send()

    # 更新对话历史
    messages.append({"role": "assistant", "content": answer_buffer})
    cl.user_session.set("messages", messages)


# ============ 快捷操作按钮 ============
@cl.action_callback("clear_history")
async def on_clear_history(action):
    """清除历史记录"""
    cl.user_session.set("messages", [
        {"role": "system", "content": SYSTEM_PROMPT}
    ])
    cl.user_session.set("active_order_id", None)
    await cl.Message(content="🗑️ 对话历史已清除").send()
    await action.remove()


@cl.action_callback("confirm_visual_recipe")
async def on_confirm_visual_recipe(action):
    payload = getattr(action, "payload", {}) or {}
    order_id = payload.get("order_id") or cl.user_session.get("active_order_id")
    if not order_id:
        await cl.Message(content="当前没有可确认的任务订单。").send()
        return

    order = confirm_visual_recipe(
        order_id,
        {
            "source": "visual_panel",
            "variant_name": payload.get("variant_name", "当前调配方案"),
            "params": payload.get("params", {}),
            "predicted_lab": payload.get("predicted_lab"),
            "risk": payload.get("risk"),
        },
    )
    if not order:
        await cl.Message(content=f"未找到任务订单：{order_id}").send()
        return

    panel_props = build_workflow_panel_props(order)
    cl.user_session.set("active_order_id", order_id)
    cl.user_session.set("workflow_panel_props", panel_props)
    await cl.Message(
        content=f"已确认当前可视化方案，并写回任务订单 {order_id}。下一步可以说：下发车间。",
        elements=[
            cl.CustomElement(
                name="RecipeWorkflowPanel",
                props=panel_props,
                display="side",
            )
        ],
    ).send()


# ============ 聊天配置 ============
@cl.set_chat_profiles
async def chat_profile():
    """配置聊天模式"""
    return [
        cl.ChatProfile(
            name="💬 标准对话",
            markdown_description="腾讯混元 Hy3 标准对话模式",
            icon="https://cdn-icons-png.flaticon.com/512/4712/4712109.png"
        ),
    ]
