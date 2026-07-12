import unittest
import importlib
import os
import sys
from unittest.mock import patch
from dotenv import load_dotenv

load_dotenv()

# Fix: web/app directory acts as namespace package, shadowing root app.py
sys.path = [p for p in sys.path if "web/app" not in p and "web\\app" not in p]
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import (
    build_elements,
    check_order_status,
    complete_tool_arguments,
    execute_tool,
    format_fallback_answer,
    get_analysis_result,
    get_cases,
    get_color_order,
    get_order_timeline,
    get_samples,
    parse_text_tool_calls,
    route_demo_tools,
    _order_summary,
)


class ColorBridgeToolTests(unittest.TestCase):
    """使用真实数据库的 e2e 测试 —— 所有 function call 必须覆盖"""

    @classmethod
    def setUpClass(cls):
        """取一条真实 ColorOrder 用于只读测试"""
        import psycopg2
        import psycopg2.extras
        colorbridge_database_url = os.getenv("COLORBRIDGE_DATABASE_URL", "postgresql://colorbridge:colorbridge@localhost:54321/colorbridge")
        conn = psycopg2.connect(colorbridge_database_url)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute('SELECT id FROM "ColorOrder" ORDER BY "createdAt" DESC LIMIT 1')
        row = cursor.fetchone()
        cls._order_id = row["id"] if row else None
        conn.close()

        # 测试期间创建的订单 ID，tearDownClass 统一清理
        cls._test_order_ids: list[str] = []

    @classmethod
    def tearDownClass(cls):
        """清理测试创建的订单"""
        if not cls._test_order_ids:
            return
        import psycopg2
        colorbridge_database_url = os.getenv("COLORBRIDGE_DATABASE_URL", "postgresql://colorbridge:colorbridge@localhost:54321/colorbridge")
        conn = psycopg2.connect(colorbridge_database_url)
        cursor = conn.cursor()
        for oid in cls._test_order_ids:
            try:
                cursor.execute('DELETE FROM "ColorOrder" WHERE id = %s', (oid,))
            except Exception:
                pass
        conn.commit()
        conn.close()

    def _real_id(self):
        if not self._order_id:
            self.skipTest("数据库无 ColorOrder 数据")
        return self._order_id

    def test_database_uses_colorbridge_database_url(self):
        import database
        with patch.dict(os.environ, {
            "DATABASE_URL": "postgresql://chainlit:chainlit@localhost:5432/chainlit",
            "COLORBRIDGE_DATABASE_URL": "postgresql://colorbridge:colorbridge@localhost:54321/colorbridge",
        }):
            reloaded = importlib.reload(database)
            self.assertEqual(
                reloaded.DATABASE_URL,
                "postgresql://colorbridge:colorbridge@localhost:54321/colorbridge",
            )
        importlib.reload(database)

    def _create_test_order(self) -> str:
        """创建一个测试订单并注册清理，返回 order_id"""
        result = execute_tool("create_color_order", {
            "customer_input": "e2e 测试需求",
            "customer_name": "测试客户",
        })
        self.assertTrue(result["success"], f"创建测试订单失败: {result}")
        oid = result["order_id"]
        self.__class__._test_order_ids.append(oid)
        return oid

    # ============================================================
    # get_color_order
    # ============================================================

    def test_get_color_order_returns_existing_order(self):
        result = get_color_order(self._real_id())
        self.assertTrue(result["found"])
        self.assertEqual(result["order_id"], self._real_id())
        self.assertIn("status", result)

    def test_get_color_order_not_found(self):
        result = get_color_order("nonexistent-id-99999")
        self.assertFalse(result["found"])
        self.assertIn("未找到", result["error"])

    # ============================================================
    # get_order_timeline
    # ============================================================

    def test_get_order_timeline_returns_events(self):
        result = get_order_timeline(self._real_id())
        self.assertTrue(result["found"])
        self.assertIsInstance(result["timeline"], list)

    def test_get_order_timeline_not_found(self):
        result = get_order_timeline("nonexistent-id-99999")
        self.assertFalse(result["found"])

    # ============================================================
    # get_samples
    # ============================================================

    def test_get_samples_returns_delta_e_and_passed(self):
        result = get_samples(self._real_id())
        self.assertTrue(result["found"])
        self.assertIsInstance(result["sample_attempts"], list)
        if result["sample_attempts"]:
            s = result["sample_attempts"][0]
            self.assertIn("delta_e", s)
            self.assertIn("passed", s)
            self.assertIsInstance(s["passed"], bool)

    def test_get_samples_not_found(self):
        result = get_samples("nonexistent-id-99999")
        self.assertFalse(result["found"])

    # ============================================================
    # get_analysis_result
    # ============================================================

    def test_get_analysis_result_returns_analysis(self):
        result = get_analysis_result(self._real_id())
        self.assertTrue(result["found"])
        # 可能有分析也可能没有，结构必须正确
        self.assertIn("analysis", result)

    def test_get_analysis_result_not_found(self):
        result = get_analysis_result("nonexistent-id-99999")
        self.assertFalse(result["found"])

    # ============================================================
    # get_cases
    # ============================================================

    def test_get_cases_returns_seed_data(self):
        result = get_cases()
        self.assertTrue(result["found"])
        self.assertIsInstance(result["historical_cases"], list)

    # ============================================================
    # check_order_status
    # ============================================================

    def test_check_order_status_scans_all(self):
        result = check_order_status()
        self.assertEqual(result["scope"], "all")
        self.assertIsInstance(result["issues"], list)

    def test_check_order_status_with_status_filter(self):
        result = check_order_status(status="requirements_loaded")
        self.assertEqual(result["scope"], "status:requirements_loaded")
        self.assertIsInstance(result["issues"], list)

    # ============================================================
    # list_color_orders
    # ============================================================

    def test_list_color_orders_execute_tool(self):
        """核心：list_color_orders 通过 execute_tool（修复 datetime 序列化）"""
        result = execute_tool("list_color_orders", {})
        self.assertTrue(result["found"])
        self.assertIsInstance(result["orders"], list)
        self.assertGreaterEqual(result["count"], 1)
        # 验证每个订单关键字段存在且 created_at 是字符串
        for o in result["orders"]:
            self.assertIn("order_id", o)
            self.assertIn("status", o)
            self.assertIn("customer_name", o)
            self.assertIsInstance(o["created_at"], str, f"created_at 应为字符串，实际: {type(o['created_at'])}")

    def test_list_color_orders_with_status_filter(self):
        result = execute_tool("list_color_orders", {"status": "requirements_loaded"})
        self.assertTrue(result["found"])
        for o in result["orders"]:
            self.assertEqual(o["status"], "requirements_loaded")

    def test_list_color_orders_with_limit(self):
        result = execute_tool("list_color_orders", {"limit": 2})
        self.assertTrue(result["found"])
        self.assertLessEqual(len(result["orders"]), 2)

    # ============================================================
    # create / update / delete (CRUD e2e)
    # ============================================================

    def test_create_color_order(self):
        result = execute_tool("create_color_order", {
            "customer_input": "CRUD e2e 测试 - 创建",
            "customer_name": "e2e 客户",
            "requested_color": "深蓝色",
        })
        self.assertTrue(result["success"])
        self.assertIsInstance(result["order_id"], str)
        # 立即清理
        self._test_order_ids.append(result["order_id"])

    def test_create_color_order_defaults(self):
        """仅传必填字段，其余使用默认值"""
        result = execute_tool("create_color_order", {
            "customer_input": "最小创建测试",
        })
        self.assertTrue(result["success"])
        # 验证创建成功后可查询
        detail = get_color_order(result["order_id"])
        self.assertTrue(detail["found"])
        self.assertEqual(detail["customer_name"], "默认客户")
        self._test_order_ids.append(result["order_id"])

    def test_update_color_order(self):
        oid = self._create_test_order()
        result = execute_tool("update_color_order", {
            "order_id": oid,
            "customer_name": "更新后客户",
            "production_material": "涤纶",
            "status": "requirements_confirmed",
        })
        self.assertTrue(result["success"], f"更新失败: {result}")
        # 验证更新生效
        detail = get_color_order(oid)
        self.assertEqual(detail["customer_name"], "更新后客户")
        self.assertEqual(detail["production_material"], "涤纶")
        self.assertEqual(detail["status"], "requirements_confirmed")

    def test_update_color_order_missing_id(self):
        result = execute_tool("update_color_order", {"customer_name": "x"})
        self.assertFalse(result["success"])
        self.assertIn("order_id", result["error"])

    def test_update_color_order_nonexistent(self):
        result = execute_tool("update_color_order", {
            "order_id": "nonexistent-99999",
            "status": "sample_passed",
        })
        self.assertFalse(result["success"])

    def test_update_color_order_invalid_field(self):
        """无效字段不报错但会被忽略"""
        oid = self._create_test_order()
        result = execute_tool("update_color_order", {
            "order_id": oid,
            "hack_field": "should_be_ignored",
        })
        # 没有有效字段，应返回 error
        self.assertFalse(result["success"])

    def test_delete_color_order(self):
        oid = self._create_test_order()
        result = execute_tool("delete_color_order", {"order_id": oid})
        self.assertTrue(result["success"])
        # 验证已删除
        detail = get_color_order(oid)
        self.assertFalse(detail["found"])
        # 不再需要清理
        self._test_order_ids.remove(oid)

    def test_delete_color_order_nonexistent(self):
        result = execute_tool("delete_color_order", {"order_id": "nonexistent-99999"})
        self.assertFalse(result["success"])

    def test_crud_e2e_cycle(self):
        """完整 CRUD 链路：创建 → 更新 → 删除"""
        # 创建
        create = execute_tool("create_color_order", {
            "customer_input": "完整 CRUD 链路测试",
            "customer_name": "链路客户",
        })
        self.assertTrue(create["success"])
        oid = create["order_id"]

        # 更新
        update = execute_tool("update_color_order", {
            "order_id": oid,
            "customer_name": "链路客户-改",
            "status": "analysis_ready",
        })
        self.assertTrue(update["success"])
        detail = get_color_order(oid)
        self.assertEqual(detail["customer_name"], "链路客户-改")
        self.assertEqual(detail["status"], "analysis_ready")

        # 删除
        delete = execute_tool("delete_color_order", {"order_id": oid})
        self.assertTrue(delete["success"])
        self.assertFalse(get_color_order(oid)["found"])

    # ============================================================
    # execute_tool 未知工具
    # ============================================================

    def test_execute_tool_unknown(self):
        result = execute_tool("unknown_tool", {})
        self.assertFalse(result["found"])

    def test_execute_tool_preview_color_returns_demo_swatch(self):
        result = execute_tool("preview_color", {"color": "蓝色棉纱布"})
        self.assertTrue(result["found"])
        self.assertEqual(result["hex"], "#2563eb")
        self.assertEqual(result["color"], "蓝色棉纱布")
        self.assertIn("#2563eb", result["svg"])

    def test_build_elements_adds_color_preview_image(self):
        result = execute_tool("preview_color", {"color": "蓝色棉纱布"})
        elements = build_elements([{"tool": "preview_color", "arguments": {"color": "蓝色棉纱布"}, "result": result}])
        self.assertEqual(len(elements), 1)
        self.assertEqual(elements[0].mime, "image/svg+xml")
        self.assertIn("#2563eb", elements[0].content.decode("utf-8"))

    # ============================================================
    # route_demo_tools (所有 7 种关键词 → 工具映射)
    # ============================================================

    def test_route_demo_tools_case_keyword(self):
        calls = route_demo_tools("有哪些历史参考案例？")
        self.assertEqual(calls[0]["name"], "get_historical_cases")

    def test_route_demo_tools_sample_keyword(self):
        calls = route_demo_tools("打样记录怎么样？")
        self.assertEqual(calls[0]["name"], "get_sample_attempts")

    def test_route_demo_tools_timeline_keyword(self):
        calls = route_demo_tools("追溯一下时间线")
        self.assertEqual(calls[0]["name"], "get_order_timeline")

    def test_route_demo_tools_abnormal_keyword(self):
        calls = route_demo_tools("扫描异常状态")
        self.assertEqual(calls[0]["name"], "check_order_status")

    def test_route_demo_tools_list_keyword(self):
        calls = route_demo_tools("列出所有需求")
        self.assertEqual(calls[0]["name"], "list_color_orders")

    def test_route_demo_tools_analysis_keyword(self):
        calls = route_demo_tools("分析一下这个需求")
        self.assertEqual(calls[0]["name"], "get_analysis")

    def test_route_demo_tools_color_preview_keyword(self):
        calls = route_demo_tools("生成一个蓝色棉纱布颜色")
        self.assertEqual(calls, [{"name": "preview_color", "arguments": {"color": "生成一个蓝色棉纱布颜色"}}])

    def test_route_demo_tools_id_match(self):
        calls = route_demo_tools(self._real_id())
        self.assertEqual(calls[0]["name"], "get_color_order")

    def test_route_demo_tools_no_match(self):
        calls = route_demo_tools("你好")
        self.assertEqual(calls, [])

    def test_parse_text_tool_calls_reads_dsml_invoke(self):
        content = '系统中当前有 1 个调色需求订单，我来查询该订单的打样记录。\n<｜｜DSML｜｜tool_calls>\n<｜｜DSML｜｜invoke name="get_sample_attempts">'
        calls = parse_text_tool_calls(content)
        self.assertEqual(calls, [{"name": "get_sample_attempts", "arguments": {}}])

    def test_parse_text_tool_calls_reads_dsml_parameters_for_all_tools(self):
        content = """
<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="get_color_order"><｜｜DSML｜｜parameter name="order_id" string="true">order-1</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="get_order_timeline"><｜｜DSML｜｜parameter name="order_id" string="true">order-2</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="get_analysis"><｜｜DSML｜｜parameter name="order_id" string="true">order-3</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="get_sample_attempts"><｜｜DSML｜｜parameter name="order_id" string="true">order-4</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="get_historical_cases"><｜｜DSML｜｜parameter name="fabric" string="true">棉</｜｜DSML｜｜parameter><｜｜DSML｜｜parameter name="color" string="true">蓝色</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="check_order_status"><｜｜DSML｜｜parameter name="status" string="true">analysis_failed</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="create_color_order"><｜｜DSML｜｜parameter name="customer_input" string="true">蓝色棉纱布</｜｜DSML｜｜parameter><｜｜DSML｜｜parameter name="customer_name" string="true">测试客户</｜｜DSML｜｜parameter><｜｜DSML｜｜parameter name="requested_color" string="true">蓝色</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="update_color_order"><｜｜DSML｜｜parameter name="order_id" string="true">order-5</｜｜DSML｜｜parameter><｜｜DSML｜｜parameter name="status" string="true">requirements_confirmed</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="delete_color_order"><｜｜DSML｜｜parameter name="order_id" string="true">order-6</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
<｜｜DSML｜｜invoke name="list_color_orders"><｜｜DSML｜｜parameter name="status" string="true">requirements_loaded</｜｜DSML｜｜parameter><｜｜DSML｜｜parameter name="limit">2</｜｜DSML｜｜parameter></｜｜DSML｜｜invoke>
</｜｜DSML｜｜tool_calls>
"""
        calls = parse_text_tool_calls(content)
        self.assertEqual(
            calls,
            [
                {"name": "get_color_order", "arguments": {"order_id": "order-1"}},
                {"name": "get_order_timeline", "arguments": {"order_id": "order-2"}},
                {"name": "get_analysis", "arguments": {"order_id": "order-3"}},
                {"name": "get_sample_attempts", "arguments": {"order_id": "order-4"}},
                {"name": "get_historical_cases", "arguments": {"fabric": "棉", "color": "蓝色"}},
                {"name": "check_order_status", "arguments": {"status": "analysis_failed"}},
                {"name": "create_color_order", "arguments": {"customer_input": "蓝色棉纱布", "customer_name": "测试客户", "requested_color": "蓝色"}},
                {"name": "update_color_order", "arguments": {"order_id": "order-5", "status": "requirements_confirmed"}},
                {"name": "delete_color_order", "arguments": {"order_id": "order-6"}},
                {"name": "list_color_orders", "arguments": {"status": "requirements_loaded", "limit": 2}},
            ],
        )

    def test_complete_tool_arguments_uses_single_order_id(self):
        with patch("app.list_orders", return_value=[{"id": "order-1"}]):
            arguments = complete_tool_arguments("get_sample_attempts", {})
        self.assertEqual(arguments, {"order_id": "order-1"})

    def test_complete_tool_arguments_keeps_missing_id_when_not_single_order(self):
        with patch("app.list_orders", return_value=[{"id": "order-1"}, {"id": "order-2"}]):
            arguments = complete_tool_arguments("get_sample_attempts", {})
        self.assertEqual(arguments, {})

    # ============================================================
    # format_fallback_answer (所有 7 种工具类型)
    # ============================================================

    def test_format_fallback_answer_get_color_order(self):
        result = get_color_order(self._real_id())
        tool_results = [
            {"tool": "get_color_order", "arguments": {"order_id": self._real_id()}, "result": result},
        ]
        answer = format_fallback_answer(tool_results)
        self.assertIn("结论", answer)
        self.assertNotIn("```json", answer)

    def test_format_fallback_answer_not_found(self):
        tool_results = [
            {"tool": "get_color_order", "arguments": {"order_id": "bad"}, "result": {"found": False, "error": "xx"}},
        ]
        answer = format_fallback_answer(tool_results)
        self.assertIn("xx", answer)

    def test_format_fallback_answer_sample_attempts(self):
        samples = get_samples(self._real_id())
        tool_results = [
            {"tool": "get_sample_attempts", "arguments": {"order_id": self._real_id()}, "result": samples},
        ]
        answer = format_fallback_answer(tool_results)
        if samples["sample_attempts"]:
            self.assertIn("Delta E", answer)

    def test_format_fallback_answer_analysis(self):
        analysis = get_analysis_result(self._real_id())
        tool_results = [
            {"tool": "get_analysis", "arguments": {"order_id": self._real_id()}, "result": analysis},
        ]
        answer = format_fallback_answer(tool_results)
        if analysis.get("analysis"):
            self.assertIn("置信度", answer)

    def test_format_fallback_answer_timeline(self):
        timeline = get_order_timeline(self._real_id())
        tool_results = [
            {"tool": "get_order_timeline", "arguments": {"order_id": self._real_id()}, "result": timeline},
        ]
        answer = format_fallback_answer(tool_results)
        self.assertIn("追溯", answer)

    def test_format_fallback_answer_historical_cases(self):
        cases = get_cases()
        tool_results = [
            {"tool": "get_historical_cases", "arguments": {}, "result": cases},
        ]
        answer = format_fallback_answer(tool_results)
        self.assertIn("历史案例", answer)

    def test_format_fallback_answer_check_order_status_empty(self):
        result = {"found": True, "scope": "all", "issues": []}
        tool_results = [
            {"tool": "check_order_status", "arguments": {}, "result": result},
        ]
        answer = format_fallback_answer(tool_results)
        self.assertIn("没有异常", answer)

    def test_format_fallback_answer_check_order_status_with_issues(self):
        result = check_order_status()
        tool_results = [
            {"tool": "check_order_status", "arguments": {}, "result": result},
        ]
        answer = format_fallback_answer(tool_results)
        if result["issues"]:
            self.assertIn("异常需求", answer)

    def test_format_fallback_answer_list_color_orders(self):
        result = execute_tool("list_color_orders", {})
        tool_results = [
            {"tool": "list_color_orders", "arguments": {}, "result": result},
        ]
        answer = format_fallback_answer(tool_results)
        self.assertIn("全部调色需求", answer)
        for o in result["orders"]:
            self.assertIn(o["customer_name"], answer)

    # ============================================================
    # execute_tool 覆盖所有工具
    # ============================================================

    def test_execute_tool_get_color_order(self):
        result = execute_tool("get_color_order", {"order_id": self._real_id()})
        self.assertTrue(result["found"])

    def test_execute_tool_get_order_timeline(self):
        result = execute_tool("get_order_timeline", {"order_id": self._real_id()})
        self.assertTrue(result["found"])

    def test_execute_tool_get_analysis(self):
        result = execute_tool("get_analysis", {"order_id": self._real_id()})
        self.assertTrue(result["found"])

    def test_execute_tool_get_sample_attempts(self):
        result = execute_tool("get_sample_attempts", {"order_id": self._real_id()})
        self.assertTrue(result["found"])

    def test_execute_tool_get_historical_cases(self):
        result = execute_tool("get_historical_cases", {})
        self.assertTrue(result["found"])

    def test_execute_tool_check_order_status(self):
        result = execute_tool("check_order_status", {})
        self.assertTrue(result["found"])

    def test_execute_tool_preview_color(self):
        result = execute_tool("preview_color", {"color": "红色"})
        self.assertTrue(result["found"])

    # ============================================================
    # _order_summary
    # ============================================================

    def test_order_summary_created_at_is_string(self):
        """_order_summary 必须将 datetime 转为 isoformat 字符串"""
        from database import get_order
        order = get_order(self._real_id())
        self.assertIsNotNone(order)
        summary = _order_summary(order)
        self.assertIsInstance(summary["created_at"], str, "created_at 必须是字符串")
        self.assertRegex(summary["created_at"], r"^\d{4}-\d{2}-\d{2}T")
        # 确认 confirmed_fields 被 parse
        if order.get("confirmedFields"):
            self.assertIsInstance(summary["confirmed_fields"], (dict, type(None)))


if __name__ == "__main__":
    unittest.main()
