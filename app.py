"""
Chainlit Demo - ColorBridge 调色智能体
通过 DATABASE_URL 连接远程 PostgreSQL，与 Next.js 前端共用同一数据库
"""
import chainlit as cl
import html
import json
import os
import re
from typing import Any
from dotenv import load_dotenv

load_dotenv()

import pandas as pd
from openai import AsyncOpenAI
from database import (
    get_order,
    list_orders,
    create_order as db_create_order,
    update_order as db_update_order,
    delete_order as db_delete_order,
    get_all_orders,
    get_analysis,
    get_sample_attempts,
    get_trace_events,
    get_historical_cases,
)

# ============ 模型配置（从 .env 读取） ============
client = AsyncOpenAI(
    base_url=os.getenv("MODEL_BASE_URL", "https://api.deepseek.com"),
    api_key=os.getenv("MODEL_API_KEY", ""),
)
MODEL_ID = os.getenv("MODEL_ID", "deepseek-chat")

# ============ ColorBridge 调色 Agent 配置 ============
SYSTEM_PROMPT = """
你是 ColorBridge 调色协同助理，帮助调色师管理客户需求、AI 分析、历史案例匹配和打样对比。

约束：
- 查询客户需求、分析结果、案例或打样前必须使用工具结果。
- 不得凭空编造客户需求、Lab 值、Delta E 或历史案例。
- 回复必须结论优先，再给依据。
- Delta E 超标时给出原因分析和建议动作。
- 话术必须克制、专业，可直接发送给客户。
- 对数据库之外的问题，说明当前 Demo 只覆盖已录入的调色需求。
"""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_color_order",
            "description": "查询单个调色需求详情，含客户输入、状态、确认字段、选中案例/样版。",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "string", "description": "ColorOrder ID（cuid 格式）"}},
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_timeline",
            "description": "查询调色需求的追溯事件时间线（TraceEvent）。",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "string", "description": "ColorOrder ID"}},
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_analysis",
            "description": "查询 AI 结构化分析结果（extractedJson、missingFields、confidence）。",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "string", "description": "ColorOrder ID"}},
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sample_attempts",
            "description": "查询打样记录，含版本、Lab 值、Delta E、是否通过、偏差说明。",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "string", "description": "ColorOrder ID"}},
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_historical_cases",
            "description": "查询所有历史参考案例，含面料、基布、Lab、相似原因、风险提示。",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_order_status",
            "description": "按状态扫描异常需求（如 analysis_failed、sample_failed）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "状态过滤，如 sample_failed / analysis_failed"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "preview_color",
            "description": "生成演示用颜色预览色块。仅根据用户输入中的常见颜色词返回近似 hex，不生成 Lab 或真实调色配方。",
            "parameters": {
                "type": "object",
                "properties": {
                    "color": {"type": "string", "description": "用户想预览的颜色描述，如蓝色、深红、浅绿"},
                },
                "required": ["color"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_color_order",
            "description": "创建新的调色需求。",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_input": {"type": "string", "description": "客户原始需求描述"},
                    "customer_name": {"type": "string", "description": "客户名称"},
                    "requested_color": {"type": "string", "description": "目标颜色描述"},
                },
                "required": ["customer_input"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_color_order",
            "description": "更新调色需求字段。",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string", "description": "ColorOrder ID"},
                    "status": {"type": "string", "description": "状态：requirements_loaded/analysis_ready/requirements_confirmed/sample_ready/sample_passed/sample_failed/analysis_failed"},
                    "customer_name": {"type": "string", "description": "客户名称"},
                    "production_material": {"type": "string", "description": "生产材质"},
                    "base_cloth": {"type": "string", "description": "基布类型"},
                    "dye_type": {"type": "string", "description": "染料类型"},
                },
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_color_order",
            "description": "删除指定调色需求及其关联数据。",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "string", "description": "ColorOrder ID"}},
                "required": ["order_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_color_orders",
            "description": "列出所有调色需求，支持按状态过滤。",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "按状态过滤"},
                    "limit": {"type": "integer", "description": "返回数量限制，默认 100"},
                },
            },
        },
    },
]


def _not_found(order_id: str) -> dict[str, Any]:
    return {"found": False, "order_id": order_id, "error": "当前数据库未找到该调色需求"}


def _parse_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    return value


def _json_default(obj: Any) -> str:
    """JSON 序列化 fallback：datetime → isoformat，其他 → str"""
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return str(obj)


def _to_str(value: Any, default: str = "") -> str:
    """安全转字符串，datetime 对象转 isoformat"""
    if value is None:
        return default
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _order_summary(order: dict[str, Any]) -> dict[str, Any]:
    confirmed = _parse_json(order.get("confirmedFields"))
    return {
        "found": True,
        "order_id": order["id"],
        "task_no": order.get("taskNo"),
        "customer_name": order.get("customerName", ""),
        "customer_input": order.get("customerInput", ""),
        "requested_color": order.get("requestedColor"),
        "color_intent": order.get("colorIntent"),
        "production_material": order.get("productionMaterial"),
        "base_cloth": order.get("baseCloth"),
        "dye_type": order.get("dyeType"),
        "status": order.get("status", ""),
        "confirmed_fields": confirmed,
        "selected_case_id": order.get("selectedCaseId"),
        "selected_sample_id": order.get("selectedSampleId"),
        "created_at": _to_str(order.get("createdAt")),
    }


def get_color_order(order_id: str) -> dict[str, Any]:
    order = get_order(order_id)
    if not order:
        return _not_found(order_id)
    return _order_summary(order)


def get_order_timeline(order_id: str) -> dict[str, Any]:
    order = get_order(order_id)
    if not order:
        return _not_found(order_id)
    events = get_trace_events(order_id)
    timeline = [
        {
            "label": e["label"],
            "detail": e["detail"],
            "actor": e.get("actor", ""),
            "event_type": e.get("eventType", ""),
            "created_at": _to_str(e.get("createdAt")),
        }
        for e in events
    ]
    return {"found": True, "order_id": order_id, "timeline": timeline}


def get_analysis_result(order_id: str) -> dict[str, Any]:
    order = get_order(order_id)
    if not order:
        return _not_found(order_id)
    analysis = get_analysis(order_id)
    if not analysis:
        return {"found": True, "order_id": order_id, "analysis": None, "note": "该需求尚无 AI 分析结果"}
    extracted = _parse_json(analysis.get("extractedJson"))
    missing = _parse_json(analysis.get("missingFields"))
    return {
        "found": True,
        "order_id": order_id,
        "analysis": {
            "extracted_json": extracted,
            "missing_fields": missing,
            "confidence": analysis.get("confidence"),
            "source": analysis.get("source"),
        },
    }


def get_samples(order_id: str) -> dict[str, Any]:
    order = get_order(order_id)
    if not order:
        return _not_found(order_id)
    attempts = get_sample_attempts(order_id)
    samples = [
        {
            "id": s["id"],
            "version": s["version"],
            "scheme_name": s.get("schemeName", ""),
            "lab": _parse_json(s.get("lab")),
            "target_lab": _parse_json(s.get("targetLab")),
            "delta_e": s.get("deltaE"),
            "passed": bool(s.get("passed")),
            "deviation": s.get("deviation", ""),
            "recommendation": s.get("recommendation", ""),
            "selected": bool(s.get("selected")),
        }
        for s in attempts
    ]
    return {"found": True, "order_id": order_id, "sample_attempts": samples}


def get_cases() -> dict[str, Any]:
    cases = get_historical_cases()
    return {
        "found": True,
        "historical_cases": [
            {
                "id": c["id"],
                "name": c["name"],
                "fabric": c["fabric"],
                "base_cloth": c.get("baseCloth", ""),
                "dye_type": c.get("dyeType"),
                "lab": _parse_json(c.get("lab")),
                "similarity_reason": c.get("similarityReason", ""),
                "risk_note": c.get("riskNote", ""),
                "similarity_score": c.get("similarityScore"),
            }
            for c in cases
        ],
    }


_DEMO_COLOR_HEXES = [
    (("深蓝", "藏青", "navy"), "#1d4ed8"),
    (("浅蓝", "天蓝", "sky blue"), "#93c5fd"),
    (("蓝", "blue"), "#2563eb"),
    (("深红", "酒红"), "#991b1b"),
    (("红", "red"), "#dc2626"),
    (("浅绿",), "#86efac"),
    (("绿", "green"), "#16a34a"),
    (("黄", "yellow"), "#facc15"),
    (("橙", "orange"), "#f97316"),
    (("紫", "purple"), "#7c3aed"),
    (("粉", "pink"), "#ec4899"),
    (("黑", "black"), "#111827"),
    (("白", "white"), "#f8fafc"),
    (("灰", "gray", "grey"), "#64748b"),
    (("棕", "brown"), "#92400e"),
    (("青", "cyan"), "#06b6d4"),
]


def _demo_color_hex(color: str) -> str:
    text = color.lower()
    for keywords, hex_value in _DEMO_COLOR_HEXES:
        if any(keyword in text for keyword in keywords):
            return hex_value
    return "#94a3b8"


def _color_preview_svg(color: str, hex_value: str) -> str:
    label = html.escape(color.strip() or "颜色预览")
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="180" viewBox="0 0 520 180">'
        '<rect width="520" height="180" rx="8" fill="#ffffff"/>'
        f'<rect x="24" y="24" width="156" height="132" rx="8" fill="{hex_value}"/>'
        '<rect x="24" y="24" width="156" height="132" rx="8" fill="none" stroke="#d1d5db"/>'
        '<text x="204" y="74" fill="#111827" font-family="Arial, sans-serif" font-size="24" font-weight="700">'
        f'{label}</text>'
        '<text x="204" y="112" fill="#374151" font-family="Arial, sans-serif" font-size="20">'
        f'{hex_value}</text>'
        '<text x="204" y="142" fill="#6b7280" font-family="Arial, sans-serif" font-size="14">'
        'Demo preview, not Lab-calibrated</text>'
        '</svg>'
    )


def preview_color(color: str) -> dict[str, Any]:
    clean = (color or "").strip() or "颜色预览"
    hex_value = _demo_color_hex(clean)
    return {
        "found": True,
        "color": clean,
        "hex": hex_value,
        "note": "演示色块，仅按常见颜色词生成近似 hex，不代表 Lab 标定或真实调色配方。",
        "svg": _color_preview_svg(clean, hex_value),
    }


_STATUS_LABELS: dict[str, str] = {
    "requirements_loaded": "需求已录入",
    "analysis_ready": "AI 分析完成",
    "analysis_failed": "AI 分析失败",
    "requirements_confirmed": "需求已确认",
    "history_matched": "历史案例已匹配",
    "sample_ready": "打样达标待采用",
    "sample_failed": "打样未达标",
    "sample_passed": "样版已锁定",
    "chat_loaded": "演示已载入",
    "fallback": "缓存模式",
}

_ABNORMAL_STATUSES = {"analysis_failed", "sample_failed"}


def check_order_status(status: str | None = None) -> dict[str, Any]:
    if status:
        orders = list_orders(status=status)
    else:
        orders = [o for o in get_all_orders() if o.get("status") in _ABNORMAL_STATUSES]
    return {
        "found": True,
        "scope": "all" if not status else f"status:{status}",
        "issues": [
            {
                "order_id": o["id"],
                "customer_name": o.get("customerName", ""),
                "status": o.get("status", ""),
                "status_label": _STATUS_LABELS.get(o.get("status", ""), o.get("status", "")),
                "customer_input": (o.get("customerInput", "") or "")[:80],
                "created_at": _to_str(o.get("createdAt")),
            }
            for o in orders
        ],
    }


def execute_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if tool_name == "get_color_order":
        return get_color_order(arguments.get("order_id", ""))
    if tool_name == "get_order_timeline":
        return get_order_timeline(arguments.get("order_id", ""))
    if tool_name == "get_analysis":
        return get_analysis_result(arguments.get("order_id", ""))
    if tool_name == "get_sample_attempts":
        return get_samples(arguments.get("order_id", ""))
    if tool_name == "get_historical_cases":
        return get_cases()
    if tool_name == "check_order_status":
        return check_order_status(arguments.get("status"))
    if tool_name == "preview_color":
        return preview_color(arguments.get("color", ""))
    if tool_name == "create_color_order":
        return db_create_order(
            customer_input=arguments["customer_input"],
            customer_name=arguments.get("customer_name", "默认客户"),
            requested_color=arguments.get("requested_color", ""),
        )
    if tool_name == "update_color_order":
        order_id = arguments.pop("order_id", None)
        if not order_id:
            return {"success": False, "error": "缺少 order_id 参数"}
        field_map = {
            "customer_name": "customerName",
            "production_material": "productionMaterial",
            "base_cloth": "baseCloth",
            "dye_type": "dyeType",
        }
        mapped = {field_map.get(k, k): v for k, v in arguments.items()}
        return db_update_order(order_id, mapped)
    if tool_name == "delete_color_order":
        return db_delete_order(arguments.get("order_id", ""))
    if tool_name == "list_color_orders":
        orders = list_orders(
            status=arguments.get("status"),
            limit=arguments.get("limit", 100),
        )
        summaries = [_order_summary(o) for o in orders]
        return {"found": True, "count": len(summaries), "orders": summaries}
    return {"found": False, "error": f"未知工具: {tool_name}"}


_TOOL_NAMES = {tool["function"]["name"] for tool in TOOLS}
_ORDER_ID_REQUIRED_TOOLS = {
    "get_color_order",
    "get_order_timeline",
    "get_analysis",
    "get_sample_attempts",
}


def parse_text_tool_calls(content: str | None) -> list[dict[str, Any]]:
    if not content:
        return []
    matches = list(re.finditer(r"invoke\s+name=[\"']([^\"']+)[\"']", content))
    calls: list[dict[str, Any]] = []
    for index, match in enumerate(matches):
        name = match.group(1)
        if name not in _TOOL_NAMES:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        json_match = re.search(r"\{.*?\}", content[match.end():end], re.DOTALL)
        arguments = {}
        if json_match:
            parsed = _parse_json(json_match.group(0))
            if isinstance(parsed, dict):
                arguments = parsed
        for param_match in re.finditer(r"<[^<>]*parameter\s+([^>]*)>(.*?)</[^<>]*parameter>", content[match.end():end], re.DOTALL):
            attrs, raw_value = param_match.groups()
            name_match = re.search(r"name=[\"']([^\"']+)[\"']", attrs)
            if not name_match:
                continue
            value = html.unescape(raw_value.strip())
            arguments[name_match.group(1)] = value if re.search(r"string=[\"']true[\"']", attrs) else _parse_json(value)
        calls.append({"name": name, "arguments": arguments})
    return calls


def complete_tool_arguments(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    completed = dict(arguments)
    if tool_name in _ORDER_ID_REQUIRED_TOOLS and not completed.get("order_id"):
        orders = list_orders(limit=2)
        if len(orders) == 1:
            completed["order_id"] = orders[0]["id"]
    return completed


def route_demo_tools(content: str) -> list[dict[str, Any]]:
    """规则 fallback：按关键词匹配工具，不依赖大模型 tool_call"""
    id_match = re.search(r"[a-z0-9\-]{20,40}", content)
    order_id = id_match.group(0) if id_match else None

    if any(w in content for w in ["生成", "预览", "显示", "展示", "色块"]) and any(w in content for w in ["色", "蓝", "红", "绿", "黄", "黑", "白", "紫", "粉", "橙", "灰", "棕", "青"]):
        return [{"name": "preview_color", "arguments": {"color": content}}]
    if any(w in content for w in ["分析", "提取", "AI", "confidence"]):
        return [{"name": "get_analysis", "arguments": {"order_id": order_id} if order_id else {}}]
    if any(w in content for w in ["案例", "历史", "参考", "相似"]):
        return [{"name": "get_historical_cases", "arguments": {}}]
    if any(w in content for w in ["打样", "Delta E", "色差", "样品", "样版", "sample"]):
        return [{"name": "get_sample_attempts", "arguments": {"order_id": order_id} if order_id else {}}]
    if any(w in content for w in ["追溯", "时间线", "进度", "流程", "trace"]):
        return [{"name": "get_order_timeline", "arguments": {"order_id": order_id} if order_id else {}}]
    if any(w in content for w in ["异常", "失败", "问题", "扫描", "状态"]):
        return [{"name": "check_order_status", "arguments": {}}]
    if any(w in content for w in ["列出", "所有", "全部", "列表"]):
        return [{"name": "list_color_orders", "arguments": {}}]
    if order_id:
        return [{"name": "get_color_order", "arguments": {"order_id": order_id}}]
    return []


async def call_model(messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None):
    kwargs = {"model": MODEL_ID, "messages": messages}
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    return await client.chat.completions.create(**kwargs)


# ============ Chainlit Elements 构建 ============

def _orders_to_dataframe(orders: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame([
        {
            "订单ID": o["order_id"][:12] + "…",
            "客户": o["customer_name"],
            "状态": _STATUS_LABELS.get(o.get("status", ""), o.get("status", "")),
            "目标色": (o.get("requested_color") or (o.get("customer_input", "") or "")[:30]),
            "创建时间": (o.get("created_at", "") or "")[:19],
        }
        for o in orders
    ])


def _timeline_to_dataframe(timeline: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame([
        {
            "时间": e["created_at"][:19] if e.get("created_at") else "-",
            "事件": e["label"],
            "详情": e["detail"],
            "操作人": e.get("actor", ""),
        }
        for e in timeline
    ])


def _samples_to_dataframe(samples: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame([
        {
            "版本": s["version"],
            "Delta E": s["delta_e"],
            "通过": "✅" if s["passed"] else "❌",
            "偏差说明": s["deviation"],
        }
        for s in samples
    ])


def build_elements(tool_results: list[dict[str, Any]]) -> list:
    elements: list = []
    for item in tool_results:
        tool = item["tool"]
        result = item["result"]
        if not result.get("found", True):
            continue
        if tool == "list_color_orders":
            elements.append(cl.Dataframe(
                data=_orders_to_dataframe(result["orders"]),
                display="inline", name="orders",
            ))
        elif tool == "get_order_timeline":
            elements.append(cl.Dataframe(
                data=_timeline_to_dataframe(result["timeline"]),
                display="inline", name=f"timeline-{result['order_id']}",
            ))
        elif tool == "get_sample_attempts":
            elements.append(cl.Dataframe(
                data=_samples_to_dataframe(result["sample_attempts"]),
                display="inline", name=f"samples-{result['order_id']}",
            ))
        elif tool == "preview_color":
            elements.append(cl.Image(
                content=result["svg"].encode("utf-8"),
                display="inline", name=f"color-preview-{result['hex']}",
                mime="image/svg+xml", thread_id="",
            ))
    return elements


_STATUS_TO_TASK = {
    "analysis_failed": cl.TaskStatus.FAILED,
    "sample_failed": cl.TaskStatus.FAILED,
    "requirements_loaded": cl.TaskStatus.RUNNING,
    "analysis_ready": cl.TaskStatus.RUNNING,
    "requirements_confirmed": cl.TaskStatus.DONE,
    "sample_ready": cl.TaskStatus.DONE,
    "sample_passed": cl.TaskStatus.DONE,
}


def build_task_list(tool_results: list[dict[str, Any]]) -> cl.TaskList | None:
    tasks: list[cl.Task] = []
    for item in tool_results:
        tool = item["tool"]
        result = item["result"]
        if not result.get("found", True):
            continue
        if tool == "check_order_status":
            for issue in result.get("issues", []):
                tasks.append(cl.Task(
                    title=f"{issue['order_id'][:12]}… {issue['status_label']}",
                    status=_STATUS_TO_TASK.get(issue["status"], cl.TaskStatus.READY),
                ))
        elif tool == "get_color_order":
            status = result.get("status", "")
            tasks.append(cl.Task(
                title=f"{result['order_id'][:12]}… {_STATUS_LABELS.get(status, status)}",
                status=_STATUS_TO_TASK.get(status, cl.TaskStatus.READY),
            ))
    if not tasks:
        return None
    task_list = cl.TaskList()
    task_list.status = "Ready"
    task_list.tasks = tasks
    return task_list


def _assistant_tool_message(message: Any) -> dict[str, Any]:
    if hasattr(message, "model_dump"):
        return message.model_dump(exclude_none=True)
    return {"role": "assistant", "content": getattr(message, "content", "")}


def _tool_context_message(tool_results: list[dict[str, Any]]) -> dict[str, str]:
    return {
        "role": "system",
        "content": "以下是本地调色工具返回结果，请只基于这些结果回答：\n"
        + json.dumps(tool_results, ensure_ascii=False, indent=2, default=_json_default),
    }


def format_fallback_answer(tool_results: list[dict[str, Any]]) -> str:
    parts = ["当前使用本地调色数据生成建议，结果仅供业务参考。\n"]
    for item in tool_results:
        tool = item["tool"]
        result = item["result"]
        if not result.get("found", True):
            parts.append(f"结论：{result['error']}（{result.get('order_id', '未提供 ID')}）。")
            continue
        if tool == "get_color_order":
            cf = result.get("confirmed_fields") or {}
            parts.append(
                f"结论：调色需求 {result['order_id']}\n"
                f"客户：{result['customer_name']}\n"
                f"需求：{result['customer_input']}\n"
                f"状态：{_STATUS_LABELS.get(result.get('status', ''), result.get('status', ''))}\n"
                f"材质：{result.get('production_material') or '未指定'}\n"
                f"基布：{result.get('base_cloth') or cf.get('baseCloth', '未指定')}\n"
                f"光源：{cf.get('illuminant', '未指定')}\n"
                f"Delta E 阈值：{cf.get('deltaEThreshold', '未指定')}"
            )
        elif tool == "get_order_timeline":
            tl = "\n".join(
                f"- [{e['created_at'][:19] if e.get('created_at') else '-'}] {e['label']}：{e['detail']}"
                for e in result["timeline"]
            )
            parts.append(f"追溯时间线：\n{tl}")
        elif tool == "get_analysis":
            a = result.get("analysis") or {}
            ex = a.get("extracted_json") or {}
            parts.append(
                f"结论：AI 分析结果\n"
                f"颜色意图：{ex.get('colorIntent', '无')}\n"
                f"目标色名：{ex.get('targetColorName', '无')}\n"
                f"风险提示：{ex.get('avoidHueRisk', '无')}\n"
                f"置信度：{a.get('confidence', '无')}\n"
                f"缺失字段：{', '.join(a.get('missing_fields', []) or [])}\n"
                f"来源：{a.get('source', '无')}"
            )
        elif tool == "get_sample_attempts":
            samples = "\n".join(
                f"- {s['version']}：Lab({s['lab'].get('l', '?')}, {s['lab'].get('a', '?')}, {s['lab'].get('b', '?')}), "
                f"Delta E {s['delta_e']}, {'✅ 通过' if s['passed'] else '❌ 未通过'}，{s['deviation']}"
                for s in result["sample_attempts"]
            )
            parts.append(f"打样记录：\n{samples}")
        elif tool == "get_historical_cases":
            cases = "\n".join(
                f"- {c['name']}（{c['fabric']}/{c['base_cloth']}）：{c['similarity_reason']} 风险：{c['risk_note']}"
                for c in result["historical_cases"]
            )
            parts.append(f"历史案例：\n{cases}")
        elif tool == "check_order_status":
            if not result["issues"]:
                parts.append("结论：当前没有异常状态的调色需求。")
            else:
                issues = "\n".join(
                    f"- {i['order_id'][:14]}… {i['status_label']}：{i['customer_input']}"
                    for i in result["issues"]
                )
                parts.append(f"异常需求：\n{issues}")
        elif tool == "list_color_orders":
            orders = "\n".join(
                f"- {o['order_id'][:14]}… {_STATUS_LABELS.get(o.get('status', ''), o.get('status', ''))} {o['customer_name']}"
                for o in result["orders"]
            )
            parts.append(f"全部调色需求：\n{orders}")
        elif tool == "preview_color":
            parts.append(
                f"结论：已生成演示色块\n"
                f"颜色描述：{result['color']}\n"
                f"近似 HEX：{result['hex']}\n"
                f"说明：{result['note']}"
            )
    return "\n\n".join(parts)


# ============ Chainlit 事件处理 ============

@cl.on_chat_start
async def on_chat_start():
    cl.user_session.set("messages", [{"role": "system", "content": SYSTEM_PROMPT}])
    await cl.Message(
        content="👋 欢迎使用 **ColorBridge 调色协同 Agent Demo**！\n\n"
                "您可以询问我：\n"
                "- 帮我看看当前有哪些调色需求。\n"
                "- 查询某个需求的 AI 分析结果。\n"
                "- 这个需求的打样记录怎么样？\n"
                "- 有哪些历史参考案例？\n"
                "- 扫描一下有没有异常状态的需求。"
    ).send()


@cl.on_message
async def on_message(message: cl.Message):
    messages = cl.user_session.get("messages", [])
    messages.append({"role": "user", "content": message.content})

    tool_results: list[dict[str, Any]] = []
    final_messages = list(messages)

    try:
        @cl.step(name="🧠 调用大模型识别工具需求", type="llm")
        async def request_tool_or_answer():
            return await call_model(messages, TOOLS)

        response = await request_tool_or_answer()
        assistant_message = response.choices[0].message
        tool_calls = getattr(assistant_message, "tool_calls", None) or []

        if tool_calls:
            final_messages.append(_assistant_tool_message(assistant_message))
            for tool_call in tool_calls:
                arguments = complete_tool_arguments(
                    tool_call.function.name,
                    json.loads(tool_call.function.arguments or "{}"),
                )
                result = execute_tool(tool_call.function.name, arguments)
                async with cl.Step(name=f"🔧 {tool_call.function.name}", type="tool") as step:
                    step.input = arguments
                    step.output = result
                final_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False, default=_json_default),
                })
                tool_results.append({"tool": tool_call.function.name, "arguments": arguments, "result": result})
        else:
            text_calls = parse_text_tool_calls(assistant_message.content)
            routed_calls = text_calls or route_demo_tools(message.content)
            if routed_calls:
                for call in routed_calls:
                    arguments = complete_tool_arguments(call["name"], call["arguments"])
                    result = execute_tool(call["name"], arguments)
                    tool_results.append({"tool": call["name"], "arguments": arguments, "result": result})
                    async with cl.Step(name=f"🔧 fallback: {call['name']}", type="tool") as step:
                        step.input = arguments
                        step.output = result
                final_messages.append(_tool_context_message(tool_results))
            elif assistant_message.content:
                await cl.Message(content=assistant_message.content).send()
                messages.append({"role": "assistant", "content": assistant_message.content})
                cl.user_session.set("messages", messages)
                return

        # === 流式输出最终回答 ===
        elements = build_elements(tool_results)
        task_list = build_task_list(tool_results)

        @cl.step(name="📝 流式生成回复", type="llm")
        async def stream_final_answer(target_msg: cl.Message):
            stream = await client.chat.completions.create(
                model=MODEL_ID, messages=final_messages, stream=True
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta
                token = getattr(delta, "content", None) or ""
                if token:
                    await target_msg.stream_token(token)

        msg = cl.Message(content="", elements=elements)
        await msg.send()
        if task_list is not None:
            await task_list.send()
        try:
            await stream_final_answer(msg)
        except Exception as stream_exc:
            await msg.stream_token(f"\n\n[流式中断：{stream_exc}]")
        await msg.update()

        final_messages.append({"role": "assistant", "content": msg.content})
        cl.user_session.set("messages", final_messages)
        return

    except Exception as exc:
        routed_calls = route_demo_tools(message.content)
        if not routed_calls:
            answer = f"模型调用失败：{exc}\n\n你可以重试，或输入调色需求 ID 进行查询。"
        else:
            tool_results = []
            for call in routed_calls:
                arguments = complete_tool_arguments(call["name"], call["arguments"])
                tool_results.append({"tool": call["name"], "arguments": arguments, "result": execute_tool(call["name"], arguments)})
            answer = format_fallback_answer(tool_results)
        messages.append({"role": "assistant", "content": answer})
        cl.user_session.set("messages", messages)
        await cl.Message(content=answer).send()
        return


@cl.action_callback("clear_history")
async def on_clear_history(action):
    cl.user_session.set("messages", [{"role": "system", "content": SYSTEM_PROMPT}])
    await cl.Message(content="🗑️ 对话历史已清除").send()
    await action.remove()


@cl.set_chat_profiles
async def chat_profile():
    return [
        cl.ChatProfile(
            name="💬 ColorBridge 调色协同",
            markdown_description="ColorBridge 调色协同 Agent",
            icon="https://cdn-icons-png.flaticon.com/512/4712/4712109.png"
        ),
    ]
