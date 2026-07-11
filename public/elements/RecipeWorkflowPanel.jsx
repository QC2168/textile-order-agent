import { useMemo, useState } from "react";

const riskColor = {
  低: "#1f8a5b",
  中: "#b97912",
  高: "#c2413a",
  待评估: "#64748b",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function labToCss(lab) {
  if (!lab) return "#d7dde2";
  const l = clamp(Number(lab.l ?? 50), 0, 100);
  const a = clamp(Number(lab.a ?? 0), -60, 60);
  const b = clamp(Number(lab.b ?? 0), -60, 80);
  const lightness = 18 + l * 0.62;
  const saturation = Math.min(78, 28 + (Math.abs(a) + Math.abs(b)) * 0.55);
  const hue = (210 + a * 1.8 - b * 1.25 + 360) % 360;
  return `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
}

function formatLab(lab) {
  if (!lab) return "Lab 待确认";
  return `L ${Number(lab.l).toFixed(1)} / a ${Number(lab.a).toFixed(1)} / b ${Number(lab.b).toFixed(1)}`;
}

function riskFromParams(base, current) {
  let score = 0;
  if (Math.abs(current.temperature - base.temperature) > 2) score += 1;
  if (Math.abs(current.pH - base.pH) > 0.3) score += 1;
  if (Math.abs(current.heating_rate - base.heating_rate) > 0.4) score += 1;
  if (Math.abs(current.hold_time - base.hold_time) > 10) score += 1;
  if (score >= 3) return "高";
  if (score >= 1) return "中";
  return "低";
}

function previewLab(target, base, current) {
  if (!target) return null;
  const tempShift = current.temperature - base.temperature;
  const phShift = current.pH - base.pH;
  const heatShift = current.heating_rate - base.heating_rate;
  const holdShift = current.hold_time - base.hold_time;
  return {
    l: Number((target.l - tempShift * 0.35 - phShift * 0.5 - holdShift * 0.03).toFixed(1)),
    a: Number((target.a + phShift * 0.35).toFixed(1)),
    b: Number((target.b - heatShift * 0.6).toFixed(1)),
  };
}

function Section({ title, children }) {
  return (
    <section style={{ border: "1px solid #d6dde2", borderRadius: 8, padding: 14, background: "#fff" }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>{title}</h3>
      {children}
    </section>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <b>{label}</b>
        <span>{value}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function RecipeWorkflowPanel() {
  const order = props.order || {};
  const intent = props.intent || {};
  const batch = props.selected_batch || {};
  const recipe = props.recipe || {};
  const base = props.tuning_defaults || {};
  const targetLab = props.color_preview?.target;
  const [params, setParams] = useState({
    temperature: base.temperature ?? 60,
    pH: base.pH ?? 10.6,
    heating_rate: base.heating_rate ?? 1.5,
    hold_time: base.hold_time ?? 45,
  });
  const [variants, setVariants] = useState([
    { name: "V1 历史推荐", params: base, risk: order.risk || "低", lab: props.color_preview?.predicted },
  ]);
  const [confirming, setConfirming] = useState(false);
  const [confirmedName, setConfirmedName] = useState(recipe.status === "已确认" ? recipe.version : "");

  const predicted = useMemo(() => previewLab(targetLab, base, params), [targetLab, base, params]);
  const liveRisk = useMemo(() => riskFromParams(base, params), [base, params]);

  const addVariant = () => {
    const nextName = `V${variants.length + 1} 当前调配`;
    setVariants([...variants, { name: nextName, params: { ...params }, risk: liveRisk, lab: predicted }]);
  };

  const confirmVariant = async (variant) => {
    const actionCaller = typeof callAction !== "undefined" ? callAction : (typeof window !== "undefined" ? window.callAction : null);
    if (!actionCaller || !order.order_id) return;
    setConfirming(true);
    const result = await actionCaller({
      name: "confirm_visual_recipe",
      payload: {
        order_id: order.order_id,
        variant_name: variant.name,
        params: variant.params,
        predicted_lab: variant.lab,
        risk: variant.risk,
      },
    });
    if (result?.success) setConfirmedName(variant.name);
    setConfirming(false);
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#17212b", padding: 16, background: "#f5f7f7" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", marginBottom: 14 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#64748b" }}>ColorBridge 配方工作流</p>
          <h2 style={{ margin: 0, fontSize: 22 }}>{order.order_id || "未创建订单"}</h2>
          <p style={{ margin: "6px 0 0", color: "#475569" }}>{order.raw_text}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>状态：{order.status}</p>
        </div>
        <span style={{ padding: "6px 10px", borderRadius: 999, color: "#fff", background: riskColor[liveRisk] || "#64748b", whiteSpace: "nowrap" }}>
          风险 {liveRisk}
        </span>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.9fr) minmax(360px, 1.1fr)", gap: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <Section title="1. AI 提取客户需求">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              <span>意图：<b>{intent.intent_type}</b></span>
              <span>面料：<b>{intent.fabric}</b></span>
              <span>颜色：<b>{intent.color_name}</b></span>
              <span>染料：<b>{intent.dye_type}</b></span>
            </div>
          </Section>

          <Section title="2. 历史匹配">
            <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
              {(props.matches || []).slice(0, 4).map((item) => (
                <div key={item.id} style={{ border: item.selected ? "1px solid #1f6f78" : "1px solid #e2e8f0", borderRadius: 6, padding: 8, background: item.selected ? "#eefafa" : "#fff" }}>
                  <b>Top{item.rank} {item.batch_no}</b>
                  <div>相似度 {Number(item.similarity_score).toFixed(2)} / Delta E {item.delta_e} / RFT {item.rft ? "是" : "否"}</div>
                  <div style={{ color: "#7c4a03" }}>{item.risk_note}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="3. 推荐配方比例">
            <div style={{ display: "grid", gap: 10 }}>
              {(props.formula || []).map((item) => (
                <div key={item.name} style={{ display: "grid", gap: 4, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b>{item.name}</b>
                    <span>{item.dosage}{item.unit} / {item.share}%</span>
                  </div>
                  <div style={{ height: 8, background: "#e5e9ef", borderRadius: 999 }}>
                    <div style={{ height: "100%", width: `${item.share}%`, background: "#1f6f78", borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <Section title="4. 大屏调配面板">
            <div style={{ display: "grid", gridTemplateColumns: "180px 180px 1fr", gap: 12, alignItems: "stretch" }}>
              <div>
                <div style={{ height: 110, borderRadius: 8, background: props.color_preview?.target_css || labToCss(targetLab), border: "1px solid #cbd5e1" }} />
                <p style={{ margin: "6px 0 0", fontSize: 12 }}>目标色</p>
                <b style={{ fontSize: 12 }}>{formatLab(targetLab)}</b>
              </div>
              <div>
                <div style={{ height: 110, borderRadius: 8, background: labToCss(predicted), border: "1px solid #cbd5e1" }} />
                <p style={{ margin: "6px 0 0", fontSize: 12 }}>实时预测</p>
                <b style={{ fontSize: 12 }}>{formatLab(predicted)}</b>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <Slider label="温度" value={params.temperature} min={40} max={135} step={1} unit="°C" onChange={(temperature) => setParams({ ...params, temperature })} />
                <Slider label="pH" value={params.pH} min={4} max={12} step={0.1} unit="" onChange={(pH) => setParams({ ...params, pH })} />
                <Slider label="升温速率" value={params.heating_rate} min={0.5} max={3} step={0.1} unit="°C/min" onChange={(heating_rate) => setParams({ ...params, heating_rate })} />
                <Slider label="保温" value={params.hold_time} min={15} max={90} step={5} unit="min" onChange={(hold_time) => setParams({ ...params, hold_time })} />
                <button onClick={addVariant} style={{ border: 0, borderRadius: 6, padding: "9px 12px", background: "#1f6f78", color: "#fff", fontWeight: 700 }}>
                  保存为对比方案
                </button>
                <button
                  disabled={confirming}
                  onClick={() => confirmVariant({ name: `V${variants.length + 1} 当前调配`, params, risk: liveRisk, lab: predicted })}
                  style={{ border: "1px solid #1f6f78", borderRadius: 6, padding: "9px 12px", background: "#fff", color: "#1f6f78", fontWeight: 700 }}
                >
                  {confirming ? "确认中..." : "确认当前方案"}
                </button>
              </div>
            </div>
          </Section>

          <Section title="5. 多方案对比">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {variants.map((variant) => (
                <div key={variant.name} style={{ border: "1px solid #d6dde2", borderRadius: 8, padding: 10, background: "#fbfcfd" }}>
                  <b>{variant.name}</b>
                  <div style={{ height: 44, borderRadius: 6, margin: "8px 0", background: labToCss(variant.lab) }} />
                  <div style={{ fontSize: 12 }}>风险：{variant.risk}</div>
                  <div style={{ fontSize: 12 }}>温度 {variant.params.temperature}°C / pH {variant.params.pH}</div>
                  <button
                    disabled={confirming}
                    onClick={() => confirmVariant(variant)}
                    style={{ marginTop: 8, width: "100%", border: 0, borderRadius: 6, padding: "7px 9px", background: confirmedName === variant.name ? "#1f8a5b" : "#17212b", color: "#fff" }}
                  >
                    {confirmedName === variant.name ? "已确认" : "确认此方案"}
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section title="6. 订单追踪">
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              {(props.trace_events || []).map((event, index) => (
                <div key={`${event.event_type}-${index}`} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: "#1f6f78", marginTop: 4 }} />
                  <div><b>{event.title}</b><div style={{ color: "#64748b" }}>{event.detail}</div></div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
