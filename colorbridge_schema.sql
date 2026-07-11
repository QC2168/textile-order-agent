-- ============================================================
-- ColorBridge Demo SQLite 数据库
-- 生成日期: 2026-07-12
-- 包含: 6 张主表 + 种子数据
-- ============================================================

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. 用户意图表 intent_request
-- ============================================================
CREATE TABLE IF NOT EXISTS intent_request (
    id              TEXT PRIMARY KEY,
    raw_text        TEXT NOT NULL,
    intent_type     TEXT NOT NULL DEFAULT '方案生成',
    fabric          TEXT,
    color_name      TEXT,
    target_lab      TEXT,           -- JSON: {"l":62.4,"a":-3.1,"b":-11.8}
    dye_type        TEXT,
    confidence      REAL DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================
-- 2. 历史批次表 historical_batch
-- ============================================================
CREATE TABLE IF NOT EXISTS historical_batch (
    id                  TEXT PRIMARY KEY,
    batch_no            TEXT NOT NULL,
    fabric              TEXT NOT NULL,
    fiber_composition   TEXT,
    fabric_weight_gsm   INTEGER,
    color_name          TEXT NOT NULL,
    target_lab          TEXT NOT NULL,  -- JSON
    actual_lab          TEXT NOT NULL,  -- JSON
    delta_e             REAL NOT NULL,
    rft                 INTEGER NOT NULL DEFAULT 1,  -- 1=true, 0=false
    reworked            INTEGER NOT NULL DEFAULT 0,
    dye_type            TEXT NOT NULL,
    dye_formula         TEXT NOT NULL,  -- JSON array
    process_params      TEXT NOT NULL,  -- JSON object
    machine_id          TEXT,
    result_note         TEXT
);

-- ============================================================
-- 3. 历史匹配表 batch_match
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_match (
    id                  TEXT PRIMARY KEY,
    intent_id           TEXT NOT NULL,
    batch_id            TEXT NOT NULL,
    similarity_score    REAL NOT NULL,
    rank                INTEGER NOT NULL,
    difference_note     TEXT,
    risk_note           TEXT,
    selected            INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (intent_id) REFERENCES intent_request(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id)  REFERENCES historical_batch(id) ON DELETE CASCADE
);

-- ============================================================
-- 4. 调参方案表 tuning_recipe
-- ============================================================
CREATE TABLE IF NOT EXISTS tuning_recipe (
    id              TEXT PRIMARY KEY,
    intent_id       TEXT NOT NULL,
    base_batch_id   TEXT,
    version         TEXT NOT NULL DEFAULT 'V1',
    current_formula TEXT,           -- JSON: dye formula array
    current_params  TEXT,           -- JSON: process params object
    locked_params   TEXT,           -- JSON: locked parameter names
    deviations      TEXT,           -- JSON: deviation array
    risk_level      TEXT DEFAULT '低',
    warnings        TEXT,           -- JSON: warning list
    status          TEXT NOT NULL DEFAULT '草稿',
    created_at      TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (intent_id)     REFERENCES intent_request(id)    ON DELETE CASCADE,
    FOREIGN KEY (base_batch_id) REFERENCES historical_batch(id)  ON DELETE SET NULL
);

-- ============================================================
-- 5. 方案卡表 recipe_card
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_card (
    id              TEXT PRIMARY KEY,
    recipe_id       TEXT NOT NULL,
    recipe_no       TEXT,
    version         TEXT NOT NULL,
    fabric          TEXT,
    color_name      TEXT,
    target_lab      TEXT,           -- JSON
    dye_formula     TEXT,           -- JSON
    process_params  TEXT,           -- JSON
    source_batch_id TEXT,
    optical_preview TEXT,           -- JSON
    risk_notes      TEXT,           -- JSON
    checklist       TEXT,           -- JSON
    status          TEXT NOT NULL DEFAULT '草稿',
    created_at      TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (recipe_id)       REFERENCES tuning_recipe(id)     ON DELETE CASCADE,
    FOREIGN KEY (source_batch_id) REFERENCES historical_batch(id)  ON DELETE SET NULL
);

-- ============================================================
-- 6. 订单追踪表 order_trace
-- ============================================================
CREATE TABLE IF NOT EXISTS order_trace (
    id              TEXT PRIMARY KEY,
    order_no        TEXT NOT NULL,
    customer_name   TEXT,
    intent_id       TEXT NOT NULL,
    recipe_card_id  TEXT,
    workflow_status TEXT NOT NULL DEFAULT '需求已识别',
    predicted_risk  TEXT DEFAULT '低',
    actual_lab      TEXT,           -- JSON
    actual_delta_e  REAL,
    rft             INTEGER,        -- 1=true, 0=false, NULL=未完成
    summary         TEXT,
    trace_events    TEXT,           -- JSON array
    updated_at      TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (intent_id)      REFERENCES intent_request(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_card_id) REFERENCES recipe_card(id)    ON DELETE SET NULL
);

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_intent_type   ON intent_request(intent_type);
CREATE INDEX IF NOT EXISTS idx_batch_color   ON historical_batch(color_name);
CREATE INDEX IF NOT EXISTS idx_batch_fabric  ON historical_batch(fabric);
CREATE INDEX IF NOT EXISTS idx_batch_dye     ON historical_batch(dye_type);
CREATE INDEX IF NOT EXISTS idx_match_intent  ON batch_match(intent_id);
CREATE INDEX IF NOT EXISTS idx_match_batch   ON batch_match(batch_id);
CREATE INDEX IF NOT EXISTS idx_recipe_intent ON tuning_recipe(intent_id);
CREATE INDEX IF NOT EXISTS idx_trace_status  ON order_trace(workflow_status);


-- ============================================================
-- 种子数据: 历史批次 (25 条)
-- ============================================================

INSERT INTO historical_batch (id, batch_no, fabric, fiber_composition, fabric_weight_gsm, color_name, target_lab, actual_lab, delta_e, rft, reworked, dye_type, dye_formula, process_params, machine_id, result_note) VALUES
('hist_cotton_fog_blue_001', 'HB-COT-20260512-001', '纯棉针织汗布', '95%棉 + 5%氨纶', 180, '雾霾蓝',
 '{"l":62.4,"a":-3.1,"b":-11.8}', '{"l":62.1,"a":-2.9,"b":-12.0}', 0.6, 1, 0, '活性染料',
 '[{"name":"活性蓝 B-19","dosage":1.18,"unit":"% o.w.f."},{"name":"活性红 3BS","dosage":0.32,"unit":"% o.w.f."},{"name":"活性黄 3RS","dosage":0.08,"unit":"% o.w.f."}]',
 '{"temperature":60,"pH":10.6,"liquor_ratio":8,"salt":60,"alkali":20,"hold_time":45,"heating_rate":1.5}',
 'MACHINE_03', '稳定一次成功批次，可作为雾蓝主参考。'),

('hist_cotton_fog_blue_002', 'HB-COT-20260618-002', '纯棉针织汗布', '95%棉 + 5%氨纶', 185, '雾霾蓝',
 '{"l":62.4,"a":-3.1,"b":-11.8}', '{"l":60.8,"a":-1.7,"b":-13.5}', 2.2, 0, 1, '活性染料',
 '[{"name":"活性蓝 B-19","dosage":1.28,"unit":"% o.w.f."},{"name":"活性红 3BS","dosage":0.38,"unit":"% o.w.f."},{"name":"活性黄 3RS","dosage":0.10,"unit":"% o.w.f."}]',
 '{"temperature":64,"pH":10.9,"liquor_ratio":8,"salt":68,"alkali":22,"hold_time":50,"heating_rate":1.8}',
 'MACHINE_08', '首次偏深偏蓝，回修后通过；温度和主染料偏高。'),

('hist_cotton_sky_blue_001', 'HB-COT-20260421-003', '纯棉梭织府绸', '100%棉', 120, '天空蓝',
 '{"l":70.8,"a":-5.2,"b":-18.6}', '{"l":71.1,"a":-5.0,"b":-18.2}', 0.7, 1, 0, '活性染料',
 '[{"name":"活性蓝 B-19","dosage":0.62,"unit":"% o.w.f."},{"name":"活性黄 3RS","dosage":0.04,"unit":"% o.w.f."}]',
 '{"temperature":60,"pH":10.5,"liquor_ratio":10,"salt":45,"alkali":16,"hold_time":40,"heating_rate":1.5}',
 'MACHINE_02', '浅蓝批次，盐碱低于中深色。'),

('hist_cotton_navy_001', 'HB-COT-20260309-004', '纯棉卫衣布', '100%棉', 320, '藏青',
 '{"l":24.8,"a":1.2,"b":-18.4}', '{"l":24.2,"a":1.5,"b":-18.9}', 0.9, 1, 0, '活性染料',
 '[{"name":"活性深蓝 RGB","dosage":3.20,"unit":"% o.w.f."},{"name":"活性黑 B","dosage":0.75,"unit":"% o.w.f."},{"name":"活性红 3BS","dosage":0.18,"unit":"% o.w.f."}]',
 '{"temperature":80,"pH":10.8,"liquor_ratio":8,"salt":85,"alkali":25,"hold_time":60,"heating_rate":1.2}',
 'MACHINE_04', '深色棉布稳定批次，保温时间更长。'),

('hist_cotton_black_001', 'HB-COT-20260227-005', '纯棉罗纹', '97%棉 + 3%氨纶', 240, '黑色',
 '{"l":16.5,"a":0.3,"b":-0.8}', '{"l":16.2,"a":0.4,"b":-1.0}', 0.5, 1, 0, '活性染料',
 '[{"name":"活性黑 B","dosage":5.80,"unit":"% o.w.f."},{"name":"活性蓝 B-19","dosage":0.42,"unit":"% o.w.f."},{"name":"活性红 3BS","dosage":0.25,"unit":"% o.w.f."}]',
 '{"temperature":80,"pH":10.9,"liquor_ratio":8,"salt":90,"alkali":28,"hold_time":70,"heating_rate":1.0}',
 'MACHINE_05', '黑色深染批次，盐碱和保温偏高。'),

('hist_modal_wine_001', 'HB-MOD-20260408-006', '莫代尔汗布', '95%莫代尔 + 5%氨纶', 170, '酒红',
 '{"l":35.2,"a":38.5,"b":12.6}', '{"l":35.8,"a":38.1,"b":12.9}', 0.8, 1, 0, '活性染料',
 '[{"name":"活性红 3BS","dosage":2.10,"unit":"% o.w.f."},{"name":"活性黄 3RS","dosage":0.32,"unit":"% o.w.f."},{"name":"活性蓝 B-19","dosage":0.18,"unit":"% o.w.f."}]',
 '{"temperature":60,"pH":10.6,"liquor_ratio":10,"salt":65,"alkali":20,"hold_time":50,"heating_rate":1.4}',
 'MACHINE_06', '莫代尔红相稳定，注意避免 pH 过高导致偏暗。'),

('hist_viscose_mustard_001', 'HB-VIS-20260503-007', '人棉平纹', '100%粘胶', 145, '姜黄',
 '{"l":67.5,"a":10.4,"b":54.0}', '{"l":67.0,"a":10.8,"b":53.4}', 0.9, 1, 0, '活性染料',
 '[{"name":"活性黄 3RS","dosage":1.35,"unit":"% o.w.f."},{"name":"活性红 3BS","dosage":0.12,"unit":"% o.w.f."}]',
 '{"temperature":60,"pH":10.5,"liquor_ratio":10,"salt":55,"alkali":18,"hold_time":45,"heating_rate":1.5}',
 'MACHINE_03', '黄相清晰，一次成功。'),

('hist_cotton_khaki_001', 'HB-COT-20260601-008', '纯棉斜纹', '100%棉', 260, '卡其',
 '{"l":55.0,"a":4.8,"b":22.5}', '{"l":54.6,"a":5.1,"b":22.1}', 0.7, 1, 0, '活性染料',
 '[{"name":"活性黄 3RS","dosage":0.72,"unit":"% o.w.f."},{"name":"活性红 3BS","dosage":0.18,"unit":"% o.w.f."},{"name":"活性蓝 B-19","dosage":0.10,"unit":"% o.w.f."}]',
 '{"temperature":60,"pH":10.6,"liquor_ratio":8,"salt":50,"alkali":18,"hold_time":45,"heating_rate":1.5}',
 'MACHINE_02', '卡其色低风险参考批次。'),

('hist_cotton_olive_001', 'HB-COT-20260611-009', '纯棉针织', '100%棉', 200, '橄榄绿',
 '{"l":43.5,"a":-13.2,"b":23.8}', '{"l":42.7,"a":-12.7,"b":24.5}', 1.1, 1, 0, '活性染料',
 '[{"name":"活性黄 3RS","dosage":1.10,"unit":"% o.w.f."},{"name":"活性蓝 B-19","dosage":0.58,"unit":"% o.w.f."},{"name":"活性红 3BS","dosage":0.08,"unit":"% o.w.f."}]',
 '{"temperature":60,"pH":10.7,"liquor_ratio":8,"salt":62,"alkali":20,"hold_time":50,"heating_rate":1.4}',
 'MACHINE_04', '绿相略黄但在可接受范围。'),

('hist_cotton_purple_001', 'HB-COT-20260529-010', '纯棉卫衣布', '100%棉', 300, '紫色',
 '{"l":39.8,"a":28.6,"b":-24.5}', '{"l":38.1,"a":31.2,"b":-26.0}', 2.4, 0, 1, '活性染料',
 '[{"name":"活性红 3BS","dosage":1.55,"unit":"% o.w.f."},{"name":"活性蓝 B-19","dosage":1.42,"unit":"% o.w.f."}]',
 '{"temperature":66,"pH":11.2,"liquor_ratio":8,"salt":72,"alkali":25,"hold_time":55,"heating_rate":1.9}',
 'MACHINE_08', 'pH 和温度偏高，首次偏深偏紫。'),

('hist_polyester_royal_blue_001', 'HB-PET-20260316-001', '涤纶春亚纺', '100%涤纶', 95, '宝蓝',
 '{"l":31.2,"a":4.0,"b":-39.5}', '{"l":31.0,"a":4.3,"b":-39.0}', 0.6, 1, 0, '分散染料',
 '[{"name":"分散蓝 2BLN","dosage":1.85,"unit":"% o.w.f."},{"name":"分散紫 HFRL","dosage":0.10,"unit":"% o.w.f."}]',
 '{"temperature":130,"pH":5.0,"liquor_ratio":10,"dispersant":1.0,"leveling_agent":0.5,"hold_time":45,"heating_rate":1.5}',
 'MACHINE_11', '涤纶宝蓝标准批次。'),

('hist_polyester_black_001', 'HB-PET-20260218-002', '涤纶四面弹', '92%涤纶 + 8%氨纶', 180, '黑色',
 '{"l":15.8,"a":0.4,"b":-1.5}', '{"l":16.6,"a":0.2,"b":-1.0}', 1.0, 1, 0, '分散染料',
 '[{"name":"分散黑 ECO","dosage":4.80,"unit":"% o.w.f."},{"name":"分散蓝 2BLN","dosage":0.35,"unit":"% o.w.f."},{"name":"分散红玉 S-5BL","dosage":0.20,"unit":"% o.w.f."}]',
 '{"temperature":130,"pH":5.0,"liquor_ratio":10,"dispersant":1.2,"leveling_agent":0.6,"hold_time":60,"heating_rate":1.2}',
 'MACHINE_12', '氨纶混纺黑色，温度不能过高。'),

('hist_polyester_champagne_001', 'HB-PET-20260522-003', '涤纶仿真丝', '100%涤纶', 110, '香槟米',
 '{"l":76.5,"a":3.2,"b":18.8}', '{"l":76.9,"a":3.1,"b":18.4}', 0.6, 1, 0, '分散染料',
 '[{"name":"分散黄棕 SE-R","dosage":0.18,"unit":"% o.w.f."},{"name":"分散红玉 S-5BL","dosage":0.035,"unit":"% o.w.f."},{"name":"分散蓝 2BLN","dosage":0.015,"unit":"% o.w.f."}]',
 '{"temperature":130,"pH":5.2,"liquor_ratio":12,"dispersant":0.8,"leveling_agent":0.6,"hold_time":35,"heating_rate":1.5}',
 'MACHINE_11', '浅米色，低染料用量，色差稳定。'),

('hist_polyester_cotton_gray_001', 'HB-PET-20260526-004', '涤棉混纺布', '65%涤纶 + 35%棉', 210, '中灰',
 '{"l":48.0,"a":0.2,"b":-1.0}', '{"l":47.2,"a":0.5,"b":-1.4}', 1.0, 1, 0, '分散染料',
 '[{"name":"分散黑 ECO","dosage":1.10,"unit":"% o.w.f."},{"name":"分散蓝 2BLN","dosage":0.10,"unit":"% o.w.f."}]',
 '{"temperature":130,"pH":5.0,"liquor_ratio":10,"dispersant":1.0,"leveling_agent":0.5,"hold_time":45,"heating_rate":1.3}',
 'MACHINE_12', '仅记录涤纶段，棉段需另行活性套染。'),

('hist_polyester_ink_green_001', 'HB-PET-20260602-005', '涤纶桃皮绒', '100%涤纶', 150, '墨绿',
 '{"l":28.0,"a":-19.0,"b":9.5}', '{"l":26.5,"a":-20.8,"b":8.7}', 2.2, 0, 1, '分散染料',
 '[{"name":"分散蓝 2BLN","dosage":1.55,"unit":"% o.w.f."},{"name":"分散黄棕 SE-R","dosage":1.10,"unit":"% o.w.f."},{"name":"分散黑 ECO","dosage":0.25,"unit":"% o.w.f."}]',
 '{"temperature":135,"pH":4.4,"liquor_ratio":10,"dispersant":0.6,"leveling_agent":0.3,"hold_time":60,"heating_rate":2.0}',
 'MACHINE_14', '分散剂偏低且升温过快，首次色花偏深。'),

('hist_polyester_peach_pink_001', 'HB-PET-20260416-006', '涤纶雪纺', '100%涤纶', 75, '桃粉',
 '{"l":72.0,"a":22.5,"b":4.5}', '{"l":72.4,"a":22.1,"b":4.2}', 0.7, 1, 0, '分散染料',
 '[{"name":"分散红玉 S-5BL","dosage":0.42,"unit":"% o.w.f."},{"name":"分散黄棕 SE-R","dosage":0.035,"unit":"% o.w.f."}]',
 '{"temperature":130,"pH":5.0,"liquor_ratio":12,"dispersant":0.8,"leveling_agent":0.6,"hold_time":35,"heating_rate":1.4}',
 'MACHINE_13', '浅粉色，注意色花。'),

('hist_polyester_orange_001', 'HB-PET-20260328-007', '涤纶牛津布', '100%涤纶', 240, '橙色',
 '{"l":58.0,"a":32.0,"b":45.0}', '{"l":57.6,"a":32.8,"b":44.5}', 0.9, 1, 0, '分散染料',
 '[{"name":"分散橙 S-4RL","dosage":1.35,"unit":"% o.w.f."},{"name":"分散黄棕 SE-R","dosage":0.45,"unit":"% o.w.f."},{"name":"分散红玉 S-5BL","dosage":0.18,"unit":"% o.w.f."}]',
 '{"temperature":130,"pH":5.0,"liquor_ratio":10,"dispersant":1.0,"leveling_agent":0.5,"hold_time":45,"heating_rate":1.5}',
 'MACHINE_15', '橙色批次，红黄比例稳定。'),

('hist_nylon_lake_blue_001', 'HB-NYL-20260507-001', '锦纶塔丝隆', '100%锦纶6', 120, '湖蓝',
 '{"l":55.0,"a":-18.0,"b":-28.0}', '{"l":55.4,"a":-17.7,"b":-28.4}', 0.7, 1, 0, '酸性染料',
 '[{"name":"酸性蓝 25","dosage":0.95,"unit":"% o.w.f."},{"name":"酸性黄 49","dosage":0.05,"unit":"% o.w.f."}]',
 '{"temperature":98,"pH":5.0,"liquor_ratio":12,"leveling_agent":1.0,"acetic_acid":0.8,"hold_time":45,"heating_rate":1.2}',
 'MACHINE_21', '锦纶蓝色稳定批次。'),

('hist_nylon_rose_001', 'HB-NYL-20260430-002', '锦纶弹力布', '88%锦纶 + 12%氨纶', 160, '玫红',
 '{"l":48.0,"a":51.0,"b":2.0}', '{"l":47.5,"a":51.8,"b":1.4}', 1.0, 1, 0, '酸性染料',
 '[{"name":"酸性红 337","dosage":1.25,"unit":"% o.w.f."},{"name":"酸性蓝 25","dosage":0.04,"unit":"% o.w.f."}]',
 '{"temperature":95,"pH":5.2,"liquor_ratio":12,"leveling_agent":1.2,"acetic_acid":0.7,"hold_time":40,"heating_rate":1.0}',
 'MACHINE_22', '弹力锦纶需控制升温，避免不匀。'),

('hist_nylon_deep_purple_001', 'HB-NYL-20260606-003', '锦纶塔丝隆', '100%锦纶6', 130, '深紫',
 '{"l":30.5,"a":35.0,"b":-30.0}', '{"l":28.8,"a":37.5,"b":-31.2}', 2.5, 0, 1, '酸性染料',
 '[{"name":"酸性红 337","dosage":1.40,"unit":"% o.w.f."},{"name":"酸性蓝 25","dosage":1.20,"unit":"% o.w.f."}]',
 '{"temperature":100,"pH":4.0,"liquor_ratio":10,"leveling_agent":0.5,"acetic_acid":1.5,"hold_time":60,"heating_rate":1.8}',
 'MACHINE_23', 'pH 偏低、升温过快，首次偏深且不匀。'),

('hist_nylon_light_gray_001', 'HB-NYL-20260322-004', '锦纶纱线', '100%锦纶66', 90, '浅灰',
 '{"l":68.0,"a":0.0,"b":-1.0}', '{"l":68.5,"a":-0.2,"b":-0.8}', 0.6, 1, 0, '酸性染料',
 '[{"name":"酸性黑 194","dosage":0.22,"unit":"% o.w.f."},{"name":"酸性蓝 25","dosage":0.015,"unit":"% o.w.f."}]',
 '{"temperature":95,"pH":5.5,"liquor_ratio":15,"leveling_agent":1.2,"acetic_acid":0.5,"hold_time":35,"heating_rate":1.0}',
 'MACHINE_21', '浅灰批次，浴比偏大以保证匀染。'),

('hist_nylon_army_green_001', 'HB-NYL-20260519-005', '锦纶双肩包布', '100%锦纶', 260, '军绿',
 '{"l":36.0,"a":-10.5,"b":17.5}', '{"l":35.7,"a":-10.1,"b":18.0}', 0.8, 1, 0, '酸性染料',
 '[{"name":"酸性黄 49","dosage":0.82,"unit":"% o.w.f."},{"name":"酸性蓝 25","dosage":0.46,"unit":"% o.w.f."},{"name":"酸性红 337","dosage":0.06,"unit":"% o.w.f."}]',
 '{"temperature":98,"pH":5.0,"liquor_ratio":10,"leveling_agent":1.0,"acetic_acid":0.8,"hold_time":50,"heating_rate":1.1}',
 'MACHINE_24', '军绿批次，黄蓝比例稳定。'),

('hist_acrylic_red_001', 'HB-ACR-20260411-001', '腈纶针织', '100%腈纶', 220, '正红',
 '{"l":43.0,"a":55.0,"b":28.0}', '{"l":43.3,"a":54.2,"b":28.4}', 0.9, 1, 0, '阳离子染料',
 '[{"name":"阳离子红 X-GRL","dosage":1.20,"unit":"% o.w.f."},{"name":"阳离子黄 X-GL","dosage":0.20,"unit":"% o.w.f."}]',
 '{"temperature":98,"pH":4.8,"liquor_ratio":15,"retarder":0.8,"sodium_acetate":0.6,"hold_time":50,"heating_rate":0.8}',
 'MACHINE_31', '腈纶红色，升温较慢，避免色花。'),

('hist_acrylic_violet_001', 'HB-ACR-20260604-002', '腈纶毛衫', '100%腈纶', 280, '紫罗兰',
 '{"l":38.0,"a":32.0,"b":-31.0}', '{"l":37.4,"a":32.8,"b":-31.5}', 0.9, 1, 0, '阳离子染料',
 '[{"name":"阳离子红 X-GRL","dosage":0.88,"unit":"% o.w.f."},{"name":"阳离子蓝 X-BL","dosage":0.95,"unit":"% o.w.f."}]',
 '{"temperature":98,"pH":4.7,"liquor_ratio":15,"retarder":1.0,"sodium_acetate":0.6,"hold_time":55,"heating_rate":0.7}',
 'MACHINE_32', '紫罗兰批次，缓染剂充分。'),

('hist_acrylic_royal_blue_001', 'HB-ACR-20260531-003', '腈纶围巾', '100%腈纶', 180, '宝蓝',
 '{"l":30.0,"a":8.0,"b":-42.0}', '{"l":28.5,"a":8.8,"b":-43.2}', 2.1, 0, 1, '阳离子染料',
 '[{"name":"阳离子蓝 X-BL","dosage":1.95,"unit":"% o.w.f."},{"name":"阳离子红 X-GRL","dosage":0.08,"unit":"% o.w.f."}]',
 '{"temperature":100,"pH":4.2,"liquor_ratio":12,"retarder":0.3,"sodium_acetate":0.3,"hold_time":60,"heating_rate":1.5}',
 'MACHINE_33', '缓染剂不足且升温过快，首次偏深。'),

('hist_acrylic_off_white_001', 'HB-ACR-20260312-004', '腈纶针织', '100%腈纶', 210, '米白',
 '{"l":84.0,"a":1.0,"b":8.0}', '{"l":84.5,"a":0.8,"b":7.6}', 0.7, 1, 0, '阳离子染料',
 '[{"name":"阳离子黄 X-GL","dosage":0.045,"unit":"% o.w.f."},{"name":"阳离子红 X-GRL","dosage":0.006,"unit":"% o.w.f."}]',
 '{"temperature":95,"pH":5.0,"liquor_ratio":18,"retarder":1.0,"sodium_acetate":0.5,"hold_time":35,"heating_rate":0.8}',
 'MACHINE_31', '浅色腈纶，低染料量，浴比偏大。');


-- ============================================================
-- 种子数据: Demo 意图 (4 条)
-- ============================================================

INSERT INTO intent_request (id, raw_text, intent_type, fabric, color_name, target_lab, dye_type, confidence) VALUES
('intent_demo_fog_blue_cotton',
 '客户要高级一点的雾霾蓝，别太紫，做在棉针织上。',
 '方案生成', '纯棉针织汗布', '雾霾蓝',
 '{"l":62.4,"a":-3.1,"b":-11.8}', '活性染料', 0.88),

('intent_demo_polyester_black',
 '涤纶四面弹要做一个稳定黑色，看下历史配方。',
 '历史查询', '涤纶四面弹', '黑色',
 '{"l":15.8,"a":0.4,"b":-1.5}', '分散染料', 0.91),

('intent_demo_nylon_purple',
 '锦纶塔丝隆深紫色上次偏深，这次怎么调安全？',
 '模拟调参', '锦纶塔丝隆', '深紫',
 '{"l":30.5,"a":35.0,"b":-30.0}', '酸性染料', 0.86),

('intent_demo_acrylic_royal_blue',
 '腈纶围巾宝蓝要减少色花风险，找类似历史订单。',
 '风险预警', '腈纶围巾', '宝蓝',
 '{"l":30.0,"a":8.0,"b":-42.0}', '阳离子染料', 0.84);


-- ============================================================
-- 种子数据: 历史匹配 (18 条)
-- ============================================================

INSERT INTO batch_match (id, intent_id, batch_id, similarity_score, rank, difference_note, risk_note, selected) VALUES
-- 雾霾蓝 棉针织 (5 条)
('match_fog_blue_001', 'intent_demo_fog_blue_cotton', 'hist_cotton_fog_blue_001', 0.96, 1,
 '面料、纤维组成、颜色名和目标 Lab 基本一致，克重差异在 5% 内。',
 '可直接作为基础方案；仍需确认本次基布白度和客户看样光源。', 1),

('match_fog_blue_002', 'intent_demo_fog_blue_cotton', 'hist_cotton_fog_blue_002', 0.90, 2,
 '同面料同色系，但该批次首次偏深偏蓝且发生回修。',
 '不要直接复用其高温和高主染料比例，可作为风险反例。', 0),

('match_fog_blue_003', 'intent_demo_fog_blue_cotton', 'hist_cotton_sky_blue_001', 0.72, 3,
 '同为棉活性蓝色系，但颜色更浅、更亮，织物为梭织府绸。',
 '只适合参考蓝相方向，不适合直接复用染料用量。', 0),

('match_fog_blue_004', 'intent_demo_fog_blue_cotton', 'hist_cotton_navy_001', 0.64, 4,
 '同为棉活性蓝色系，但藏青深度明显更深，温度和盐碱更高。',
 '仅用于提示深色方案的盐碱和保温上限，不建议直接套用。', 0),

('match_fog_blue_005', 'intent_demo_fog_blue_cotton', 'hist_cotton_purple_001', 0.48, 5,
 '同为棉活性体系，但色相偏紫且有回修记录。',
 '用于解释客户"别太紫"的风险来源，不能作为基础方案。', 0),

-- 涤纶四面弹 黑色 (5 条)
('match_poly_black_001', 'intent_demo_polyester_black', 'hist_polyester_black_001', 0.97, 1,
 '面料、颜色和染料体系完全匹配，实际 Delta E 为 1.0。',
 '可作为基础方案；需注意氨纶混纺温度上限。', 1),

('match_poly_black_002', 'intent_demo_polyester_black', 'hist_polyester_cotton_gray_001', 0.61, 2,
 '同为分散染料体系，但为涤棉中灰，深度远低于黑色。',
 '只能参考分散段工艺条件，不适合参考染料浓度。', 0),

('match_poly_black_003', 'intent_demo_polyester_black', 'hist_polyester_ink_green_001', 0.55, 3,
 '同为涤纶中深色，但该批次有升温过快和色花回修记录。',
 '用于提示分散染料升温速率和分散剂不足风险。', 0),

('match_poly_black_004', 'intent_demo_polyester_black', 'hist_polyester_royal_blue_001', 0.50, 4,
 '同为涤纶分散染料，但色相为宝蓝，黑色配方不可直接参考。',
 '只参考 130°C、pH5 左右的分散染料基础工艺窗口。', 0),

('match_poly_black_005', 'intent_demo_polyester_black', 'hist_cotton_black_001', 0.35, 5,
 '颜色同为黑色，但面料和染料体系完全不同。',
 '不可复用配方，只可用于跨材质说明深色风险。', 0),

-- 锦纶塔丝隆 深紫 (4 条)
('match_nylon_purple_001', 'intent_demo_nylon_purple', 'hist_nylon_deep_purple_001', 0.95, 1,
 '面料、颜色、染料体系完全匹配，但历史结果为回修批次。',
 '这是关键风险样本：pH 偏低、升温过快、匀染剂不足会导致偏深不匀。', 1),

('match_nylon_purple_002', 'intent_demo_nylon_purple', 'hist_nylon_rose_001', 0.62, 2,
 '同为锦纶酸性体系，红相接近，但不是紫色目标。',
 '可参考 95°C、pH5.2、慢升温的安全窗口。', 0),

('match_nylon_purple_003', 'intent_demo_nylon_purple', 'hist_nylon_lake_blue_001', 0.58, 3,
 '同为锦纶酸性体系，蓝相接近但缺少红相。',
 '可参考湖蓝批次的匀染剂和 pH 控制，不可直接复用染料比例。', 0),

('match_nylon_purple_004', 'intent_demo_nylon_purple', 'hist_acrylic_violet_001', 0.36, 4,
 '颜色相近，但腈纶阳离子体系与锦纶酸性体系不同。',
 '不可复用配方，仅可用于色相展示。', 0),

-- 腈纶围巾 宝蓝 (4 条)
('match_acrylic_blue_001', 'intent_demo_acrylic_royal_blue', 'hist_acrylic_royal_blue_001', 0.96, 1,
 '面料、颜色、染料体系完全匹配，但历史批次发生回修。',
 '关键风险样本：缓染剂不足和升温过快导致偏深色花。', 1),

('match_acrylic_blue_002', 'intent_demo_acrylic_royal_blue', 'hist_acrylic_violet_001', 0.64, 2,
 '同为腈纶阳离子体系，蓝相参与较多，但红相更高。',
 '可参考缓染剂 1.0g/L 和 0.7°C/min 慢升温策略。', 0),

('match_acrylic_blue_003', 'intent_demo_acrylic_royal_blue', 'hist_polyester_royal_blue_001', 0.42, 3,
 '颜色同为宝蓝，但涤纶分散体系和腈纶阳离子体系不同。',
 '不可复用配方和工艺，只作为颜色方向参考。', 0),

('match_acrylic_blue_004', 'intent_demo_acrylic_royal_blue', 'hist_nylon_lake_blue_001', 0.38, 4,
 '色相接近蓝色系，但锦纶酸性体系不同。',
 '不可复用配方，可用于解释不同纤维体系的工艺差异。', 0);
