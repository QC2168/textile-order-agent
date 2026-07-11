import unittest

from colorbridge_orders import reset_task_orders, run_order_demo_flow
from colorbridge_visual import build_workflow_panel_props


class ColorBridgeVisualTest(unittest.TestCase):
    def setUp(self):
        reset_task_orders()

    def test_workflow_panel_props_include_order_recipe_and_tracking(self):
        order, _ = run_order_demo_flow("客户要高级一点的雾霾蓝，别太紫，做在棉针织上")

        props = build_workflow_panel_props(order)

        self.assertEqual(props["order"]["order_id"], "CB-20260712-001")
        self.assertEqual(props["intent"]["color_name"], "雾霾蓝")
        self.assertEqual(props["selected_batch"]["batch_no"], "HB-COT-20260512-001")
        self.assertEqual(props["recipe"]["version"], "V1")
        self.assertGreaterEqual(len(props["formula"]), 3)
        self.assertIn("temperature", props["process_params"])
        self.assertIn("target", props["color_preview"])
        self.assertIn("predicted", props["color_preview"])
        self.assertGreaterEqual(len(props["trace_events"]), 4)

    def test_workflow_panel_props_mark_formula_share(self):
        order, _ = run_order_demo_flow("客户要高级一点的雾霾蓝，别太紫，做在棉针织上")

        props = build_workflow_panel_props(order)
        total_share = sum(item["share"] for item in props["formula"])

        self.assertAlmostEqual(total_share, 100.0, places=1)
        self.assertEqual(props["tuning_defaults"]["temperature"], 60)


if __name__ == "__main__":
    unittest.main()
