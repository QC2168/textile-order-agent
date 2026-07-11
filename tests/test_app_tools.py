import unittest

from app import (
    check_order_status,
    execute_tool,
    format_fallback_answer,
    get_cases,
    get_color_order,
    get_order_timeline,
    get_samples,
    route_demo_tools,
)


class ColorBridgeToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """取一条真实 ColorOrder 用于测试"""
        import sqlite3
        conn = sqlite3.connect("web/prisma/dev.db")
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT id FROM ColorOrder LIMIT 1")
        row = c.fetchone()
        cls._order_id = row["id"] if row else None
        conn.close()

    def _real_id(self):
        if not self._order_id:
            self.skipTest("数据库无 ColorOrder 数据")
        return self._order_id

    # ---- get_color_order ----

    def test_get_color_order_returns_existing_order(self):
        result = get_color_order(self._real_id())
        self.assertTrue(result["found"])
        self.assertEqual(result["order_id"], self._real_id())
        self.assertIn("status", result)

    def test_get_color_order_not_found(self):
        result = get_color_order("nonexistent-id-99999")
        self.assertFalse(result["found"])
        self.assertIn("未找到", result["error"])

    # ---- get_order_timeline ----

    def test_get_order_timeline_returns_events(self):
        result = get_order_timeline(self._real_id())
        self.assertTrue(result["found"])
        self.assertIsInstance(result["timeline"], list)
        self.assertGreater(len(result["timeline"]), 0)
        self.assertIn("label", result["timeline"][0])

    # ---- get_samples ----

    def test_get_samples_returns_delta_e_and_passed(self):
        result = get_samples(self._real_id())
        self.assertTrue(result["found"])
        self.assertIsInstance(result["sample_attempts"], list)
        if result["sample_attempts"]:
            s = result["sample_attempts"][0]
            self.assertIn("delta_e", s)
            self.assertIn("passed", s)
            self.assertIsInstance(s["passed"], bool)

    # ---- get_cases ----

    def test_get_cases_returns_seed_data(self):
        result = get_cases()
        self.assertTrue(result["found"])
        self.assertGreater(len(result["historical_cases"]), 0)
        c = result["historical_cases"][0]
        self.assertIn("name", c)
        self.assertIn("fabric", c)

    # ---- check_order_status ----

    def test_check_order_status_scans_all(self):
        result = check_order_status()
        self.assertEqual(result["scope"], "all")
        self.assertIsInstance(result["issues"], list)

    # ---- route_demo_tools ----

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

    # ---- execute_tool ----

    def test_execute_tool_get_color_order(self):
        result = execute_tool("get_color_order", {"order_id": self._real_id()})
        self.assertTrue(result["found"])

    def test_execute_tool_unknown(self):
        result = execute_tool("unknown_tool", {})
        self.assertFalse(result["found"])

    # ---- format_fallback_answer ----

    def test_format_fallback_answer_renders_order(self):
        tool_results = [
            {"tool": "get_color_order", "arguments": {"order_id": self._real_id()}, "result": get_color_order(self._real_id())},
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


if __name__ == "__main__":
    unittest.main()
