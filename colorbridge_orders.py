from __future__ import annotations

from copy import deepcopy

from colorbridge_tuning import (
    build_tuning_summary,
    find_intent,
    format_formula,
    format_tuning_summary,
)

DEMO_ORDER_DATE = "20260712"

_ORDERS: dict[str, dict] = {}
_ORDER_COUNTER = 0


def reset_task_orders() -> None:
    global _ORDER_COUNTER
    _ORDERS.clear()
    _ORDER_COUNTER = 0


def _next_order_id() -> str:
    global _ORDER_COUNTER
    _ORDER_COUNTER += 1
    return f"CB-{DEMO_ORDER_DATE}-{_ORDER_COUNTER:03d}"


def _trace(event_type: str, title: str, detail: str, operator: str = "system") -> dict:
    return {
        "event_time": "2026-07-12 10:30",
        "event_type": event_type,
        "title": title,
        "detail": detail,
        "operator": operator,
    }


def _copy(value):
    return deepcopy(value)


def get_task_order(order_id: str) -> dict | None:
    order = _ORDERS.get(order_id)
    return _copy(order) if order else None


def list_task_orders(status: str | None = None) -> list[dict]:
    orders = _ORDERS.values()
    if status:
        orders = [order for order in orders if order["workflow_status"] == status]
    return [_copy(order) for order in orders]


def create_task_order(user_text: str) -> dict:
    intent = find_intent(user_text)
    order_id = _next_order_id()
    order = {
        "id": order_id,
        "order_id": order_id,
        "order_no": order_id,
        "customer_name": "Demo 客户",
        "raw_text": user_text,
        "intent": intent,
        "intent_id": intent["id"],
        "recipe_card_id": None,
        "workflow_status": "需求已识别",
        "predicted_risk": "待评估",
        "actual_lab": None,
        "actual_delta_e": None,
        "rft": None,
        "summary": f"{intent['fabric']} / {intent['color_name']} / {intent['dye_type']}",
        "matches": [],
        "tuning_advice": None,
        "recipe_cards": [],
        "after_sales_tickets": [],
        "trace_events": [
            _trace(
                "order_created",
                "创建任务订单",
                f"已根据用户输入创建任务订单，识别为{intent['intent_type']}。",
                "system",
            )
        ],
        "updated_at": "2026-07-12 10:30",
    }
    _ORDERS[order_id] = order
    return _copy(order)


def search_historical_batches(order_id: str) -> list[dict]:
    order = _ORDERS.get(order_id)
    if not order:
        return []

    summary = build_tuning_summary(order["raw_text"])
    matches = []
    for item in summary["matches"]:
        batch = item["batch"]
        matches.append(
            {
                "id": item["id"],
                "intent_id": item["intent_id"],
                "batch_id": item["batch_id"],
                "batch_no": batch["batch_no"] if batch else "",
                "fabric": batch["fabric"] if batch else "",
                "color_name": batch["color_name"] if batch else "",
                "delta_e": batch["delta_e"] if batch else None,
                "rft": batch["rft"] if batch else None,
                "reworked": batch["reworked"] if batch else None,
                "similarity_score": item["similarity_score"],
                "rank": item["rank"],
                "difference_note": item["difference_note"],
                "risk_note": item["risk_note"],
                "selected": item["selected"],
            }
        )

    order["matches"] = matches
    order["workflow_status"] = "历史已匹配"
    order["trace_events"].append(
        _trace(
            "history_matched",
            "匹配历史批次",
            f"找到 {len(matches)} 条相似历史批次，Top1 为 {matches[0]['batch_no'] if matches else '无'}。",
        )
    )
    return _copy(matches)


def generate_tuning_advice(order_id: str) -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}

    summary = build_tuning_summary(order["raw_text"])
    batch = summary["selected_batch"]
    advice = {
        "order_id": order_id,
        "risk_level": summary["risk_level"],
        "selected_batch_id": batch["id"] if batch else None,
        "selected_batch_no": batch["batch_no"] if batch else None,
        "advice": summary["advice"],
        "optical_note": summary["optical_note"],
        "safety_note": "AI 只给基于历史订单和成功区间的调整方向，最终必须由调色师确认。",
        "context": format_tuning_summary(summary),
    }
    order["tuning_advice"] = advice
    order["predicted_risk"] = advice["risk_level"]
    order["workflow_status"] = "调参建议已生成"
    order["trace_events"].append(
        _trace(
            "tuning_advice_generated",
            "生成调参建议",
            f"综合风险为{advice['risk_level']}，已生成参数调整方向和光源提示。",
        )
    )
    return _copy(advice)


def save_recipe_version(order_id: str, adjustments: dict | None = None) -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}
    advice = order.get("tuning_advice") or generate_tuning_advice(order_id)
    summary = build_tuning_summary(order["raw_text"])
    batch = summary["selected_batch"]
    version = f"V{len(order['recipe_cards']) + 1}"
    recipe_id = f"RC-{order_id}-{version}"
    recipe = {
        "id": recipe_id,
        "recipe_id": recipe_id,
        "recipe_no": recipe_id,
        "order_id": order_id,
        "version": version,
        "fabric": order["intent"]["fabric"],
        "color_name": order["intent"]["color_name"],
        "target_lab": order["intent"]["target_lab"],
        "dye_formula": batch["dye_formula"] if batch else [],
        "process_params": batch["process_params"] if batch else {},
        "source_batch_id": batch["id"] if batch else None,
        "source_batch_no": batch["batch_no"] if batch else None,
        "adjustments": adjustments or {},
        "risk_notes": advice["advice"] + [advice["optical_note"]],
        "checklist": [
            "确认面料、克重和基布与本次订单一致",
            "确认染料、助剂和盐碱称量",
            "确认 pH 计和温控记录正常",
            "确认 D65/TL84 下小样看色",
        ],
        "status": "草稿",
        "created_at": "2026-07-12 10:30",
    }
    order["recipe_cards"].append(recipe)
    order["recipe_card_id"] = recipe_id
    order["workflow_status"] = "方案草稿已保存"
    order["trace_events"].append(
        _trace(
            "recipe_saved",
            "保存方案版本",
            f"已保存 {version} 方案草稿，来源批次 {recipe['source_batch_no'] or '无'}。",
        )
    )
    return _copy(recipe)


def confirm_visual_recipe(order_id: str, adjustments: dict) -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}
    recipe = save_recipe_version(order_id, adjustments)
    latest = _latest_recipe(order)
    if latest:
        latest["status"] = "已确认"
        latest["reviewer"] = "调色师"
        latest["reviewed_at"] = "2026-07-12 10:30"
        latest["visual_confirmed"] = True
    order["workflow_status"] = "方案已确认"
    order["trace_events"].append(
        _trace(
            "visual_recipe_confirmed",
            "确认可视化方案",
            f"已确认 {recipe.get('version', '当前')} 可视化调配方案，等待下发车间。",
            "调色师",
        )
    )
    return _copy(order)


def get_recipe_card(order_id: str) -> dict:
    order = _ORDERS.get(order_id)
    if not order or not order["recipe_cards"]:
        return {}
    return _copy(order["recipe_cards"][-1])


def _latest_recipe(order: dict) -> dict | None:
    return order["recipe_cards"][-1] if order["recipe_cards"] else None


def _set_status(order: dict, status: str, event_type: str, title: str, detail: str) -> dict:
    order["workflow_status"] = status
    order["trace_events"].append(_trace(event_type, title, detail))
    return _copy(order)


def submit_recipe_for_review(order_id: str) -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}
    recipe = _latest_recipe(order)
    if recipe:
        recipe["status"] = "待审核"
    return _set_status(order, "方案待审核", "recipe_submitted", "提交方案审核", "V1 方案草稿已提交工艺员审核。")


def confirm_recipe(order_id: str, reviewer: str = "工艺员") -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}
    recipe = _latest_recipe(order)
    if recipe:
        recipe["status"] = "已确认"
        recipe["reviewer"] = reviewer
        recipe["reviewed_at"] = "2026-07-12 10:30"
    return _set_status(order, "方案已确认", "recipe_confirmed", "确认方案", f"{reviewer} 已确认当前方案。")


def dispatch_to_workshop(order_id: str, workshop: str = "染整车间") -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}
    return _set_status(order, "已下发车间", "dispatched", "下发车间", f"方案已下发至{workshop}。")


def update_production_status(order_id: str, status: str) -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}
    return _set_status(order, status, "production_status_updated", "更新生产状态", f"生产状态更新为{status}。")


def record_production_result(
    order_id: str,
    actual_lab: dict,
    actual_delta_e: float,
    rft: bool,
    customer_accepted: bool | None = None,
) -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}
    order["actual_lab"] = actual_lab
    order["actual_delta_e"] = actual_delta_e
    order["rft"] = rft
    order["customer_accepted"] = customer_accepted
    next_status = "客户已确认" if customer_accepted else "生产完成"
    detail = f"实际 Delta E {actual_delta_e}，RFT={'是' if rft else '否'}。"
    if customer_accepted is not None:
        detail += f" 客户确认={'是' if customer_accepted else '否'}。"
    return _set_status(order, next_status, "production_result_recorded", "录入生产结果", detail)


def create_after_sales_ticket(order_id: str, issue_type: str, description: str) -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}
    ticket = {
        "ticket_id": f"AS-{order_id}-{len(order['after_sales_tickets']) + 1:02d}",
        "order_id": order_id,
        "issue_type": issue_type,
        "description": description,
        "status": "处理中",
        "created_at": "2026-07-12 10:30",
    }
    order["after_sales_tickets"].append(ticket)
    order["workflow_status"] = "售后处理中"
    order["trace_events"].append(
        _trace("after_sales_created", "创建售后记录", f"{issue_type}：{description}")
    )
    return _copy(ticket)


def close_order(order_id: str) -> dict:
    order = _ORDERS.get(order_id)
    if not order:
        return {}
    for ticket in order["after_sales_tickets"]:
        ticket["status"] = "已关闭"
    return _set_status(order, "已归档", "order_archived", "订单归档", "订单全链路已归档。")


def format_task_order(order: dict) -> str:
    lines = [
        f"任务订单：{order['order_id']}",
        f"- 状态：{order['workflow_status']}",
        f"- 需求：{order['raw_text']}",
        f"- 识别：{order['intent']['intent_type']} / {order['intent']['fabric']} / {order['intent']['color_name']} / {order['intent']['dye_type']}",
        f"- 预测风险：{order['predicted_risk']}",
    ]
    if order["matches"]:
        lines.append("- 历史匹配：")
        for match in order["matches"][:3]:
            lines.append(
                f"  - Top{match['rank']} {match['batch_no']} 相似度 {match['similarity_score']:.2f}，Delta E {match['delta_e']}，RFT={'是' if match['rft'] else '否'}"
            )
    if order["tuning_advice"]:
        lines.append("- 调整方向：")
        lines.extend(f"  - {item}" for item in order["tuning_advice"]["advice"])
        lines.append(f"- 光源提示：{order['tuning_advice']['optical_note']}")
    if order["recipe_cards"]:
        recipe = order["recipe_cards"][-1]
        lines.append(
            f"- 最新方案：{recipe['recipe_id']} / {recipe['version']} / {recipe['status']} / {format_formula(recipe['dye_formula'])}"
        )
    if order.get("actual_delta_e") is not None:
        lines.append(
            f"- 生产结果：Delta E {order['actual_delta_e']}，RFT={'是' if order['rft'] else '否'}"
        )
    if order.get("after_sales_tickets"):
        lines.append("- 售后记录：")
        for ticket in order["after_sales_tickets"]:
            lines.append(f"  - {ticket['ticket_id']} / {ticket['issue_type']} / {ticket['status']}：{ticket['description']}")
    lines.append("- 口径：AI 只给调整方向，最终由调色师确认。")
    return "\n".join(lines)


def run_order_demo_flow(user_text: str) -> tuple[dict, str]:
    order = create_task_order(user_text)
    search_historical_batches(order["order_id"])
    generate_tuning_advice(order["order_id"])
    save_recipe_version(order["order_id"])
    updated = get_task_order(order["order_id"])
    return updated, format_task_order(updated)
