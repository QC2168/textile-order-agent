from __future__ import annotations


def lab_to_css(lab: dict | None) -> str:
    if not lab:
        return "#d7dde2"
    l = max(0, min(100, float(lab.get("l", 50))))
    a = max(-60, min(60, float(lab.get("a", 0))))
    b = max(-60, min(80, float(lab.get("b", 0))))
    lightness = 18 + l * 0.62
    saturation = min(78, 28 + (abs(a) + abs(b)) * 0.55)
    hue = (210 + a * 1.8 - b * 1.25) % 360
    return f"hsl({hue:.0f} {saturation:.0f}% {lightness:.0f}%)"


def predicted_lab(order: dict) -> dict | None:
    recipe = order["recipe_cards"][-1] if order.get("recipe_cards") else None
    target = recipe.get("target_lab") if recipe else order["intent"].get("target_lab")
    if not target:
        return None

    risk = order.get("predicted_risk")
    if risk == "高":
        return {
            "l": round(target["l"] - 1.4, 1),
            "a": round(target["a"] + 0.8, 1),
            "b": round(target["b"] - 0.9, 1),
        }
    if risk == "中":
        return {
            "l": round(target["l"] - 0.6, 1),
            "a": round(target["a"] + 0.3, 1),
            "b": round(target["b"] - 0.4, 1),
        }
    return dict(target)


def formula_with_share(formula: list[dict]) -> list[dict]:
    total = sum(float(item["dosage"]) for item in formula) or 1
    rows = [
        {
            **item,
            "share": round(float(item["dosage"]) / total * 100, 1),
        }
        for item in formula
    ]
    if rows:
        rows[-1]["share"] = round(100 - sum(item["share"] for item in rows[:-1]), 1)
    return rows


def selected_batch_from_order(order: dict) -> dict:
    matches = order.get("matches", [])
    selected = next((item for item in matches if item.get("selected")), None)
    return selected or (matches[0] if matches else {})


def build_workflow_panel_props(order: dict) -> dict:
    recipe = order["recipe_cards"][-1] if order.get("recipe_cards") else {}
    process = recipe.get("process_params", {})
    target = recipe.get("target_lab") or order["intent"].get("target_lab")
    predicted = predicted_lab(order)

    return {
        "order": {
            "order_id": order["order_id"],
            "status": order["workflow_status"],
            "risk": order["predicted_risk"],
            "summary": order["summary"],
            "raw_text": order["raw_text"],
        },
        "intent": order["intent"],
        "selected_batch": selected_batch_from_order(order),
        "matches": order.get("matches", []),
        "recipe": {
            "recipe_id": recipe.get("recipe_id"),
            "version": recipe.get("version"),
            "status": recipe.get("status"),
            "checklist": recipe.get("checklist", []),
            "risk_notes": recipe.get("risk_notes", []),
        },
        "formula": formula_with_share(recipe.get("dye_formula", [])),
        "process_params": process,
        "tuning_defaults": {
            "temperature": process.get("temperature", 60),
            "pH": process.get("pH", 10.6),
            "heating_rate": process.get("heating_rate", 1.5),
            "hold_time": process.get("hold_time", 45),
        },
        "color_preview": {
            "target": target,
            "target_css": lab_to_css(target),
            "predicted": predicted,
            "predicted_css": lab_to_css(predicted),
        },
        "trace_events": order.get("trace_events", []),
        "after_sales_tickets": order.get("after_sales_tickets", []),
    }
