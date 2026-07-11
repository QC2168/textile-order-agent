"use client";

import { useState, useCallback, useMemo, useRef } from "react";

const API = "/api/backend/workflow";
const BRAND = "#1f6f78";

// ── 类型 ──
interface Lab { l: number; a: number; b: number; }
interface FormulaItem { name: string; dosage: number; unit: string; }
interface ProcessParams { [key: string]: number; }
interface Match { id: string; batch_no: string; similarity_score: number; delta_e: number; rft: boolean; selected: boolean; risk_note: string; rank: number; fabric: string; color_name: string; }
interface Recipe { id: string; name: string; params: ProcessParams; formula: FormulaItem[]; predicted_lab: Lab | null; risk: string; selected: boolean; }
interface Order {
  order_id: string; workflow_status: string; predicted_risk: string;
  raw_text: string; summary: string;
  intent: { intent_type: string; fabric: string; color_name: string; dye_type: string; target_lab: Lab | null; confidence: number };
  matches: Match[];
  tuning_advice: { advice?: string[]; optical_note?: string } | null;
  recipe_cards: { dye_formula: FormulaItem[]; process_params: ProcessParams }[];
  actual_delta_e: number | null; rft: boolean | null;
}

// 滑块配置（按染料体系）
const SLIDER_DEFS: Record<string, { key: string; label: string; min: number; max: number; step: number; unit: string }[]> = {
  活性染料: [
    { key: "temperature", label: "温度", min: 40, max: 100, step: 1, unit: "°C" },
    { key: "pH", label: "pH", min: 9, max: 12, step: 0.1, unit: "" },
    { key: "heating_rate", label: "升温速率", min: 0.5, max: 3, step: 0.1, unit: "°C/min" },
    { key: "hold_time", label: "保温时间", min: 15, max: 90, step: 5, unit: "min" },
    { key: "salt", label: "盐用量", min: 20, max: 100, step: 5, unit: "g/L" },
    { key: "alkali", label: "碱用量", min: 5, max: 35, step: 1, unit: "g/L" },
  ],
  分散染料: [
    { key: "temperature", label: "温度", min: 100, max: 140, step: 1, unit: "°C" },
    { key: "pH", label: "pH", min: 3.5, max: 6.5, step: 0.1, unit: "" },
    { key: "heating_rate", label: "升温速率", min: 0.5, max: 3, step: 0.1, unit: "°C/min" },
    { key: "hold_time", label: "保温时间", min: 15, max: 90, step: 5, unit: "min" },
    { key: "dispersant", label: "分散剂", min: 0.2, max: 2.5, step: 0.1, unit: "g/L" },
    { key: "leveling_agent", label: "匀染剂", min: 0.1, max: 1.5, step: 0.1, unit: "g/L" },
  ],
  酸性染料: [
    { key: "temperature", label: "温度", min: 70, max: 110, step: 1, unit: "°C" },
    { key: "pH", label: "pH", min: 3.5, max: 6.5, step: 0.1, unit: "" },
    { key: "heating_rate", label: "升温速率", min: 0.5, max: 2.5, step: 0.1, unit: "°C/min" },
    { key: "hold_time", label: "保温时间", min: 15, max: 80, step: 5, unit: "min" },
    { key: "leveling_agent", label: "匀染剂", min: 0.2, max: 2, step: 0.1, unit: "g/L" },
    { key: "acetic_acid", label: "醋酸", min: 0.2, max: 2.5, step: 0.1, unit: "g/L" },
  ],
  阳离子染料: [
    { key: "temperature", label: "温度", min: 70, max: 105, step: 1, unit: "°C" },
    { key: "pH", label: "pH", min: 3.5, max: 6, step: 0.1, unit: "" },
    { key: "heating_rate", label: "升温速率", min: 0.3, max: 2, step: 0.1, unit: "°C/min" },
    { key: "hold_time", label: "保温时间", min: 15, max: 80, step: 5, unit: "min" },
    { key: "retarder", label: "缓染剂", min: 0.1, max: 2, step: 0.1, unit: "g/L" },
    { key: "sodium_acetate", label: "醋酸钠", min: 0.1, max: 1.5, step: 0.1, unit: "g/L" },
  ],
};

const LIGHTS = [
  { key: "D65", label: "D65 日光", r: 1, g: 1, b: 1 },
  { key: "A", label: "A 白炽灯", r: 1, g: 0.85, b: 0.68 },
  { key: "TL84", label: "TL84 商场", r: 0.96, g: 0.98, b: 0.88 },
];

const RISK_C: Record<string, string> = { 低: "#10b981", 中: "#f59e0b", 高: "#ef4444", 待评估: "#94a3b8" };

// ── 工具函数 ──
function labToHsl(l: number, a: number, b: number): string {
  const cl = Math.max(0, Math.min(100, l));
  const ca = Math.max(-60, Math.min(60, a));
  const cb = Math.max(-60, Math.min(80, b));
  const hue = (210 + ca * 1.8 - cb * 1.25 + 360) % 360;
  const sat = Math.min(78, 28 + (Math.abs(ca) + Math.abs(cb)) * 0.55);
  const light = 18 + cl * 0.62;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function labCss(lab: Lab | null): string {
  if (!lab) return "#e2e8f0";
  return labToHsl(lab.l, lab.a, lab.b);
}

function lightSim(lab: Lab | null, lr: { r: number; g: number; b: number }): string {
  if (!lab) return "#e2e8f0";
  return labToHsl(
    lab.l + (lr.r + lr.g + lr.b - 3) * 3,
    lab.a + (lr.r - 1) * 8 - (lr.b - 1) * 4,
    lab.b + (lr.g - 1) * 3 + (lr.b - 1) * 6,
  );
}

function tempRgb(k: number) {
  const t = k / 100; let r: number, g: number, b: number;
  if (t <= 66) { r = 255; g = Math.min(255, Math.max(0, 99.47 * Math.log(t) - 161.12)); b = t <= 19 ? 0 : Math.min(255, Math.max(0, 138.52 * Math.log(t - 10) - 305.04)); }
  else { r = Math.min(255, Math.max(0, 329.7 * (t - 60) ** -0.1332)); g = Math.min(255, Math.max(0, 288.12 * (t - 60) ** -0.0755)); b = 255; }
  return { r: r / 255, g: g / 255, b: b / 255 };
}

// 根据参数偏移预测 Lab 变化
// 各染料体系的科学参数模型
// 参考: Shore (1990) "Batchwise Dyeing", Broadbent (2001) "Society of Dyers and Colourists"
// 各参数的影响权重基于染色动力学和实际生产经验
const DYE_MODELS: Record<string, {
  optTemp: number; optPH: number;
  // 温度偏差对 L* 的影响系数（°C → ΔL*），越高越敏感
  tempSensL: number;
  // pH偏差对 L* 的影响系数
  phSensL: number;
  // pH偏差对 a* 的影响系数
  phSensA: number;
  // 升温速率对 b* 的影响（匀染性）
  heatSensB: number;
  // 保温时间对 L* 的影响（每10分钟）
  holdSensL: number;
  // 特征参数的影响系数
  auxSens: Record<string, { l: number; a: number; b: number; weight: number }>;
}> = {
  活性染料: {
    optTemp: 60, optPH: 10.7,
    tempSensL: 2.0, phSensL: 2.5, phSensA: 1.2,
    heatSensB: 1.0, holdSensL: 0.6,
    auxSens: {
      salt: { l: -1.2, a: 0.15, b: -0.3, weight: 0.6 },
      alkali: { l: -0.9, a: 0.3, b: -0.15, weight: 0.5 },
    },
  },
  分散染料: {
    optTemp: 130, optPH: 5.0,
    tempSensL: 3.5, phSensL: 1.0, phSensA: 0.6,
    heatSensB: 2.0, holdSensL: 0.8,
    auxSens: {
      dispersant: { l: 0.8, a: -0.3, b: 0.9, weight: 0.7 },
      leveling_agent: { l: 0.4, a: 0.15, b: 0.3, weight: 0.5 },
    },
  },
  酸性染料: {
    optTemp: 98, optPH: 5.0,
    tempSensL: 1.8, phSensL: 2.0, phSensA: 1.5,
    heatSensB: 1.2, holdSensL: 0.5,
    auxSens: {
      leveling_agent: { l: 0.5, a: -0.15, b: 0.3, weight: 0.6 },
      acetic_acid: { l: -0.9, a: 0.6, b: -0.3, weight: 0.7 },
    },
  },
  阳离子染料: {
    optTemp: 98, optPH: 4.8,
    tempSensL: 2.5, phSensL: 1.5, phSensA: 0.8,
    heatSensB: 1.5, holdSensL: 0.6,
    auxSens: {
      retarder: { l: 1.5, a: -0.3, b: 0.6, weight: 0.9 },
      sodium_acetate: { l: 0.3, a: 0.06, b: 0.15, weight: 0.4 },
    },
  },
};

// Sigmoid函数：模拟实际染色中的非线性饱和效应
function sigmoid(x: number, k: number = 0.1): number {
  return 2 / (1 + Math.exp(-k * x)) - 1; // 输出范围 [-1, 1]
}

function predictLab(target: Lab | null, base: ProcessParams, current: ProcessParams, dyeType?: string): Lab | null {
  if (!target) return null;
  const model = DYE_MODELS[dyeType ?? "活性染料"] ?? DYE_MODELS["活性染料"];

  // 温度偏差（基于该体系最适温度，非线性）
  const dTemp = (current.temperature ?? model.optTemp) - (base.temperature ?? model.optTemp);
  const tempEffect = sigmoid(dTemp, 0.15) * model.tempSensL * 5;

  // pH偏差（非线性，过高过低都影响）
  const dPH = (current.pH ?? model.optPH) - (base.pH ?? model.optPH);
  const phEffectL = sigmoid(dPH, 0.8) * model.phSensL * 4;
  const phEffectA = sigmoid(dPH, 0.6) * model.phSensA * 4;

  // 升温速率偏差（影响匀染性 → b*）
  const dHeat = (current.heating_rate ?? 1.5) - (base.heating_rate ?? 1.5);
  const heatEffect = sigmoid(dHeat, 1.2) * model.heatSensB * 4;

  // 保温时间偏差（每10分钟的影响，递减效应）
  const dHold = ((current.hold_time ?? 45) - (base.hold_time ?? 45)) / 10;
  const holdEffect = sigmoid(dHold, 0.25) * model.holdSensL * 4;

  // 特征参数偏差（盐/碱/分散剂/缓染剂等）
  let auxEffectL = 0, auxEffectA = 0, auxEffectB = 0;
  for (const [key, sens] of Object.entries(model.auxSens)) {
    const baseVal = base[key];
    const curVal = current[key];
    if (baseVal != null && curVal != null) {
      const delta = (curVal - baseVal) / Math.max(Math.abs(baseVal), 1);
      const eff = sigmoid(delta * 100, 0.08) * 4;
      auxEffectL += eff * sens.l;
      auxEffectA += eff * sens.a;
      auxEffectB += eff * sens.b;
    }
  }

  return {
    l: +(target.l - tempEffect - phEffectL - holdEffect - auxEffectL).toFixed(1),
    a: +(target.a + phEffectA + auxEffectA).toFixed(1),
    b: +(target.b - heatEffect - auxEffectB).toFixed(1),
  };
}

// CIE76 色差公式：ΔE = sqrt(ΔL² + Δa² + Δb²)
function calcDeltaE(lab1: Lab | null, lab2: Lab | null): number | null {
  if (!lab1 || !lab2) return null;
  const dL = lab1.l - lab2.l;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return +Math.sqrt(dL * dL + da * da + db * db).toFixed(2);
}

function calcRisk(base: ProcessParams, current: ProcessParams, dyeType: string): string {
  const model = DYE_MODELS[dyeType] ?? DYE_MODELS["活性染料"];

  // 计算加权偏差分数（0-100）
  let totalScore = 0;
  let totalWeight = 0;

  // 通用参数
  const params: [string, number][] = [
    ["temperature", 2.0],
    ["pH", 1.5],
    ["heating_rate", 1.0],
    ["hold_time", 0.5],
  ];
  for (const [key, weight] of params) {
    const baseVal = base[key];
    const curVal = current[key];
    if (baseVal != null && curVal != null) {
      const pctDev = Math.abs(curVal - baseVal) / Math.max(Math.abs(baseVal), 1) * 100;
      totalScore += Math.min(pctDev * weight, 30); // 单项上限30分
      totalWeight += weight;
    }
  }

  // 特征参数
  for (const [key, sens] of Object.entries(model.auxSens)) {
    const baseVal = base[key];
    const curVal = current[key];
    if (baseVal != null && curVal != null) {
      const pctDev = Math.abs(curVal - baseVal) / Math.max(Math.abs(baseVal), 1) * 100;
      totalScore += Math.min(pctDev * sens.weight, 25);
      totalWeight += sens.weight;
    }
  }

  const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  if (normalizedScore >= 12) return "高";
  if (normalizedScore >= 5) return "中";
  return "低";
}

// ── 主组件 ──
export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<{ llm_used: boolean; elapsed: number; llm_error: string | null } | null>(null);
  const loadingRef = useRef(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [step, setStep] = useState(0);
  const [customK, setCustomK] = useState(5000);

  // 调配参数状态
  const baseParams = useMemo<ProcessParams>(() => order?.recipe_cards?.[0]?.process_params ?? {}, [order]);
  const dyeType = order?.intent?.dye_type ?? "活性染料";
  const sliders = useMemo(() => SLIDER_DEFS[dyeType] ?? SLIDER_DEFS["活性染料"], [dyeType]);
  const initParams = useMemo(() => { const p: ProcessParams = {}; sliders.forEach(s => p[s.key] = baseParams[s.key] ?? s.min); return p; }, [baseParams, sliders]);

  const [adjustedParams, setAdjustedParams] = useState<ProcessParams>({});
  const params = useMemo(() => ({ ...initParams, ...adjustedParams }), [initParams, adjustedParams]);

  // 多方案
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeIdx, setSelectedRecipeIdx] = useState(-1);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const targetLab = order?.intent?.target_lab ?? null;
  const predictedLab = useMemo(() => predictLab(targetLab, baseParams, params, dyeType), [targetLab, baseParams, params, dyeType]);
  const liveRisk = useMemo(() => calcRisk(baseParams, params, dyeType), [baseParams, params, dyeType]);
  const liveDeltaE = useMemo(() => calcDeltaE(targetLab, predictedLab), [targetLab, predictedLab]);

  const analyze = useCallback(async () => {
    if (!text.trim() || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setAnalyzeError(null);
    setLoadingText("AI 正在分析需求...");
    try {
      const r = await fetch(`${API}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }) });
      if (!r.ok) throw new Error(`服务器返回 ${r.status}`);
      setLoadingText("正在匹配历史批次...");
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      if (d.order) {
        setLoadingText("正在生成配方建议...");
        setOrder(d.order);
        setStep(1);
        setLastAnalysis({ llm_used: d.llm_used ?? false, elapsed: d.elapsed ?? 0, llm_error: d.llm_error ?? null });
        setAdjustedParams({});
        const baseP = d.order.recipe_cards?.[0]?.process_params ?? {};
        const sl = SLIDER_DEFS[d.order.intent?.dye_type ?? "活性染料"] ?? SLIDER_DEFS["活性染料"];
        const ip: ProcessParams = {}; sl.forEach(s => ip[s.key] = baseP[s.key] ?? s.min);
        const predL = predictLab(d.order.intent?.target_lab, baseP, ip, d.order.intent?.dye_type);
        setRecipes([{ id: "V1", name: "V1 历史推荐", params: { ...ip }, formula: d.order.recipe_cards?.[0]?.dye_formula ?? [], predicted_lab: predL, risk: d.order.predicted_risk ?? "低", selected: false }]);
        setSelectedRecipeIdx(-1);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setAnalyzeError(msg);
      console.error("analyze error:", e);
    }
    loadingRef.current = false;
    setLoading(false);
    setLoadingText("");
  }, [text]);

  const saveRecipe = useCallback(() => {
    const nextIdx = recipes.length + 1;
    const newR: Recipe = { id: `V${nextIdx}`, name: `V${nextIdx} 调配方案`, params: { ...params }, formula: order?.recipe_cards?.[0]?.dye_formula ?? [], predicted_lab: predictedLab ? { ...predictedLab } : null, risk: liveRisk, selected: false };
    setRecipes([...recipes, newR]);
    setStep(4); // 自动跳转到方案选品步骤
  }, [recipes, params, predictedLab, liveRisk, order]);

  const selectRecipe = useCallback((idx: number) => {
    setRecipes(prev => prev.map((r, i) => ({ ...r, selected: i === idx })));
    setSelectedRecipeIdx(idx);
    setAdjustedParams(recipes[idx]?.params ?? {});
  }, [recipes]);

  const confirmAndSave = useCallback(async () => {
    if (!order || selectedRecipeIdx < 0) return false;
    const r = recipes[selectedRecipeIdx];
    try {
      // 第一步：确认选中方案（写入工艺参数）
      const r1 = await fetch(`${API}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_visual", order_id: order.order_id, variant_name: r.name, params: r.params, predicted_lab: r.predicted_lab, risk: r.risk }),
      });
      if (!r1.ok) throw new Error(`confirm_visual failed: ${r1.status}`);

      // 第二步：确认方案（推进工作流状态）
      const r2 = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", order_id: order.order_id }) });
      if (!r2.ok) throw new Error(`confirm failed: ${r2.status}`);

      // 第三步：刷新订单数据
      const res = await fetch(`${API}/order/${order.order_id}`);
      const d = await res.json();
      if (d.order) setOrder(d.order);
      return true;
    } catch (e) {
      console.error("confirmAndSave error:", e);
      return false;
    }
  }, [order, selectedRecipeIdx, recipes]);

  const risk = order?.predicted_risk ?? "待评估";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f7f8fa", color: "#1e293b" }}>
      <header style={{ padding: "10px 24px", background: "#fff", borderBottom: "1px solid #e8ecf0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: BRAND, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>CB</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>ColorBridge 色译通</span>
        </div>
        {order && <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "#64748b" }}>{order.order_id}</span>
          <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: RISK_C[risk], background: `${RISK_C[risk]}15` }}>风险 {risk}</span>
        </div>}
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 左：步骤导航 */}
        <nav style={{ width: 180, background: "#fff", borderRight: "1px solid #e8ecf0", padding: "16px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {["输入需求", "意图识别", "历史匹配", "参数调配", "方案选品", "光源验证", "确认输出"].map((s, i) => (
            <button key={s} onClick={() => order && i <= (order.recipe_cards?.length ? 6 : 2) && setStep(i)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: "none", width: "100%", textAlign: "left",
              background: i === step ? `${BRAND}10` : "transparent", color: i === step ? BRAND : i <= (order ? 6 : 0) ? "#475569" : "#cbd5e1",
              fontWeight: i === step ? 700 : 500, fontSize: 13, cursor: "pointer",
            }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: i < step ? BRAND : i === step ? BRAND : "#e2e8f0", color: i <= step ? "#fff" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {i < step ? "✓" : i + 1}
              </span>
              {s}
            </button>
          ))}
        </nav>

        {/* 中：主内容 */}
        <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {step === 0 && (
            <div style={{ maxWidth: 600, margin: "40px auto" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>输入调色需求</h2>
              <p style={{ color: "#64748b", marginBottom: 20, fontSize: 14 }}>描述客户的颜色需求，AI 将自动识别意图并匹配历史数据</p>
              <div style={{ display: "flex", gap: 10 }}>
                <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); analyze(); } }}
                  placeholder="例如：客户要高级一点的雾霾蓝，别太紫，做在棉针织上" rows={4}
                  style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: `2px solid ${BRAND}25`, fontSize: 14, lineHeight: 1.6, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
                <button onClick={analyze} disabled={!text.trim() || loading} style={{ padding: "12px 24px", borderRadius: 10, border: "none", alignSelf: "flex-end", background: text.trim() && !loading ? BRAND : "#e2e8f0", color: "#fff", fontWeight: 700, fontSize: 14, cursor: text.trim() && !loading ? "pointer" : "default" }}>
                  {loading ? (loadingText || "AI 分析中...") : "开始分析"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                {["雾霾蓝棉针织怎么做", "涤纶四面弹黑色历史配方", "锦纶深紫上次偏深怎么调"].map(ex => (
                  <button key={ex} onClick={() => setText(ex)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, cursor: "pointer" }}>{ex}</button>
                ))}
              </div>
              {analyzeError && (
                <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, lineHeight: 1.6 }}>
                  ❌ 分析失败：{analyzeError}。请确认后端服务已启动（端口 8000）。
                </div>
              )}
            </div>
          )}

          {step === 1 && order && (
            <div style={{ maxWidth: 700 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>意图识别</h2>
              <div style={{ background: `${BRAND}08`, borderRadius: 10, padding: 14, borderLeft: `3px solid ${BRAND}`, marginBottom: 20, fontSize: 15, lineHeight: 1.7 }}>"{order.raw_text}"</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[["意图", order.intent.intent_type], ["面料", order.intent.fabric], ["颜色", order.intent.color_name], ["染料", order.intent.dye_type]].map(([k, v]) => (
                  <div key={k} style={{ background: "#f8fafc", borderRadius: 8, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{k}</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
              {targetLab && <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 8, background: labCss(targetLab), border: "1px solid #e2e8f0" }} />
                <span style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace" }}>L{targetLab.l} a{targetLab.a} b{targetLab.b} · 置信度 {(order.intent.confidence * 100).toFixed(0)}%</span>
              </div>}
              {lastAnalysis && (
                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
                  <span style={{ padding: "4px 10px", borderRadius: 6, background: lastAnalysis.llm_used ? "#f0fdf4" : "#fffbeb", color: lastAnalysis.llm_used ? "#166534" : "#92400e" }}>
                    {lastAnalysis.llm_used ? "✅ AI 模型分析" : "⚠️ 规则匹配回退"}
                  </span>
                  <span style={{ padding: "4px 10px", borderRadius: 6, background: "#f8fafc", color: "#64748b" }}>
                    耗时 {lastAnalysis.elapsed}s
                  </span>
                  {lastAnalysis.llm_error && (
                    <span style={{ padding: "4px 10px", borderRadius: 6, background: "#fef2f2", color: "#dc2626" }}>
                      LLM 错误: {lastAnalysis.llm_error}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && order && (
            <div style={{ maxWidth: 700 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>历史匹配</h2>
              <div style={{ display: "grid", gap: 8 }}>
                {order.matches?.map(m => (
                  <div key={m.id} style={{ border: m.selected ? `2px solid ${BRAND}` : "1px solid #e8ecf0", borderRadius: 8, padding: 12, background: m.selected ? `${BRAND}06` : "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <b style={{ fontSize: 13 }}>Top{m.rank} {m.batch_no} {m.selected && <span style={{ fontSize: 10, color: BRAND, background: `${BRAND}15`, padding: "1px 6px", borderRadius: 4 }}>选中</span>}</b>
                      <span style={{ fontSize: 12, color: "#64748b" }}>相似度 {m.similarity_score.toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>ΔE {m.delta_e} · RFT {m.rft ? "是" : "否"}</div>
                    <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>{m.risk_note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && order && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>参数调配</h2>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>拖动滑块调节工艺参数，右侧实时对比原始方案与调配方案</p>

              {/* 双栏对比 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* 左：原始方案 */}
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: "#64748b" }}>📋 原始方案（历史批次）</div>
                  {sliders.map(s => (
                    <div key={s.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #e8ecf0" }}>
                      <span>{s.label}</span>
                      <b>{baseParams[s.key] ?? "-"}{s.unit}</b>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>目标色</div>
                    <div style={{ width: "100%", height: 64, borderRadius: 8, background: labCss(targetLab), border: "1px solid #e2e8f0" }} />
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b", marginTop: 4 }}>{targetLab ? `L${targetLab.l} a${targetLab.a} b${targetLab.b}` : "-"}</div>
                  </div>
                </div>

                {/* 右：调配方案 */}
                <div style={{ background: "#fff", borderRadius: 10, padding: 16, border: `1px solid ${BRAND}30` }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: BRAND }}>🔧 调配方案（实时调节）</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {sliders.map(s => (
                      <label key={s.key} style={{ fontSize: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span>{s.label}</span>
                          <b style={{ color: (params[s.key] ?? 0) !== (baseParams[s.key] ?? 0) ? BRAND : "#1e293b" }}>{params[s.key] ?? s.min}{s.unit}</b>
                        </div>
                        <input type="range" min={s.min} max={s.max} step={s.step} value={params[s.key] ?? s.min}
                          aria-label={`${s.label} ${params[s.key] ?? s.min}${s.unit}`}
                          onChange={e => setAdjustedParams(prev => ({ ...prev, [s.key]: Number(e.target.value) }))}
                          style={{ width: "100%", accentColor: BRAND }} />
                      </label>
                    ))}
                  </div>
                  {/* 色彩对比区域 */}
                  <div style={{ marginTop: 16, background: "#f8fafc", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "stretch", marginBottom: 12 }}>
                      {/* 目标色 */}
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>目标色</div>
                        <div style={{ width: "100%", height: 64, borderRadius: 8, background: labCss(targetLab), border: "1px solid #e2e8f0" }} />
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b", marginTop: 4 }}>{targetLab ? `L${targetLab.l} a${targetLab.a} b${targetLab.b}` : "-"}</div>
                      </div>
                      {/* 箭头 + ΔE */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 60 }}>
                        <div style={{ fontSize: 22, color: "#cbd5e1" }}>→</div>
                        <div style={{
                          marginTop: 4, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                          color: liveDeltaE != null && liveDeltaE <= 1 ? "#059669" : liveDeltaE != null && liveDeltaE <= 2 ? "#d97706" : "#dc2626",
                          background: liveDeltaE != null && liveDeltaE <= 1 ? "#ecfdf5" : liveDeltaE != null && liveDeltaE <= 2 ? "#fffbeb" : "#fef2f2",
                        }}>
                          ΔE {liveDeltaE ?? "-"}
                        </div>
                      </div>
                      {/* 预测色 */}
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: BRAND, marginBottom: 6, fontWeight: 600 }}>预测色</div>
                        <div style={{ width: "100%", height: 64, borderRadius: 8, background: labCss(predictedLab), border: `2px solid ${BRAND}40` }} />
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b", marginTop: 4 }}>{predictedLab ? `L${predictedLab.l} a${predictedLab.a} b${predictedLab.b}` : "-"}</div>
                      </div>
                    </div>
                    {/* 偏差分解条 */}
                    {predictedLab && targetLab && liveDeltaE != null && liveDeltaE > 0.01 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: 11 }}>
                        {[
                          { label: "ΔL*", val: +(predictedLab.l - targetLab.l).toFixed(1), desc: predictedLab.l < targetLab.l ? "偏深" : "偏浅" },
                          { label: "Δa*", val: +(predictedLab.a - targetLab.a).toFixed(1), desc: predictedLab.a > targetLab.a ? "偏红" : "偏绿" },
                          { label: "Δb*", val: +(predictedLab.b - targetLab.b).toFixed(1), desc: predictedLab.b > targetLab.b ? "偏黄" : "偏蓝" },
                        ].map(d => (
                          <div key={d.label} style={{ background: "#fff", borderRadius: 6, padding: "6px 8px", border: "1px solid #e8ecf0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                              <span>{d.label}</span>
                              <b style={{ color: Math.abs(d.val) > 1 ? "#dc2626" : Math.abs(d.val) > 0.5 ? "#d97706" : "#059669" }}>{d.val > 0 ? "+" : ""}{d.val}</b>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: "#e2e8f0", marginTop: 4, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${Math.min(100, Math.abs(d.val) * 20)}%`, borderRadius: 2, background: Math.abs(d.val) > 1 ? "#dc2626" : Math.abs(d.val) > 0.5 ? "#f59e0b" : "#10b981", transition: "width 0.2s" }} />
                            </div>
                            <div style={{ color: "#94a3b8", marginTop: 2, fontSize: 10 }}>{d.desc}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: RISK_C[liveRisk], background: `${RISK_C[liveRisk]}15` }}>
                      风险 {liveRisk}
                    </span>
                    {liveDeltaE != null && liveDeltaE <= 1 && <span style={{ fontSize: 11, color: "#059669" }}>色差在可接受范围内</span>}
                    {liveDeltaE != null && liveDeltaE > 1 && liveDeltaE <= 2 && <span style={{ fontSize: 11, color: "#d97706" }}>色差偏大，建议微调</span>}
                    {liveDeltaE != null && liveDeltaE > 2 && <span style={{ fontSize: 11, color: "#dc2626" }}>色差超标，需重新调配</span>}
                  </div>
                  <button onClick={saveRecipe} style={{ marginTop: 12, width: "100%", padding: "10px", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    保存为方案
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 步骤 4: 方案选品 */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>方案选品</h2>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>点击选中一个方案作为最终输出，选定后进入光源验证</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
                {recipes.map((r, i) => (
                  <div key={r.id} onClick={() => selectRecipe(i)} style={{
                    border: r.selected ? `2px solid ${BRAND}` : "1px solid #e8ecf0", borderRadius: 10, padding: 14, cursor: "pointer",
                    background: r.selected ? `${BRAND}06` : "#fff", transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <b style={{ fontSize: 13 }}>{r.name}</b>
                      {r.selected && <span style={{ fontSize: 10, color: BRAND, fontWeight: 700 }}>✓ 已选</span>}
                    </div>
                    <div style={{ height: 50, borderRadius: 6, background: labCss(r.predicted_lab), border: "1px solid #e2e8f0", marginBottom: 8 }} />
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      <div>风险: <b style={{ color: RISK_C[r.risk] }}>{r.risk}</b></div>
                      <div>温度 {r.params.temperature}°C / pH {r.params.pH}</div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedRecipeIdx >= 0 && (
                <button onClick={() => { setStep(5); }} style={{ padding: "12px 32px", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  进入光源验证 →
                </button>
              )}
            </div>
          )}

          {/* 步骤 5: 光源验证（选中方案的最终光源检查） */}
          {step === 5 && order && targetLab && (
            <div style={{ maxWidth: 700 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>光源验证</h2>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>对选中方案进行最终光源验证，确认各光源下颜色表现一致</p>

              {selectedRecipeIdx >= 0 && recipes[selectedRecipeIdx] && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: 14, background: `${BRAND}06`, borderRadius: 10, border: `1px solid ${BRAND}20` }}>
                  <div style={{ width: 50, height: 50, borderRadius: 8, background: labCss(recipes[selectedRecipeIdx].predicted_lab), border: "1px solid #e2e8f0" }} />
                  <div>
                    <b style={{ fontSize: 14 }}>{recipes[selectedRecipeIdx].name}</b>
                    <div style={{ fontSize: 12, color: "#64748b" }}>风险 {recipes[selectedRecipeIdx].risk} · 温度 {recipes[selectedRecipeIdx].params.temperature}°C · pH {recipes[selectedRecipeIdx].params.pH}</div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
                {LIGHTS.map(ls => {
                  const simColor = lightSim(selectedRecipeIdx >= 0 ? recipes[selectedRecipeIdx]?.predicted_lab ?? targetLab : targetLab, ls);
                  return (
                    <div key={ls.key} style={{ background: "#fff", borderRadius: 10, padding: 16, border: "1px solid #e8ecf0", textAlign: "center" }}>
                      <div style={{ height: 100, borderRadius: 8, background: simColor, border: "1px solid #e2e8f0", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.05)", marginBottom: 10 }} />
                      <b style={{ fontSize: 14 }}>{ls.label}</b>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                        {ls.key === "D65" && "标准日光，最常用看样光源"}
                        {ls.key === "A" && "家用白炽灯，深色需关注偏红"}
                        {ls.key === "TL84" && "商场荧光，蓝紫系关注同色异谱"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>自定义色温</div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{ width: 120, height: 80, borderRadius: 8, background: lightSim(selectedRecipeIdx >= 0 ? recipes[selectedRecipeIdx]?.predicted_lab ?? targetLab : targetLab, tempRgb(customK)), border: "1px solid #e2e8f0", boxShadow: "inset 0 2px 8px rgba(0,0,0,0.05)" }} />
                  <div style={{ flex: 1 }}>
                    <input type="range" min={2700} max={10000} step={100} value={customK} onChange={e => setCustomK(Number(e.target.value))} aria-label={`自定义色温 ${customK}K`} style={{ width: "100%", accentColor: BRAND }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
                      <span>暖黄 2700K</span><span>中性 5000K</span><span>冷白 10000K</span>
                    </div>
                    <div style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: BRAND, marginTop: 6 }}>{customK}K</div>
                  </div>
                </div>
              </div>

              {order.tuning_advice?.optical_note && (
                <div style={{ marginTop: 16, padding: 14, background: "#fffbeb", borderRadius: 10, fontSize: 13, color: "#92400e" }}>
                  💡 {order.tuning_advice.optical_note}
                </div>
              )}

              <button onClick={() => setStep(6)} style={{ marginTop: 20, padding: "12px 32px", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                验证通过，进入确认 →
              </button>
            </div>
          )}

          {/* 步骤 6: 确认输出（含二次确认弹窗） */}
          {step === 6 && order && (
            <div style={{ maxWidth: 700 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>确认输出</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>订单信息</div>
                  {[["订单号", order.order_id], ["状态", order.workflow_status], ["面料", order.intent.fabric], ["颜色", order.intent.color_name]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                      <span style={{ color: "#64748b" }}>{k}</span><b>{v}</b>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>选中方案</div>
                  {selectedRecipeIdx >= 0 && recipes[selectedRecipeIdx] && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 6, background: labCss(recipes[selectedRecipeIdx].predicted_lab), border: "1px solid #e2e8f0" }} />
                        <div>
                          <b style={{ fontSize: 14 }}>{recipes[selectedRecipeIdx].name}</b>
                          <div style={{ fontSize: 12, color: "#64748b" }}>风险: <span style={{ color: RISK_C[recipes[selectedRecipeIdx].risk] }}>{recipes[selectedRecipeIdx].risk}</span></div>
                        </div>
                      </div>
                      {Object.entries(recipes[selectedRecipeIdx].params).slice(0, 6).map(([k, v]) => (
                        <div key={k} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                          <span style={{ color: "#94a3b8" }}>{k}</span><b>{v as number}</b>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div style={{ background: "#fffbeb", borderRadius: 10, padding: 16, marginBottom: 20, border: "1px solid #fde68a" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#92400e", marginBottom: 8 }}>⚠️ 请确认以下信息无误后再写入数据库</div>
                <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.8 }}>
                  确认后将把选中方案的工艺参数写入订单数据库，并同步至 AI 上下文。此操作不可撤销，请仔细核对参数。
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setShowConfirmDialog(true)} disabled={saving}
                  style={{ padding: "14px 36px", borderRadius: 10, border: "none", background: BRAND, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  {saving ? "写入中..." : "确认并写入数据库"}
                </button>
                <button onClick={() => setStep(5)}
                  style={{ padding: "14px 24px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                  ← 返回修改
                </button>
              </div>

              {/* 二次确认弹窗 */}
              {showConfirmDialog && (
                <div role="dialog" aria-modal="true" aria-label="确认写入数据库" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                  <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>确认写入数据库？</h3>
                    <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
                      将把 <b>{recipes[selectedRecipeIdx]?.name}</b> 的工艺参数写入订单 <b>{order.order_id}</b> 的数据库记录，同时同步至 AI 智能体上下文。
                    </p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button onClick={() => setShowConfirmDialog(false)}
                        style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, cursor: "pointer" }}>
                        取消
                      </button>
                      <button onClick={async () => {
                        setShowConfirmDialog(false);
                        setSaving(true);
                        const ok = await confirmAndSave();
                        setSaving(false);
                        if (!ok) alert("写入失败，请检查后端服务是否正常运行。");
                      }}
                        style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                        确认写入
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 写入成功提示 */}
              {order.workflow_status === "方案已确认" && (
                <div style={{ marginTop: 16, padding: 14, background: "#f0fdf4", borderRadius: 10, fontSize: 13, color: "#166534" }}>
                  ✅ 方案已确认并写入数据库，已同步至 AI 上下文。可通过左侧步骤继续操作（下发车间、生产录入等）。
                </div>
              )}
            </div>
          )}

          {/* 空白步骤占位：步骤 1-6 但无订单数据时显示 */}
          {step > 0 && !order && (
            <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#475569", marginBottom: 8 }}>请先完成需求输入</h3>
              <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                返回第一步输入调色需求，AI 分析完成后才能查看后续步骤。
              </p>
              <button onClick={() => setStep(0)} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                ← 返回输入需求
              </button>
            </div>
          )}
        </main>

        {/* 右：订单状态 */}
        <aside style={{ width: 240, background: "#fff", borderLeft: "1px solid #e8ecf0", padding: 16, overflow: "auto" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#475569" }}>订单状态</h3>
          {!order ? (
            <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8 }}>输入需求后这里显示订单实时状态</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>订单号</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{order.order_id}</div>
              </div>
              {[["状态", order.workflow_status], ["风险", risk], ["面料", order.intent.fabric], ["颜色", order.intent.color_name], ["染料", order.intent.dye_type]].map(([k, v]) => (
                <div key={k} style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: k === "风险" ? RISK_C[v] : "#1e293b" }}>{v}</div>
                </div>
              ))}
              {targetLab && (
                <div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>目标色</div>
                  <div style={{ width: "100%", height: 40, borderRadius: 6, background: labCss(targetLab), border: "1px solid #e2e8f0" }} />
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 4, fontFamily: "monospace" }}>L{targetLab.l} a{targetLab.a} b{targetLab.b}</div>
                </div>
              )}
              {order.matches && order.matches.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>匹配批次</div>
                  {order.matches.slice(0, 3).map(m => (
                    <div key={m.id} style={{ fontSize: 11, padding: "3px 0", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: m.selected ? BRAND : "#64748b" }}>{m.batch_no}</span>
                      <span style={{ color: "#94a3b8" }}>ΔE {m.delta_e}</span>
                    </div>
                  ))}
                </div>
              )}
              {order.actual_delta_e != null && (
                <div style={{ padding: "8px 10px", background: order.rft ? "#f0fdf4" : "#fef2f2", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>生产结果</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>ΔE {order.actual_delta_e} · {order.rft ? "一次成功" : "需回修"}</div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
