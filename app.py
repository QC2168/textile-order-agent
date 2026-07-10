"""
Chainlit Demo - 智能体外壳
接入 ModelScope 腾讯混元大模型 (Hy3)
"""
import chainlit as cl
import json
import os
from typing import Dict, List, Any
from openai import AsyncOpenAI

# ============ 初始化 ModelScope 客户端 ============
# 使用 ModelScope 腾讯混元 Hy3 模型
client = AsyncOpenAI(
    base_url="https://api-inference.modelscope.cn/v1",
    api_key="ms-688e0483-f717-4656-ad95-743e0fa9513f",  # ModelScope Token
)
MODEL_ID = "Tencent-Hunyuan/Hy3"  # ModelScope Model-Id


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
        {"role": "system", "content": "你是一个智能助手，由腾讯混元大模型驱动。"}
    ])

    # 发送欢迎消息
    await cl.Message(
        content="👋 欢迎使用 **智能体 Demo**！\n\n"
                "✅ **已接入腾讯混元 (Hy3)**\n"
                "直接发送消息开始对话~"
    ).send()


@cl.on_message
async def on_message(message: cl.Message):
    """
    处理用户消息 - 调用腾讯混元 Hy3 模型
    """
    # 获取对话历史
    messages = cl.user_session.get("messages", [])
    messages.append({"role": "user", "content": message.content})

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
            messages=messages,
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

    await msg.send()

    # 更新对话历史
    messages.append({"role": "assistant", "content": answer_buffer})
    cl.user_session.set("messages", messages)


# ============ 快捷操作按钮 ============
@cl.action_callback("clear_history")
async def on_clear_history(action):
    """清除历史记录"""
    cl.user_session.set("messages", [
        {"role": "system", "content": "你是一个智能助手，由腾讯混元大模型驱动。"}
    ])
    await cl.Message(content="🗑️ 对话历史已清除").send()
    await action.remove()


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
