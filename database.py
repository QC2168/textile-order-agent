"""
SQLite 数据库模块 - ColorBridge 调色需求管理
共用 web/prisma/dev.db，与 Next.js 前端读写同一数据库
"""
import sqlite3
import json
from typing import Any, Optional
from contextlib import contextmanager
from datetime import datetime

DATABASE_FILE = "web/prisma/dev.db"


@contextmanager
def get_connection():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ============ ColorOrder CRUD ============

def get_order(order_id: str) -> Optional[dict[str, Any]]:
    """查询单个 ColorOrder"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ColorOrder WHERE id = ?", (order_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_orders(
    status: Optional[str] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """列出 ColorOrder，支持按状态过滤"""
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM ColorOrder WHERE 1=1"
        params: list[Any] = []
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY createdAt DESC LIMIT ?"
        params.append(limit)
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def get_all_orders() -> list[dict[str, Any]]:
    """获取所有 ColorOrder"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ColorOrder ORDER BY createdAt DESC")
        return [dict(row) for row in cursor.fetchall()]


def create_order(
    customer_input: str,
    customer_name: str = "默认客户",
    status: str = "requirements_loaded",
    requested_color: str = "",
    color_intent: str = "",
    production_material: str = "",
    base_cloth: str = "",
    dye_type: str = "",
    task_no: Optional[str] = None,
) -> dict[str, Any]:
    """创建新的 ColorOrder"""
    import uuid
    order_id = str(uuid.uuid4())
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO ColorOrder (
                id, taskNo, customerName, customerInput, requestedColor,
                colorIntent, productionMaterial, baseCloth, dyeType, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                order_id, task_no, customer_name, customer_input,
                requested_color, color_intent, production_material,
                base_cloth, dye_type, status,
            ),
        )
        return {"success": True, "order_id": order_id}


def update_order(
    order_id: str, updates: dict[str, Any]
) -> dict[str, Any]:
    """更新 ColorOrder 字段"""
    allowed_fields = {
        "customerName", "customerInput", "requestedColor", "colorIntent",
        "productionMaterial", "baseCloth", "dyeType", "status",
        "taskNo", "confirmedFields", "targetLab", "finalRenderLab",
        "selectedCaseId", "selectedSampleId", "finalSchemeId",
    }
    # JSON 序列化
    for json_field in ("confirmedFields", "targetLab", "finalRenderLab"):
        if json_field in updates and not isinstance(updates[json_field], str):
            updates[json_field] = json.dumps(updates[json_field], ensure_ascii=False)

    filtered = {k: v for k, v in updates.items() if k in allowed_fields}
    if not filtered:
        return {"success": False, "error": "没有可更新的有效字段"}

    set_clause = ", ".join(f"{k} = ?" for k in filtered)
    values = list(filtered.values()) + [order_id]

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE ColorOrder SET {set_clause} WHERE id = ?", values
        )
        if cursor.rowcount == 0:
            return {"success": False, "error": f"订单 {order_id} 不存在"}
        return {"success": True, "order_id": order_id}


def delete_order(order_id: str) -> dict[str, Any]:
    """删除 ColorOrder（CASCADE 删除关联数据）"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("DELETE FROM ColorOrder WHERE id = ?", (order_id,))
        if cursor.rowcount == 0:
            return {"success": False, "error": f"订单 {order_id} 不存在"}
        return {"success": True, "order_id": order_id}


# ============ 关联表查询 ============

def get_analysis(order_id: str) -> Optional[dict[str, Any]]:
    """查询 AnalysisResult"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM AnalysisResult WHERE orderId = ?", (order_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_sample_attempts(order_id: str) -> list[dict[str, Any]]:
    """查询 SampleAttempt 列表"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM SampleAttempt WHERE orderId = ? ORDER BY createdAt ASC",
            (order_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def get_trace_events(order_id: str) -> list[dict[str, Any]]:
    """查询 TraceEvent 追溯时间线"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM TraceEvent WHERE orderId = ? ORDER BY createdAt ASC",
            (order_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def get_historical_cases() -> list[dict[str, Any]]:
    """查询所有 HistoricalCase"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM HistoricalCase ORDER BY createdAt ASC"
        )
        return [dict(row) for row in cursor.fetchall()]
