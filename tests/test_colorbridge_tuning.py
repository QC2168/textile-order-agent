import unittest

from colorbridge_tuning import build_tuning_summary, format_tuning_summary


class ColorBridgeTuningTest(unittest.TestCase):
    def test_fog_blue_selects_success_batch(self):
        summary = build_tuning_summary("客户要高级一点的雾霾蓝，别太紫，做在棉针织上")

        self.assertEqual(summary["intent"]["id"], "intent_demo_fog_blue_cotton")
        self.assertEqual(summary["selected_batch"]["id"], "hist_cotton_fog_blue_001")
        self.assertEqual(summary["risk_level"], "低")

    def test_risky_nylon_case_reports_adjustment_direction(self):
        summary = build_tuning_summary("锦纶塔丝隆深紫色上次偏深，这次怎么调安全")
        advice = "；".join(summary["advice"])

        self.assertIn("升温", advice)
        self.assertIn("pH", advice)
        self.assertIn(summary["risk_level"], {"中", "高"})

    def test_formatted_summary_warns_advice_is_directional(self):
        text = format_tuning_summary(
            build_tuning_summary("腈纶围巾宝蓝要减少色花风险，找类似历史订单")
        )

        self.assertIn("调整方向", text)
        self.assertIn("调色师确认", text)


if __name__ == "__main__":
    unittest.main()
