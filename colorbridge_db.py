"""
ColorBridge 数据库持久化层
SQLite 读写，字段对齐 colorbridge_schema.sql
"""
import json
import sqlite3
import os
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "colorbridge.db")


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """确保数据库和表存在，种子数据只在空表时插入"""
    schema_path = os.path.join(os.path.dirname(__file__), "colorbridge_schema.sql")
    if not os.path.isfile(schema_path):
        return
    conn = _conn()
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            full_sql = f.read()

        # 检查是否已有数据
        try:
            count = conn.execute("SELECT COUNT(*) FROM historical_batch").fetchone()[0]
            has_data = count > 0
        except Exception:
            has_data = False

        if has_data:
            # 只执行 DDL 语句（CREATE TABLE / CREATE INDEX / PRAGMA）
            # 按分号分割，只保留非 INSERT 语句
            statements = full_sql.split(";")
            for stmt in statements:
                stripped = stmt.strip()
                upper = stripped.upper()
                if stripped and not upper.startswith("INSERT"):
                    try:
                        conn.execute(stripped)
                    except Exception:
                        pass  # 忽略 DDL 中的注释行等
        else:
            conn.executescript(full_sql)
    finally:
        conn.close()


def save_order(order: dict) -> str:
    """将任务订单写入 order_trace 表"""
    conn = _conn()
    try:
        conn.execute("""
            INSERT OR REPLACE INTO order_trace
            (id, order_no, customer_name, intent_id, recipe_card_id,
             workflow_status, predicted_risk, actual_lab, actual_delta_e,
             rft, summary, trace_events, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            order.get("order_id", ""),
            order.get("order_id", ""),
            order.get("customer_name", "Demo 客户"),
            order.get("intent_id", ""),
            order.get("recipe_card_id", ""),
            order.get("workflow_status", "需求已识别"),
            order.get("predicted_risk", "待评估"),
            json.dumps(order.get("actual_lab"), ensure_ascii=False) if order.get("actual_lab") else None,
            order.get("actual_delta_e"),
            1 if order.get("rft") else (0 if order.get("rft") is False else None),
            order.get("summary", ""),
            json.dumps(order.get("trace_events", []), ensure_ascii=False),
            datetime.now().isoformat(),
        ))
        conn.commit()
        return order.get("order_id", "")
    finally:
        conn.close()


def save_recipe(recipe: dict) -> str:
    """将方案卡写入 recipe_card 表"""
    recipe_id = recipe.get("recipe_id", "")
    conn = _conn()
    try:
        conn.execute("""
            INSERT OR REPLACE INTO recipe_card
            (id, recipe_id, recipe_no, version, fabric, color_name,
             target_lab, dye_formula, process_params, source_batch_id,
             risk_notes, checklist, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            recipe_id,
            recipe_id,
            recipe.get("recipe_no", recipe_id),
            recipe.get("version", "V1"),
            recipe.get("fabric", ""),
            recipe.get("color_name", ""),
            json.dumps(recipe.get("target_lab"), ensure_ascii=False) if recipe.get("target_lab") else None,
            json.dumps(recipe.get("dye_formula", []), ensure_ascii=False),
            json.dumps(recipe.get("process_params", {}), ensure_ascii=False),
            recipe.get("source_batch_id"),
            json.dumps(recipe.get("risk_notes", []), ensure_ascii=False),
            json.dumps(recipe.get("checklist", []), ensure_ascii=False),
            recipe.get("status", "草稿"),
            recipe.get("created_at", datetime.now().isoformat()),
        ))
        conn.commit()
        return recipe_id
    finally:
        conn.close()


def save_intent(intent: dict) -> str:
    """将意图写入 intent_request 表"""
    intent_id = intent.get("id", "")
    conn = _conn()
    try:
        conn.execute("""
            INSERT OR REPLACE INTO intent_request
            (id, raw_text, intent_type, fabric, color_name,
             target_lab, dye_type, confidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            intent_id,
            intent.get("raw_text", ""),
            intent.get("intent_type", "方案生成"),
            intent.get("fabric", ""),
            intent.get("color_name", ""),
            json.dumps(intent.get("target_lab"), ensure_ascii=False) if intent.get("target_lab") else None,
            intent.get("dye_type", ""),
            intent.get("confidence", 0),
            datetime.now().isoformat(),
        ))
        conn.commit()
        return intent_id
    finally:
        conn.close()


def get_order(order_id: str) -> Optional[dict]:
    """从数据库读取订单"""
    conn = _conn()
    try:
        row = conn.execute("SELECT * FROM order_trace WHERE id = ?", (order_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["actual_lab"] = json.loads(d["actual_lab"]) if d.get("actual_lab") else None
        d["trace_events"] = json.loads(d["trace_events"]) if d.get("trace_events") else []
        return d
    finally:
        conn.close()


def list_orders(limit: int = 20) -> list:
    """列出最近的订单"""
    conn = _conn()
    try:
        rows = conn.execute(
            "SELECT * FROM order_trace ORDER BY updated_at DESC LIMIT ?", (limit,)
        ).fetchall()
        results = []
        for row in rows:
            d = dict(row)
            d["actual_lab"] = json.loads(d["actual_lab"]) if d.get("actual_lab") else None
            d["trace_events"] = json.loads(d["trace_events"]) if d.get("trace_events") else []
            results.append(d)
        return results
    finally:
        conn.close()


def get_historical_batches(fabric: str = "", color_name: str = "", dye_type: str = "") -> list:
    """按条件查询历史批次"""
    conn = _conn()
    try:
        query = "SELECT * FROM historical_batch WHERE 1=1"
        params = []
        if fabric:
            query += " AND fabric LIKE ?"
            params.append(f"%{fabric}%")
        if color_name:
            query += " AND color_name LIKE ?"
            params.append(f"%{color_name}%")
        if dye_type:
            query += " AND dye_type = ?"
            params.append(dye_type)
        query += " ORDER BY delta_e ASC"

        rows = conn.execute(query, params).fetchall()
        results = []
        for row in rows:
            d = dict(row)
            d["target_lab"] = json.loads(d["target_lab"]) if d.get("target_lab") else None
            d["actual_lab"] = json.loads(d["actual_lab"]) if d.get("actual_lab") else None
            d["dye_formula"] = json.loads(d["dye_formula"]) if d.get("dye_formula") else []
            d["process_params"] = json.loads(d["process_params"]) if d.get("process_params") else {}
            d["rft"] = bool(d.get("rft"))
            d["reworked"] = bool(d.get("reworked"))
            results.append(d)
        return results
    finally:
        conn.close()


# 模块加载时初始化数据库
init_db()
