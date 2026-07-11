from __future__ import annotations

from colorbridge_data import BATCH_MATCHES, DEMO_INTENTS, HISTORICAL_BATCHES


INTENT_KEYWORDS = {
    "intent_demo_fog_blue_cotton": ("雾霾蓝", "雾蓝", "棉针织", "别太紫"),
    "intent_demo_polyester_black": ("涤纶", "四面弹", "黑色", "历史配方"),
    "intent_demo_nylon_purple": ("锦纶", "塔丝隆", "深紫", "偏深"),
    "intent_demo_acrylic_royal_blue": ("腈纶", "围巾", "宝蓝", "色花"),
}

SUCCESS_RANGES = {
    "活性染料": {
        "temperature": "浅中 58-62°C，深色 78-82°C",
        "pH": "10.5-10.9",
        "heating_rate": "1.0-1.5°C/min",
    },
    "分散染料": {
        "temperature": "128-132°C",
        "pH": "4.8-5.3",
        "heating_rate": "1.2-1.5°C/min",
    },
    "酸性染料": {
        "temperature": "95-100°C",
        "pH": "4.8-5.5",
        "heating_rate": "1.0-1.2°C/min",
    },
    "阳离子染料": {
        "temperature": "95-100°C",
        "pH": "4.5-5.2",
        "heating_rate": "0.7-0.9°C/min",
    },
}


def find_intent(text: str) -> dict:
    normalized = text.strip()
    scored = []
    for intent in DEMO_INTENTS:
        keywords = INTENT_KEYWORDS[intent["id"]]
        score = sum(1 for keyword in keywords if keyword in normalized)
        scored.append((score, intent))

    scored.sort(key=lambda item: item[0], reverse=True)
    return scored[0][1] if scored[0][0] else DEMO_INTENTS[0]


def matches_for_intent(intent_id: str) -> list[dict]:
    return sorted(
        (match for match in BATCH_MATCHES if match["intent_id"] == intent_id),
        key=lambda match: match["rank"],
    )


def batch_by_id(batch_id: str) -> dict | None:
    return next(
        (batch for batch in HISTORICAL_BATCHES if batch["id"] == batch_id),
        None,
    )


def selected_batch_for_intent(intent_id: str) -> dict | None:
    selected = next(
        (match for match in matches_for_intent(intent_id) if match["selected"]),
        None,
    )
    if not selected:
        return None
    return batch_by_id(selected["batch_id"])


def risk_level(batch: dict | None) -> str:
    if not batch:
        return "中"
    if not batch["rft"] or batch["reworked"] or batch["delta_e"] >= 2:
        return "高"
    if batch["delta_e"] > 1:
        return "中"
    return "低"


def adjustment_advice(batch: dict | None) -> list[str]:
    if not batch:
        return ["历史数据不足，先按标准安全区间做小样，不直接生成生产配方。"]

    params = batch["process_params"]
    dye_type = batch["dye_type"]
    ranges = SUCCESS_RANGES.get(dye_type, {})
    advice = []

    if not batch["rft"]:
        note = batch["result_note"]
        if "升温" in note or params.get("heating_rate", 0) > 1.5:
            advice.append(
                f"把升温速率回到 {ranges.get('heating_rate', '历史成功区间')}，先降低色花和局部偏深风险"
            )
        if "pH" in note:
            advice.append(
                f"把 pH 拉回 {ranges.get('pH', '历史成功区间')}，避免上染过快或固色失控"
            )
        if "温度" in note:
            advice.append(
                f"把温度回到 {ranges.get('temperature', '历史成功区间')}，不要直接沿用风险批次高温"
            )
        if "缓染剂不足" in note:
            advice.append("提高缓染剂到相似成功批次水平，并放慢升温")
        if "分散剂偏低" in note:
            advice.append("补足分散剂和匀染剂，避免分散不良导致色花")

    if not advice:
        advice.append("可作为基础方案复用，但需用本次基布和看样光源做小样确认")

    return advice


def optical_note(batch: dict | None) -> str:
    if not batch:
        return "D65/A/TL84 下都需要看样确认；当前没有足够历史依据判断同色异谱风险。"
    if batch["color_name"] in {"雾霾蓝", "宝蓝", "深紫"}:
        return "蓝紫系建议同时看 D65 和 TL84；商场/办公室光下可能偏紫或偏灰。"
    if batch["color_name"] in {"黑色", "藏青"}:
        return "深色建议关注 A 光源下的偏红和 D65 下的深浅差异。"
    return "保留 D65、A、TL84 三光源对照，最终以调色师实样确认。"


def build_tuning_summary(text: str) -> dict:
    intent = find_intent(text)
    matches = [
        {**match, "batch": batch_by_id(match["batch_id"])}
        for match in matches_for_intent(intent["id"])
    ]
    selected = selected_batch_for_intent(intent["id"])

    return {
        "intent": intent,
        "matches": matches,
        "selected_batch": selected,
        "risk_level": risk_level(selected),
        "advice": adjustment_advice(selected),
        "optical_note": optical_note(selected),
    }


def format_formula(formula: list[dict]) -> str:
    return "；".join(
        f"{item['name']} {item['dosage']}{item['unit']}" for item in formula
    )


def format_tuning_summary(summary: dict) -> str:
    batch = summary["selected_batch"]
    lines = [
        "ColorBridge 历史匹配结果",
        f"- 识别意图：{summary['intent']['intent_type']} / {summary['intent']['fabric']} / {summary['intent']['color_name']}",
        f"- 综合风险：{summary['risk_level']}",
    ]

    if batch:
        lines.extend(
            [
                f"- 选中历史批次：{batch['batch_no']}（{batch['fabric']}，{batch['color_name']}，Delta E {batch['delta_e']}，RFT={'是' if batch['rft'] else '否'}）",
                f"- 历史配方：{format_formula(batch['dye_formula'])}",
                f"- 历史结果：{batch['result_note']}",
            ]
        )

    lines.append("- 调整方向：")
    lines.extend(f"  - {item}" for item in summary["advice"])
    lines.append(f"- 光源影响：{summary['optical_note']}")
    lines.append("- 口径：AI 只给基于历史订单和成功区间的调整方向，最终必须由调色师确认。")
    return "\n".join(lines)
