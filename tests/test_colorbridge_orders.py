import unittest

from colorbridge_orders import (
    close_order,
    confirm_recipe,
    confirm_visual_recipe,
    create_task_order,
    create_after_sales_ticket,
    dispatch_to_workshop,
    generate_tuning_advice,
    get_recipe_card,
    get_task_order,
    list_task_orders,
    record_production_result,
    reset_task_orders,
    run_order_demo_flow,
    save_recipe_version,
    search_historical_batches,
    submit_recipe_for_review,
    update_production_status,
)


class ColorBridgeOrdersTest(unittest.TestCase):
    def setUp(self):
        reset_task_orders(full=True)

    def test_create_search_advise_and_save_recipe(self):
        order = create_task_order("客户要高级一点的雾霾蓝，别太紫，做在棉针织上")

        self.assertEqual(order["order_id"], "CB-20260712-001")
        self.assertEqual(order["workflow_status"], "需求已识别")
        self.assertEqual(order["intent"]["id"], "intent_demo_fog_blue_cotton")

        matches = search_historical_batches(order["order_id"])

        self.assertEqual(get_task_order(order["order_id"])["workflow_status"], "历史已匹配")
        self.assertEqual(matches[0]["batch_id"], "hist_cotton_fog_blue_001")
        self.assertTrue(matches[0]["selected"])

        advice = generate_tuning_advice(order["order_id"])

        self.assertEqual(advice["risk_level"], "低")
        self.assertIn("调色师确认", advice["safety_note"])
        self.assertEqual(get_task_order(order["order_id"])["workflow_status"], "调参建议已生成")

        recipe = save_recipe_version(order["order_id"])

        self.assertEqual(recipe["version"], "V1")
        self.assertEqual(recipe["status"], "草稿")
        self.assertEqual(recipe["source_batch_id"], "hist_cotton_fog_blue_001")
        self.assertEqual(get_recipe_card(order["order_id"])["recipe_id"], recipe["recipe_id"])

    def test_list_task_orders_can_filter_by_status(self):
        create_task_order("客户要高级一点的雾霾蓝，别太紫，做在棉针织上")
        order = create_task_order("锦纶塔丝隆深紫色上次偏深，这次怎么调安全？")
        search_historical_batches(order["order_id"])

        all_orders = list_task_orders()
        matched_orders = list_task_orders("历史已匹配")

        self.assertEqual(len(all_orders), 2)
        self.assertEqual([item["order_id"] for item in matched_orders], [order["order_id"]])

    def test_unknown_order_returns_none(self):
        self.assertIsNone(get_task_order("CB-NOT-FOUND"))
        self.assertEqual(search_historical_batches("CB-NOT-FOUND"), [])
        self.assertEqual(generate_tuning_advice("CB-NOT-FOUND"), {})

    def test_full_lifecycle_from_review_to_archive(self):
        order = create_task_order("客户要高级一点的雾霾蓝，别太紫，做在棉针织上")
        search_historical_batches(order["order_id"])
        generate_tuning_advice(order["order_id"])
        save_recipe_version(order["order_id"])

        self.assertEqual(submit_recipe_for_review(order["order_id"])["workflow_status"], "方案待审核")
        self.assertEqual(confirm_recipe(order["order_id"], reviewer="王工")["workflow_status"], "方案已确认")
        self.assertEqual(dispatch_to_workshop(order["order_id"])["workflow_status"], "已下发车间")
        self.assertEqual(update_production_status(order["order_id"], "生产中")["workflow_status"], "生产中")

        result = record_production_result(
            order["order_id"],
            actual_lab={"l": 62.2, "a": -3.0, "b": -12.1},
            actual_delta_e=0.7,
            rft=True,
            customer_accepted=True,
        )

        self.assertEqual(result["workflow_status"], "客户已确认")
        self.assertEqual(result["actual_delta_e"], 0.7)
        self.assertTrue(result["rft"])

        ticket = create_after_sales_ticket(order["order_id"], "客户复核", "客户要求补充 TL84 看样照片")

        self.assertEqual(ticket["status"], "处理中")
        self.assertEqual(get_task_order(order["order_id"])["workflow_status"], "售后处理中")

        archived = close_order(order["order_id"])

        self.assertEqual(archived["workflow_status"], "已归档")
        self.assertEqual(archived["after_sales_tickets"][0]["status"], "已关闭")

    def test_confirm_visual_recipe_saves_adjustments_and_confirms(self):
        order, _ = run_order_demo_flow("客户要高级一点的雾霾蓝，别太紫，做在棉针织上")

        confirmed = confirm_visual_recipe(
            order["order_id"],
            {
                "source": "visual_panel",
                "params": {"temperature": 58, "pH": 10.4, "heating_rate": 1.2, "hold_time": 45},
                "predicted_lab": {"l": 63.8, "a": -2.2, "b": -12.8},
                "risk": "低",
            },
        )

        self.assertEqual(confirmed["workflow_status"], "方案已确认")
        self.assertEqual(confirmed["recipe_cards"][-1]["version"], "V2")
        self.assertEqual(confirmed["recipe_cards"][-1]["status"], "已确认")
        self.assertTrue(confirmed["recipe_cards"][-1]["visual_confirmed"])
        self.assertEqual(confirmed["recipe_cards"][-1]["adjustments"]["source"], "visual_panel")


if __name__ == "__main__":
    unittest.main()
