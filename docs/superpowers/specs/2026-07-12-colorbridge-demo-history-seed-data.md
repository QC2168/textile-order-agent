# ColorBridge Demo 历史批次与历史匹配种子数据

## 使用边界

这份文档给 Demo 数据库或前端常量使用，字段名严格对齐前面定义的数据表：

- `historical_batch`
- `batch_match`

数据为演示用模拟历史数据，参数范围参考公开印染工艺资料和常见生产口径生成，不是可直接投产的处方单。

## `historical_batch` 字段

| 字段 | 说明 |
|---|---|
| `id` | 历史批次主键，Demo 中可直接使用固定字符串。 |
| `batch_no` | 工厂批次号，用于页面展示。 |
| `fabric` | 面料名称。 |
| `fiber_composition` | 纤维组成。 |
| `fabric_weight_gsm` | 克重，单位 g/m²。 |
| `color_name` | 历史目标颜色名称。 |
| `target_lab` | 历史目标 Lab，JSON。 |
| `actual_lab` | 历史实际 Lab，JSON。 |
| `delta_e` | 历史色差。 |
| `rft` | 是否一次成功。 |
| `reworked` | 是否回修。 |
| `dye_type` | 染料体系。 |
| `dye_formula` | 染料配方 JSON，包含染料名称、用量、单位。 |
| `process_params` | 工艺参数 JSON，包含温度、pH、浴比、盐/助剂、保温时间等。 |
| `machine_id` | 历史使用机器。 |
| `result_note` | 结果说明。 |

## `historical_batch` 种子数据

```json
[
  {
    "id": "hist_cotton_fog_blue_001",
    "batch_no": "HB-COT-20260512-001",
    "fabric": "纯棉针织汗布",
    "fiber_composition": "95%棉 + 5%氨纶",
    "fabric_weight_gsm": 180,
    "color_name": "雾霾蓝",
    "target_lab": { "l": 62.4, "a": -3.1, "b": -11.8 },
    "actual_lab": { "l": 62.1, "a": -2.9, "b": -12.0 },
    "delta_e": 0.6,
    "rft": true,
    "reworked": false,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性蓝 B-19", "dosage": 1.18, "unit": "% o.w.f." },
      { "name": "活性红 3BS", "dosage": 0.32, "unit": "% o.w.f." },
      { "name": "活性黄 3RS", "dosage": 0.08, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 60,
      "pH": 10.6,
      "liquor_ratio": 8,
      "salt": 60,
      "alkali": 20,
      "hold_time": 45,
      "heating_rate": 1.5
    },
    "machine_id": "MACHINE_03",
    "result_note": "稳定一次成功批次，可作为雾蓝主参考。"
  },
  {
    "id": "hist_cotton_fog_blue_002",
    "batch_no": "HB-COT-20260618-002",
    "fabric": "纯棉针织汗布",
    "fiber_composition": "95%棉 + 5%氨纶",
    "fabric_weight_gsm": 185,
    "color_name": "雾霾蓝",
    "target_lab": { "l": 62.4, "a": -3.1, "b": -11.8 },
    "actual_lab": { "l": 60.8, "a": -1.7, "b": -13.5 },
    "delta_e": 2.2,
    "rft": false,
    "reworked": true,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性蓝 B-19", "dosage": 1.28, "unit": "% o.w.f." },
      { "name": "活性红 3BS", "dosage": 0.38, "unit": "% o.w.f." },
      { "name": "活性黄 3RS", "dosage": 0.10, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 64,
      "pH": 10.9,
      "liquor_ratio": 8,
      "salt": 68,
      "alkali": 22,
      "hold_time": 50,
      "heating_rate": 1.8
    },
    "machine_id": "MACHINE_08",
    "result_note": "首次偏深偏蓝，回修后通过；温度和主染料偏高。"
  },
  {
    "id": "hist_cotton_sky_blue_001",
    "batch_no": "HB-COT-20260421-003",
    "fabric": "纯棉梭织府绸",
    "fiber_composition": "100%棉",
    "fabric_weight_gsm": 120,
    "color_name": "天空蓝",
    "target_lab": { "l": 70.8, "a": -5.2, "b": -18.6 },
    "actual_lab": { "l": 71.1, "a": -5.0, "b": -18.2 },
    "delta_e": 0.7,
    "rft": true,
    "reworked": false,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性蓝 B-19", "dosage": 0.62, "unit": "% o.w.f." },
      { "name": "活性黄 3RS", "dosage": 0.04, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 60,
      "pH": 10.5,
      "liquor_ratio": 10,
      "salt": 45,
      "alkali": 16,
      "hold_time": 40,
      "heating_rate": 1.5
    },
    "machine_id": "MACHINE_02",
    "result_note": "浅蓝批次，盐碱低于中深色。"
  },
  {
    "id": "hist_cotton_navy_001",
    "batch_no": "HB-COT-20260309-004",
    "fabric": "纯棉卫衣布",
    "fiber_composition": "100%棉",
    "fabric_weight_gsm": 320,
    "color_name": "藏青",
    "target_lab": { "l": 24.8, "a": 1.2, "b": -18.4 },
    "actual_lab": { "l": 24.2, "a": 1.5, "b": -18.9 },
    "delta_e": 0.9,
    "rft": true,
    "reworked": false,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性深蓝 RGB", "dosage": 3.20, "unit": "% o.w.f." },
      { "name": "活性黑 B", "dosage": 0.75, "unit": "% o.w.f." },
      { "name": "活性红 3BS", "dosage": 0.18, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 80,
      "pH": 10.8,
      "liquor_ratio": 8,
      "salt": 85,
      "alkali": 25,
      "hold_time": 60,
      "heating_rate": 1.2
    },
    "machine_id": "MACHINE_04",
    "result_note": "深色棉布稳定批次，保温时间更长。"
  },
  {
    "id": "hist_cotton_black_001",
    "batch_no": "HB-COT-20260227-005",
    "fabric": "纯棉罗纹",
    "fiber_composition": "97%棉 + 3%氨纶",
    "fabric_weight_gsm": 240,
    "color_name": "黑色",
    "target_lab": { "l": 16.5, "a": 0.3, "b": -0.8 },
    "actual_lab": { "l": 16.2, "a": 0.4, "b": -1.0 },
    "delta_e": 0.5,
    "rft": true,
    "reworked": false,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性黑 B", "dosage": 5.80, "unit": "% o.w.f." },
      { "name": "活性蓝 B-19", "dosage": 0.42, "unit": "% o.w.f." },
      { "name": "活性红 3BS", "dosage": 0.25, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 80,
      "pH": 10.9,
      "liquor_ratio": 8,
      "salt": 90,
      "alkali": 28,
      "hold_time": 70,
      "heating_rate": 1.0
    },
    "machine_id": "MACHINE_05",
    "result_note": "黑色深染批次，盐碱和保温偏高。"
  },
  {
    "id": "hist_modal_wine_001",
    "batch_no": "HB-MOD-20260408-006",
    "fabric": "莫代尔汗布",
    "fiber_composition": "95%莫代尔 + 5%氨纶",
    "fabric_weight_gsm": 170,
    "color_name": "酒红",
    "target_lab": { "l": 35.2, "a": 38.5, "b": 12.6 },
    "actual_lab": { "l": 35.8, "a": 38.1, "b": 12.9 },
    "delta_e": 0.8,
    "rft": true,
    "reworked": false,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性红 3BS", "dosage": 2.10, "unit": "% o.w.f." },
      { "name": "活性黄 3RS", "dosage": 0.32, "unit": "% o.w.f." },
      { "name": "活性蓝 B-19", "dosage": 0.18, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 60,
      "pH": 10.6,
      "liquor_ratio": 10,
      "salt": 65,
      "alkali": 20,
      "hold_time": 50,
      "heating_rate": 1.4
    },
    "machine_id": "MACHINE_06",
    "result_note": "莫代尔红相稳定，注意避免 pH 过高导致偏暗。"
  },
  {
    "id": "hist_viscose_mustard_001",
    "batch_no": "HB-VIS-20260503-007",
    "fabric": "人棉平纹",
    "fiber_composition": "100%粘胶",
    "fabric_weight_gsm": 145,
    "color_name": "姜黄",
    "target_lab": { "l": 67.5, "a": 10.4, "b": 54.0 },
    "actual_lab": { "l": 67.0, "a": 10.8, "b": 53.4 },
    "delta_e": 0.9,
    "rft": true,
    "reworked": false,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性黄 3RS", "dosage": 1.35, "unit": "% o.w.f." },
      { "name": "活性红 3BS", "dosage": 0.12, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 60,
      "pH": 10.5,
      "liquor_ratio": 10,
      "salt": 55,
      "alkali": 18,
      "hold_time": 45,
      "heating_rate": 1.5
    },
    "machine_id": "MACHINE_03",
    "result_note": "黄相清晰，一次成功。"
  },
  {
    "id": "hist_cotton_khaki_001",
    "batch_no": "HB-COT-20260601-008",
    "fabric": "纯棉斜纹",
    "fiber_composition": "100%棉",
    "fabric_weight_gsm": 260,
    "color_name": "卡其",
    "target_lab": { "l": 55.0, "a": 4.8, "b": 22.5 },
    "actual_lab": { "l": 54.6, "a": 5.1, "b": 22.1 },
    "delta_e": 0.7,
    "rft": true,
    "reworked": false,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性黄 3RS", "dosage": 0.72, "unit": "% o.w.f." },
      { "name": "活性红 3BS", "dosage": 0.18, "unit": "% o.w.f." },
      { "name": "活性蓝 B-19", "dosage": 0.10, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 60,
      "pH": 10.6,
      "liquor_ratio": 8,
      "salt": 50,
      "alkali": 18,
      "hold_time": 45,
      "heating_rate": 1.5
    },
    "machine_id": "MACHINE_02",
    "result_note": "卡其色低风险参考批次。"
  },
  {
    "id": "hist_cotton_olive_001",
    "batch_no": "HB-COT-20260611-009",
    "fabric": "纯棉针织",
    "fiber_composition": "100%棉",
    "fabric_weight_gsm": 200,
    "color_name": "橄榄绿",
    "target_lab": { "l": 43.5, "a": -13.2, "b": 23.8 },
    "actual_lab": { "l": 42.7, "a": -12.7, "b": 24.5 },
    "delta_e": 1.1,
    "rft": true,
    "reworked": false,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性黄 3RS", "dosage": 1.10, "unit": "% o.w.f." },
      { "name": "活性蓝 B-19", "dosage": 0.58, "unit": "% o.w.f." },
      { "name": "活性红 3BS", "dosage": 0.08, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 60,
      "pH": 10.7,
      "liquor_ratio": 8,
      "salt": 62,
      "alkali": 20,
      "hold_time": 50,
      "heating_rate": 1.4
    },
    "machine_id": "MACHINE_04",
    "result_note": "绿相略黄但在可接受范围。"
  },
  {
    "id": "hist_cotton_purple_001",
    "batch_no": "HB-COT-20260529-010",
    "fabric": "纯棉卫衣布",
    "fiber_composition": "100%棉",
    "fabric_weight_gsm": 300,
    "color_name": "紫色",
    "target_lab": { "l": 39.8, "a": 28.6, "b": -24.5 },
    "actual_lab": { "l": 38.1, "a": 31.2, "b": -26.0 },
    "delta_e": 2.4,
    "rft": false,
    "reworked": true,
    "dye_type": "活性染料",
    "dye_formula": [
      { "name": "活性红 3BS", "dosage": 1.55, "unit": "% o.w.f." },
      { "name": "活性蓝 B-19", "dosage": 1.42, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 66,
      "pH": 11.2,
      "liquor_ratio": 8,
      "salt": 72,
      "alkali": 25,
      "hold_time": 55,
      "heating_rate": 1.9
    },
    "machine_id": "MACHINE_08",
    "result_note": "pH 和温度偏高，首次偏深偏紫。"
  },
  {
    "id": "hist_polyester_royal_blue_001",
    "batch_no": "HB-PET-20260316-001",
    "fabric": "涤纶春亚纺",
    "fiber_composition": "100%涤纶",
    "fabric_weight_gsm": 95,
    "color_name": "宝蓝",
    "target_lab": { "l": 31.2, "a": 4.0, "b": -39.5 },
    "actual_lab": { "l": 31.0, "a": 4.3, "b": -39.0 },
    "delta_e": 0.6,
    "rft": true,
    "reworked": false,
    "dye_type": "分散染料",
    "dye_formula": [
      { "name": "分散蓝 2BLN", "dosage": 1.85, "unit": "% o.w.f." },
      { "name": "分散紫 HFRL", "dosage": 0.10, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 130,
      "pH": 5.0,
      "liquor_ratio": 10,
      "dispersant": 1.0,
      "leveling_agent": 0.5,
      "hold_time": 45,
      "heating_rate": 1.5
    },
    "machine_id": "MACHINE_11",
    "result_note": "涤纶宝蓝标准批次。"
  },
  {
    "id": "hist_polyester_black_001",
    "batch_no": "HB-PET-20260218-002",
    "fabric": "涤纶四面弹",
    "fiber_composition": "92%涤纶 + 8%氨纶",
    "fabric_weight_gsm": 180,
    "color_name": "黑色",
    "target_lab": { "l": 15.8, "a": 0.4, "b": -1.5 },
    "actual_lab": { "l": 16.6, "a": 0.2, "b": -1.0 },
    "delta_e": 1.0,
    "rft": true,
    "reworked": false,
    "dye_type": "分散染料",
    "dye_formula": [
      { "name": "分散黑 ECO", "dosage": 4.80, "unit": "% o.w.f." },
      { "name": "分散蓝 2BLN", "dosage": 0.35, "unit": "% o.w.f." },
      { "name": "分散红玉 S-5BL", "dosage": 0.20, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 130,
      "pH": 5.0,
      "liquor_ratio": 10,
      "dispersant": 1.2,
      "leveling_agent": 0.6,
      "hold_time": 60,
      "heating_rate": 1.2
    },
    "machine_id": "MACHINE_12",
    "result_note": "氨纶混纺黑色，温度不能过高。"
  },
  {
    "id": "hist_polyester_champagne_001",
    "batch_no": "HB-PET-20260522-003",
    "fabric": "涤纶仿真丝",
    "fiber_composition": "100%涤纶",
    "fabric_weight_gsm": 110,
    "color_name": "香槟米",
    "target_lab": { "l": 76.5, "a": 3.2, "b": 18.8 },
    "actual_lab": { "l": 76.9, "a": 3.1, "b": 18.4 },
    "delta_e": 0.6,
    "rft": true,
    "reworked": false,
    "dye_type": "分散染料",
    "dye_formula": [
      { "name": "分散黄棕 SE-R", "dosage": 0.18, "unit": "% o.w.f." },
      { "name": "分散红玉 S-5BL", "dosage": 0.035, "unit": "% o.w.f." },
      { "name": "分散蓝 2BLN", "dosage": 0.015, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 130,
      "pH": 5.2,
      "liquor_ratio": 12,
      "dispersant": 0.8,
      "leveling_agent": 0.6,
      "hold_time": 35,
      "heating_rate": 1.5
    },
    "machine_id": "MACHINE_11",
    "result_note": "浅米色，低染料用量，色差稳定。"
  },
  {
    "id": "hist_polyester_cotton_gray_001",
    "batch_no": "HB-PET-20260526-004",
    "fabric": "涤棉混纺布",
    "fiber_composition": "65%涤纶 + 35%棉",
    "fabric_weight_gsm": 210,
    "color_name": "中灰",
    "target_lab": { "l": 48.0, "a": 0.2, "b": -1.0 },
    "actual_lab": { "l": 47.2, "a": 0.5, "b": -1.4 },
    "delta_e": 1.0,
    "rft": true,
    "reworked": false,
    "dye_type": "分散染料",
    "dye_formula": [
      { "name": "分散黑 ECO", "dosage": 1.10, "unit": "% o.w.f." },
      { "name": "分散蓝 2BLN", "dosage": 0.10, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 130,
      "pH": 5.0,
      "liquor_ratio": 10,
      "dispersant": 1.0,
      "leveling_agent": 0.5,
      "hold_time": 45,
      "heating_rate": 1.3
    },
    "machine_id": "MACHINE_12",
    "result_note": "仅记录涤纶段，棉段需另行活性套染。"
  },
  {
    "id": "hist_polyester_ink_green_001",
    "batch_no": "HB-PET-20260602-005",
    "fabric": "涤纶桃皮绒",
    "fiber_composition": "100%涤纶",
    "fabric_weight_gsm": 150,
    "color_name": "墨绿",
    "target_lab": { "l": 28.0, "a": -19.0, "b": 9.5 },
    "actual_lab": { "l": 26.5, "a": -20.8, "b": 8.7 },
    "delta_e": 2.2,
    "rft": false,
    "reworked": true,
    "dye_type": "分散染料",
    "dye_formula": [
      { "name": "分散蓝 2BLN", "dosage": 1.55, "unit": "% o.w.f." },
      { "name": "分散黄棕 SE-R", "dosage": 1.10, "unit": "% o.w.f." },
      { "name": "分散黑 ECO", "dosage": 0.25, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 135,
      "pH": 4.4,
      "liquor_ratio": 10,
      "dispersant": 0.6,
      "leveling_agent": 0.3,
      "hold_time": 60,
      "heating_rate": 2.0
    },
    "machine_id": "MACHINE_14",
    "result_note": "分散剂偏低且升温过快，首次色花偏深。"
  },
  {
    "id": "hist_polyester_peach_pink_001",
    "batch_no": "HB-PET-20260416-006",
    "fabric": "涤纶雪纺",
    "fiber_composition": "100%涤纶",
    "fabric_weight_gsm": 75,
    "color_name": "桃粉",
    "target_lab": { "l": 72.0, "a": 22.5, "b": 4.5 },
    "actual_lab": { "l": 72.4, "a": 22.1, "b": 4.2 },
    "delta_e": 0.7,
    "rft": true,
    "reworked": false,
    "dye_type": "分散染料",
    "dye_formula": [
      { "name": "分散红玉 S-5BL", "dosage": 0.42, "unit": "% o.w.f." },
      { "name": "分散黄棕 SE-R", "dosage": 0.035, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 130,
      "pH": 5.0,
      "liquor_ratio": 12,
      "dispersant": 0.8,
      "leveling_agent": 0.6,
      "hold_time": 35,
      "heating_rate": 1.4
    },
    "machine_id": "MACHINE_13",
    "result_note": "浅粉色，注意色花。"
  },
  {
    "id": "hist_polyester_orange_001",
    "batch_no": "HB-PET-20260328-007",
    "fabric": "涤纶牛津布",
    "fiber_composition": "100%涤纶",
    "fabric_weight_gsm": 240,
    "color_name": "橙色",
    "target_lab": { "l": 58.0, "a": 32.0, "b": 45.0 },
    "actual_lab": { "l": 57.6, "a": 32.8, "b": 44.5 },
    "delta_e": 0.9,
    "rft": true,
    "reworked": false,
    "dye_type": "分散染料",
    "dye_formula": [
      { "name": "分散橙 S-4RL", "dosage": 1.35, "unit": "% o.w.f." },
      { "name": "分散黄棕 SE-R", "dosage": 0.45, "unit": "% o.w.f." },
      { "name": "分散红玉 S-5BL", "dosage": 0.18, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 130,
      "pH": 5.0,
      "liquor_ratio": 10,
      "dispersant": 1.0,
      "leveling_agent": 0.5,
      "hold_time": 45,
      "heating_rate": 1.5
    },
    "machine_id": "MACHINE_15",
    "result_note": "橙色批次，红黄比例稳定。"
  },
  {
    "id": "hist_nylon_lake_blue_001",
    "batch_no": "HB-NYL-20260507-001",
    "fabric": "锦纶塔丝隆",
    "fiber_composition": "100%锦纶6",
    "fabric_weight_gsm": 120,
    "color_name": "湖蓝",
    "target_lab": { "l": 55.0, "a": -18.0, "b": -28.0 },
    "actual_lab": { "l": 55.4, "a": -17.7, "b": -28.4 },
    "delta_e": 0.7,
    "rft": true,
    "reworked": false,
    "dye_type": "酸性染料",
    "dye_formula": [
      { "name": "酸性蓝 25", "dosage": 0.95, "unit": "% o.w.f." },
      { "name": "酸性黄 49", "dosage": 0.05, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 98,
      "pH": 5.0,
      "liquor_ratio": 12,
      "leveling_agent": 1.0,
      "acetic_acid": 0.8,
      "hold_time": 45,
      "heating_rate": 1.2
    },
    "machine_id": "MACHINE_21",
    "result_note": "锦纶蓝色稳定批次。"
  },
  {
    "id": "hist_nylon_rose_001",
    "batch_no": "HB-NYL-20260430-002",
    "fabric": "锦纶弹力布",
    "fiber_composition": "88%锦纶 + 12%氨纶",
    "fabric_weight_gsm": 160,
    "color_name": "玫红",
    "target_lab": { "l": 48.0, "a": 51.0, "b": 2.0 },
    "actual_lab": { "l": 47.5, "a": 51.8, "b": 1.4 },
    "delta_e": 1.0,
    "rft": true,
    "reworked": false,
    "dye_type": "酸性染料",
    "dye_formula": [
      { "name": "酸性红 337", "dosage": 1.25, "unit": "% o.w.f." },
      { "name": "酸性蓝 25", "dosage": 0.04, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 95,
      "pH": 5.2,
      "liquor_ratio": 12,
      "leveling_agent": 1.2,
      "acetic_acid": 0.7,
      "hold_time": 40,
      "heating_rate": 1.0
    },
    "machine_id": "MACHINE_22",
    "result_note": "弹力锦纶需控制升温，避免不匀。"
  },
  {
    "id": "hist_nylon_deep_purple_001",
    "batch_no": "HB-NYL-20260606-003",
    "fabric": "锦纶塔丝隆",
    "fiber_composition": "100%锦纶6",
    "fabric_weight_gsm": 130,
    "color_name": "深紫",
    "target_lab": { "l": 30.5, "a": 35.0, "b": -30.0 },
    "actual_lab": { "l": 28.8, "a": 37.5, "b": -31.2 },
    "delta_e": 2.5,
    "rft": false,
    "reworked": true,
    "dye_type": "酸性染料",
    "dye_formula": [
      { "name": "酸性红 337", "dosage": 1.40, "unit": "% o.w.f." },
      { "name": "酸性蓝 25", "dosage": 1.20, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 100,
      "pH": 4.0,
      "liquor_ratio": 10,
      "leveling_agent": 0.5,
      "acetic_acid": 1.5,
      "hold_time": 60,
      "heating_rate": 1.8
    },
    "machine_id": "MACHINE_23",
    "result_note": "pH 偏低、升温过快，首次偏深且不匀。"
  },
  {
    "id": "hist_nylon_light_gray_001",
    "batch_no": "HB-NYL-20260322-004",
    "fabric": "锦纶纱线",
    "fiber_composition": "100%锦纶66",
    "fabric_weight_gsm": 90,
    "color_name": "浅灰",
    "target_lab": { "l": 68.0, "a": 0.0, "b": -1.0 },
    "actual_lab": { "l": 68.5, "a": -0.2, "b": -0.8 },
    "delta_e": 0.6,
    "rft": true,
    "reworked": false,
    "dye_type": "酸性染料",
    "dye_formula": [
      { "name": "酸性黑 194", "dosage": 0.22, "unit": "% o.w.f." },
      { "name": "酸性蓝 25", "dosage": 0.015, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 95,
      "pH": 5.5,
      "liquor_ratio": 15,
      "leveling_agent": 1.2,
      "acetic_acid": 0.5,
      "hold_time": 35,
      "heating_rate": 1.0
    },
    "machine_id": "MACHINE_21",
    "result_note": "浅灰批次，浴比偏大以保证匀染。"
  },
  {
    "id": "hist_nylon_army_green_001",
    "batch_no": "HB-NYL-20260519-005",
    "fabric": "锦纶双肩包布",
    "fiber_composition": "100%锦纶",
    "fabric_weight_gsm": 260,
    "color_name": "军绿",
    "target_lab": { "l": 36.0, "a": -10.5, "b": 17.5 },
    "actual_lab": { "l": 35.7, "a": -10.1, "b": 18.0 },
    "delta_e": 0.8,
    "rft": true,
    "reworked": false,
    "dye_type": "酸性染料",
    "dye_formula": [
      { "name": "酸性黄 49", "dosage": 0.82, "unit": "% o.w.f." },
      { "name": "酸性蓝 25", "dosage": 0.46, "unit": "% o.w.f." },
      { "name": "酸性红 337", "dosage": 0.06, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 98,
      "pH": 5.0,
      "liquor_ratio": 10,
      "leveling_agent": 1.0,
      "acetic_acid": 0.8,
      "hold_time": 50,
      "heating_rate": 1.1
    },
    "machine_id": "MACHINE_24",
    "result_note": "军绿批次，黄蓝比例稳定。"
  },
  {
    "id": "hist_acrylic_red_001",
    "batch_no": "HB-ACR-20260411-001",
    "fabric": "腈纶针织",
    "fiber_composition": "100%腈纶",
    "fabric_weight_gsm": 220,
    "color_name": "正红",
    "target_lab": { "l": 43.0, "a": 55.0, "b": 28.0 },
    "actual_lab": { "l": 43.3, "a": 54.2, "b": 28.4 },
    "delta_e": 0.9,
    "rft": true,
    "reworked": false,
    "dye_type": "阳离子染料",
    "dye_formula": [
      { "name": "阳离子红 X-GRL", "dosage": 1.20, "unit": "% o.w.f." },
      { "name": "阳离子黄 X-GL", "dosage": 0.20, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 98,
      "pH": 4.8,
      "liquor_ratio": 15,
      "retarder": 0.8,
      "sodium_acetate": 0.6,
      "hold_time": 50,
      "heating_rate": 0.8
    },
    "machine_id": "MACHINE_31",
    "result_note": "腈纶红色，升温较慢，避免色花。"
  },
  {
    "id": "hist_acrylic_violet_001",
    "batch_no": "HB-ACR-20260604-002",
    "fabric": "腈纶毛衫",
    "fiber_composition": "100%腈纶",
    "fabric_weight_gsm": 280,
    "color_name": "紫罗兰",
    "target_lab": { "l": 38.0, "a": 32.0, "b": -31.0 },
    "actual_lab": { "l": 37.4, "a": 32.8, "b": -31.5 },
    "delta_e": 0.9,
    "rft": true,
    "reworked": false,
    "dye_type": "阳离子染料",
    "dye_formula": [
      { "name": "阳离子红 X-GRL", "dosage": 0.88, "unit": "% o.w.f." },
      { "name": "阳离子蓝 X-BL", "dosage": 0.95, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 98,
      "pH": 4.7,
      "liquor_ratio": 15,
      "retarder": 1.0,
      "sodium_acetate": 0.6,
      "hold_time": 55,
      "heating_rate": 0.7
    },
    "machine_id": "MACHINE_32",
    "result_note": "紫罗兰批次，缓染剂充分。"
  },
  {
    "id": "hist_acrylic_royal_blue_001",
    "batch_no": "HB-ACR-20260531-003",
    "fabric": "腈纶围巾",
    "fiber_composition": "100%腈纶",
    "fabric_weight_gsm": 180,
    "color_name": "宝蓝",
    "target_lab": { "l": 30.0, "a": 8.0, "b": -42.0 },
    "actual_lab": { "l": 28.5, "a": 8.8, "b": -43.2 },
    "delta_e": 2.1,
    "rft": false,
    "reworked": true,
    "dye_type": "阳离子染料",
    "dye_formula": [
      { "name": "阳离子蓝 X-BL", "dosage": 1.95, "unit": "% o.w.f." },
      { "name": "阳离子红 X-GRL", "dosage": 0.08, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 100,
      "pH": 4.2,
      "liquor_ratio": 12,
      "retarder": 0.3,
      "sodium_acetate": 0.3,
      "hold_time": 60,
      "heating_rate": 1.5
    },
    "machine_id": "MACHINE_33",
    "result_note": "缓染剂不足且升温过快，首次偏深。"
  },
  {
    "id": "hist_acrylic_off_white_001",
    "batch_no": "HB-ACR-20260312-004",
    "fabric": "腈纶针织",
    "fiber_composition": "100%腈纶",
    "fabric_weight_gsm": 210,
    "color_name": "米白",
    "target_lab": { "l": 84.0, "a": 1.0, "b": 8.0 },
    "actual_lab": { "l": 84.5, "a": 0.8, "b": 7.6 },
    "delta_e": 0.7,
    "rft": true,
    "reworked": false,
    "dye_type": "阳离子染料",
    "dye_formula": [
      { "name": "阳离子黄 X-GL", "dosage": 0.045, "unit": "% o.w.f." },
      { "name": "阳离子红 X-GRL", "dosage": 0.006, "unit": "% o.w.f." }
    ],
    "process_params": {
      "temperature": 95,
      "pH": 5.0,
      "liquor_ratio": 18,
      "retarder": 1.0,
      "sodium_acetate": 0.5,
      "hold_time": 35,
      "heating_rate": 0.8
    },
    "machine_id": "MACHINE_31",
    "result_note": "浅色腈纶，低染料量，浴比偏大。"
  }
]
```

## `batch_match` 字段

| 字段 | 说明 |
|---|---|
| `id` | 历史匹配记录主键。 |
| `intent_id` | 关联 `intent_request.id`。 |
| `batch_id` | 关联 `historical_batch.id`。 |
| `similarity_score` | 相似度评分，0-1。 |
| `rank` | 当前意图下的匹配排序。 |
| `difference_note` | 当前需求与历史批次的差异说明。 |
| `risk_note` | 采用该历史批次作为参考时的风险说明。 |
| `selected` | 是否被选为基础方案。 |

## Demo 意图上下文

`batch_match` 必须绑定某一次用户输入，因此这里先定义 4 个 Demo 意图 ID：

```json
[
  {
    "id": "intent_demo_fog_blue_cotton",
    "raw_text": "客户要高级一点的雾霾蓝，别太紫，做在棉针织上。",
    "intent_type": "方案生成",
    "fabric": "纯棉针织汗布",
    "color_name": "雾霾蓝",
    "target_lab": { "l": 62.4, "a": -3.1, "b": -11.8 },
    "dye_type": "活性染料",
    "confidence": 0.88
  },
  {
    "id": "intent_demo_polyester_black",
    "raw_text": "涤纶四面弹要做一个稳定黑色，看下历史配方。",
    "intent_type": "历史查询",
    "fabric": "涤纶四面弹",
    "color_name": "黑色",
    "target_lab": { "l": 15.8, "a": 0.4, "b": -1.5 },
    "dye_type": "分散染料",
    "confidence": 0.91
  },
  {
    "id": "intent_demo_nylon_purple",
    "raw_text": "锦纶塔丝隆深紫色上次偏深，这次怎么调安全？",
    "intent_type": "模拟调参",
    "fabric": "锦纶塔丝隆",
    "color_name": "深紫",
    "target_lab": { "l": 30.5, "a": 35.0, "b": -30.0 },
    "dye_type": "酸性染料",
    "confidence": 0.86
  },
  {
    "id": "intent_demo_acrylic_royal_blue",
    "raw_text": "腈纶围巾宝蓝要减少色花风险，找类似历史订单。",
    "intent_type": "风险预警",
    "fabric": "腈纶围巾",
    "color_name": "宝蓝",
    "target_lab": { "l": 30.0, "a": 8.0, "b": -42.0 },
    "dye_type": "阳离子染料",
    "confidence": 0.84
  }
]
```

## `batch_match` 种子数据

```json
[
  {
    "id": "match_fog_blue_001",
    "intent_id": "intent_demo_fog_blue_cotton",
    "batch_id": "hist_cotton_fog_blue_001",
    "similarity_score": 0.96,
    "rank": 1,
    "difference_note": "面料、纤维组成、颜色名和目标 Lab 基本一致，克重差异在 5% 内。",
    "risk_note": "可直接作为基础方案；仍需确认本次基布白度和客户看样光源。",
    "selected": true
  },
  {
    "id": "match_fog_blue_002",
    "intent_id": "intent_demo_fog_blue_cotton",
    "batch_id": "hist_cotton_fog_blue_002",
    "similarity_score": 0.90,
    "rank": 2,
    "difference_note": "同面料同色系，但该批次首次偏深偏蓝且发生回修。",
    "risk_note": "不要直接复用其高温和高主染料比例，可作为风险反例。",
    "selected": false
  },
  {
    "id": "match_fog_blue_003",
    "intent_id": "intent_demo_fog_blue_cotton",
    "batch_id": "hist_cotton_sky_blue_001",
    "similarity_score": 0.72,
    "rank": 3,
    "difference_note": "同为棉活性蓝色系，但颜色更浅、更亮，织物为梭织府绸。",
    "risk_note": "只适合参考蓝相方向，不适合直接复用染料用量。",
    "selected": false
  },
  {
    "id": "match_fog_blue_004",
    "intent_id": "intent_demo_fog_blue_cotton",
    "batch_id": "hist_cotton_navy_001",
    "similarity_score": 0.64,
    "rank": 4,
    "difference_note": "同为棉活性蓝色系，但藏青深度明显更深，温度和盐碱更高。",
    "risk_note": "仅用于提示深色方案的盐碱和保温上限，不建议直接套用。",
    "selected": false
  },
  {
    "id": "match_fog_blue_005",
    "intent_id": "intent_demo_fog_blue_cotton",
    "batch_id": "hist_cotton_purple_001",
    "similarity_score": 0.48,
    "rank": 5,
    "difference_note": "同为棉活性体系，但色相偏紫且有回修记录。",
    "risk_note": "用于解释客户“别太紫”的风险来源，不能作为基础方案。",
    "selected": false
  },
  {
    "id": "match_poly_black_001",
    "intent_id": "intent_demo_polyester_black",
    "batch_id": "hist_polyester_black_001",
    "similarity_score": 0.97,
    "rank": 1,
    "difference_note": "面料、颜色和染料体系完全匹配，实际 Delta E 为 1.0。",
    "risk_note": "可作为基础方案；需注意氨纶混纺温度上限。",
    "selected": true
  },
  {
    "id": "match_poly_black_002",
    "intent_id": "intent_demo_polyester_black",
    "batch_id": "hist_polyester_cotton_gray_001",
    "similarity_score": 0.61,
    "rank": 2,
    "difference_note": "同为分散染料体系，但为涤棉中灰，深度远低于黑色。",
    "risk_note": "只能参考分散段工艺条件，不适合参考染料浓度。",
    "selected": false
  },
  {
    "id": "match_poly_black_003",
    "intent_id": "intent_demo_polyester_black",
    "batch_id": "hist_polyester_ink_green_001",
    "similarity_score": 0.55,
    "rank": 3,
    "difference_note": "同为涤纶中深色，但该批次有升温过快和色花回修记录。",
    "risk_note": "用于提示分散染料升温速率和分散剂不足风险。",
    "selected": false
  },
  {
    "id": "match_poly_black_004",
    "intent_id": "intent_demo_polyester_black",
    "batch_id": "hist_polyester_royal_blue_001",
    "similarity_score": 0.50,
    "rank": 4,
    "difference_note": "同为涤纶分散染料，但色相为宝蓝，黑色配方不可直接参考。",
    "risk_note": "只参考 130°C、pH5 左右的分散染料基础工艺窗口。",
    "selected": false
  },
  {
    "id": "match_poly_black_005",
    "intent_id": "intent_demo_polyester_black",
    "batch_id": "hist_cotton_black_001",
    "similarity_score": 0.35,
    "rank": 5,
    "difference_note": "颜色同为黑色，但面料和染料体系完全不同。",
    "risk_note": "不可复用配方，只可用于跨材质说明深色风险。",
    "selected": false
  },
  {
    "id": "match_nylon_purple_001",
    "intent_id": "intent_demo_nylon_purple",
    "batch_id": "hist_nylon_deep_purple_001",
    "similarity_score": 0.95,
    "rank": 1,
    "difference_note": "面料、颜色、染料体系完全匹配，但历史结果为回修批次。",
    "risk_note": "这是关键风险样本：pH 偏低、升温过快、匀染剂不足会导致偏深不匀。",
    "selected": true
  },
  {
    "id": "match_nylon_purple_002",
    "intent_id": "intent_demo_nylon_purple",
    "batch_id": "hist_nylon_rose_001",
    "similarity_score": 0.62,
    "rank": 2,
    "difference_note": "同为锦纶酸性体系，红相接近，但不是紫色目标。",
    "risk_note": "可参考 95°C、pH5.2、慢升温的安全窗口。",
    "selected": false
  },
  {
    "id": "match_nylon_purple_003",
    "intent_id": "intent_demo_nylon_purple",
    "batch_id": "hist_nylon_lake_blue_001",
    "similarity_score": 0.58,
    "rank": 3,
    "difference_note": "同为锦纶酸性体系，蓝相接近但缺少红相。",
    "risk_note": "可参考湖蓝批次的匀染剂和 pH 控制，不可直接复用染料比例。",
    "selected": false
  },
  {
    "id": "match_nylon_purple_004",
    "intent_id": "intent_demo_nylon_purple",
    "batch_id": "hist_acrylic_violet_001",
    "similarity_score": 0.36,
    "rank": 4,
    "difference_note": "颜色相近，但腈纶阳离子体系与锦纶酸性体系不同。",
    "risk_note": "不可复用配方，仅可用于色相展示。",
    "selected": false
  },
  {
    "id": "match_acrylic_blue_001",
    "intent_id": "intent_demo_acrylic_royal_blue",
    "batch_id": "hist_acrylic_royal_blue_001",
    "similarity_score": 0.96,
    "rank": 1,
    "difference_note": "面料、颜色、染料体系完全匹配，但历史批次发生回修。",
    "risk_note": "关键风险样本：缓染剂不足和升温过快导致偏深色花。",
    "selected": true
  },
  {
    "id": "match_acrylic_blue_002",
    "intent_id": "intent_demo_acrylic_royal_blue",
    "batch_id": "hist_acrylic_violet_001",
    "similarity_score": 0.64,
    "rank": 2,
    "difference_note": "同为腈纶阳离子体系，蓝相参与较多，但红相更高。",
    "risk_note": "可参考缓染剂 1.0g/L 和 0.7°C/min 慢升温策略。",
    "selected": false
  },
  {
    "id": "match_acrylic_blue_003",
    "intent_id": "intent_demo_acrylic_royal_blue",
    "batch_id": "hist_polyester_royal_blue_001",
    "similarity_score": 0.42,
    "rank": 3,
    "difference_note": "颜色同为宝蓝，但涤纶分散体系和腈纶阳离子体系不同。",
    "risk_note": "不可复用配方和工艺，只作为颜色方向参考。",
    "selected": false
  },
  {
    "id": "match_acrylic_blue_004",
    "intent_id": "intent_demo_acrylic_royal_blue",
    "batch_id": "hist_nylon_lake_blue_001",
    "similarity_score": 0.38,
    "rank": 4,
    "difference_note": "色相接近蓝色系，但锦纶酸性体系不同。",
    "risk_note": "不可复用配方，可用于解释不同纤维体系的工艺差异。",
    "selected": false
  }
]
```

## 匹配数据生成规则

Demo 中 `similarity_score` 可以按以下权重解释：

| 因素 | 权重 | 说明 |
|---|---:|---|
| 面料/纤维组成一致 | 0.30 | 同纤维体系优先。 |
| 染料体系一致 | 0.25 | 活性、分散、酸性、阳离子不能互相直接复用。 |
| 颜色名/色系接近 | 0.20 | 同色名最高，同色系次之。 |
| Lab 距离接近 | 0.15 | 目标 Lab 越近越高。 |
| RFT 成功记录 | 0.10 | 一次成功优先；回修批次可作为风险反例。 |

## 页面使用建议

- Top 1 且 `rft=true`：显示“可作为基础方案”。
- Top 1 但 `rft=false`：显示“高相似风险案例”，AI 应建议回避历史失败参数。
- `dye_type` 不一致：必须提示“不可直接复用配方”。
- `selected=true` 的匹配记录作为 `tuning_recipe.base_batch_id` 的来源。
