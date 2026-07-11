import { useMemo, useState, useCallback } from "react";

/* ================================================================
   ColorBridge 色译通 — 全屏工作流向导 (Gemini-inspired Design)
   6 步向导：需求 → 历史 → 调配 → 对比 → 光源 → 确认
   ================================================================ */

// ── 常量 ──────────────────────────────────────────

const STEPS = [
  { key: "requirement", label: "需求确认", icon: "1" },
  { key: "history",     label: "历史匹配", icon: "2" },
  { key: "tuning",      label: "参数调配", icon: "3" },
  { key: "compare",     label: "方案对比", icon: "4" },
  { key: "light",       label: "光源模拟", icon: "5" },
  { key: "confirm",     label: "确认输出", icon: "6" },
];

const RISK_COLOR = {
  低: "#059669",
  中: "#d97706",
  高: "#dc2626",
  待评估: "#94a3b8",
};

const RISK_BG = {
  低: "#ecfdf5",
  中: "#fffbeb",
  高: "#fef2f2",
  待评估: "#f8fafc",
};

const RISK_BORDER = {
  低: "#a7f3d0",
  中: "#fde68a",
  高: "#fecaca",
  待评估: "#e2e8f0",
};

// 各染料体系的滑块配置
const SLIDER_CONFIGS = {
  活性染料: [
    { key: "temperature",  label: "温度",     min: 40,  max: 100, step: 1,   unit: "°C" },
    { key: "pH",           label: "pH",       min: 9,   max: 12,  step: 0.1, unit: "" },
    { key: "heating_rate", label: "升温速率", min: 0.5, max: 3,   step: 0.1, unit: "°C/min" },
    { key: "hold_time",    label: "保温时间", min: 15,  max: 90,  step: 5,   unit: "min" },
    { key: "salt",         label: "盐用量",   min: 20,  max: 100, step: 5,   unit: "g/L" },
    { key: "alkali",       label: "碱用量",   min: 5,   max: 35,  step: 1,   unit: "g/L" },
  ],
  分散染料: [
    { key: "temperature",    label: "温度",     min: 100, max: 140, step: 1,   unit: "°C" },
    { key: "pH",             label: "pH",       min: 3.5, max: 6.5, step: 0.1, unit: "" },
    { key: "heating_rate",   label: "升温速率", min: 0.5, max: 3,   step: 0.1, unit: "°C/min" },
    { key: "hold_time",      label: "保温时间", min: 15,  max: 90,  step: 5,   unit: "min" },
    { key: "dispersant",     label: "分散剂",   min: 0.2, max: 2.5, step: 0.1, unit: "g/L" },
    { key: "leveling_agent", label: "匀染剂",   min: 0.1, max: 1.5, step: 0.1, unit: "g/L" },
  ],
  酸性染料: [
    { key: "temperature",    label: "温度",     min: 70,  max: 110, step: 1,   unit: "°C" },
    { key: "pH",             label: "pH",       min: 3.5, max: 6.5, step: 0.1, unit: "" },
    { key: "heating_rate",   label: "升温速率", min: 0.5, max: 2.5, step: 0.1, unit: "°C/min" },
    { key: "hold_time",      label: "保温时间", min: 15,  max: 80,  step: 5,   unit: "min" },
    { key: "leveling_agent", label: "匀染剂",   min: 0.2, max: 2.0, step: 0.1, unit: "g/L" },
    { key: "acetic_acid",    label: "醋酸",     min: 0.2, max: 2.5, step: 0.1, unit: "g/L" },
  ],
  阳离子染料: [
    { key: "temperature",    label: "温度",     min: 70,  max: 105, step: 1,   unit: "°C" },
    { key: "pH",             label: "pH",       min: 3.5, max: 6,   step: 0.1, unit: "" },
    { key: "heating_rate",   label: "升温速率", min: 0.3, max: 2.0, step: 0.1, unit: "°C/min" },
    { key: "hold_time",      label: "保温时间", min: 15,  max: 80,  step: 5,   unit: "min" },
    { key: "retarder",       label: "缓染剂",   min: 0.1, max: 2.0, step: 0.1, unit: "g/L" },
    { key: "sodium_acetate", label: "醋酸钠",   min: 0.1, max: 1.5, step: 0.1, unit: "g/L" },
  ],
};
const DEFAULT_SLIDERS = SLIDER_CONFIGS["活性染料"];

const RISK_THRESHOLDS = {
  活性染料:   { temperature: 2, pH: 0.3, heating_rate: 0.4, hold_time: 10, salt: 8, alkali: 3 },
  分散染料:   { temperature: 2, pH: 0.3, heating_rate: 0.4, hold_time: 10, dispersant: 0.3, leveling_agent: 0.2 },
  酸性染料:   { temperature: 2, pH: 0.3, heating_rate: 0.3, hold_time: 10, leveling_agent: 0.3, acetic_acid: 0.3 },
  阳离子染料: { temperature: 2, pH: 0.3, heating_rate: 0.3, hold_time: 10, retarder: 0.3, sodium_acetate: 0.2 },
};

// 光源定义
const LIGHT_SOURCES = [
  { key: "D65",  label: "D65 日光",      temp: 6500, desc: "标准日光，最常用的看样光源",        r: 1.00, g: 1.00, b: 1.00 },
  { key: "A",    label: "A 白炽灯",      temp: 2856, desc: "家用白炽灯，偏暖黄，深色需关注偏红",  r: 1.00, g: 0.85, b: 0.68 },
  { key: "TL84", label: "TL84 商场荧光", temp: 4000, desc: "商场/办公室荧光，蓝紫系关注同色异谱", r: 0.96, g: 0.98, b: 0.88 },
];

// ── 工具函数 ──────────────────────────────────────

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

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

function labToHex(lab) {
  if (!lab) return "#d7dde2";
  const l = clamp(Number(lab.l ?? 50), 0, 100);
  const a = clamp(Number(lab.a ?? 0), -60, 60);
  const b = clamp(Number(lab.b ?? 0), -60, 80);
  const lightness = 18 + l * 0.62;
  const saturation = Math.min(78, 28 + (Math.abs(a) + Math.abs(b)) * 0.55);
  const hue = (210 + a * 1.8 - b * 1.25 + 360) % 360;
  return `hsl(${hue.toFixed(0)}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`;
}

function formatLab(lab) {
  if (!lab) return "Lab 待确认";
  return `L ${Number(lab.l).toFixed(1)}  a ${Number(lab.a).toFixed(1)}  b ${Number(lab.b).toFixed(1)}`;
}

// 色温 RGB 偏移
function colorTempToRgb(kelvin) {
  const t = kelvin / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = clamp(99.47 * Math.log(t) - 161.12, 0, 255);
    b = t <= 19 ? 0 : clamp(138.52 * Math.log(t - 10) - 305.04, 0, 255);
  } else {
    r = clamp(329.7 * (t - 60) ** -0.1332, 0, 255);
    g = clamp(288.12 * (t - 60) ** -0.0755, 0, 255);
    b = 255;
  }
  return { r: r / 255, g: g / 255, b: b / 255 };
}

// 在给定光源下模拟颜色外观
function simulateUnderLight(lab, lightRgb) {
  if (!lab) return "#d7dde2";
  const rShift = (lightRgb.r - 1) * 15;
  const gShift = (lightRgb.g - 1) * 15;
  const bShift = (lightRgb.b - 1) * 15;
  const l = clamp(Number(lab.l ?? 50) + (rShift + gShift + bShift) * 0.3, 0, 100);
  const a = clamp(Number(lab.a ?? 0) + rShift * 0.8 - bShift * 0.4, -60, 60);
  const b = clamp(Number(lab.b ?? 0) + gShift * 0.3 + bShift * 0.6, -60, 80);
  const lightness = 18 + l * 0.62;
  const saturation = Math.min(78, 28 + (Math.abs(a) + Math.abs(b)) * 0.55);
  const hue = (210 + a * 1.8 - b * 1.25 + 360) % 360;
  return `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
}

function previewLab(target, base, current) {
  if (!target) return null;
  const tempShift = (current.temperature ?? 0) - (base.temperature ?? 0);
  const phShift = (current.pH ?? 0) - (base.pH ?? 0);
  const heatShift = (current.heating_rate ?? 0) - (base.heating_rate ?? 0);
  const holdShift = (current.hold_time ?? 0) - (base.hold_time ?? 0);
  return {
    l: Number((target.l - tempShift * 0.35 - phShift * 0.5 - holdShift * 0.03).toFixed(1)),
    a: Number((target.a + phShift * 0.35).toFixed(1)),
    b: Number((target.b - heatShift * 0.6).toFixed(1)),
  };
}

function riskFromParams(base, current, dyeType) {
  const thresholds = RISK_THRESHOLDS[dyeType] || RISK_THRESHOLDS["活性染料"];
  let score = 0;
  for (const [key, threshold] of Object.entries(thresholds)) {
    if (base[key] != null && current[key] != null && Math.abs(current[key] - base[key]) > threshold) score += 1;
  }
  if (score >= 3) return "高";
  if (score >= 1) return "中";
  return "低";
}

// ── 设计系统 ──────────────────────────────────────

const DS = {
  primary:    "#0f766e",
  primaryH:   "#0d9488",
  primaryL:   "#ccfbf1",
  primaryG1:  "#0f766e",
  primaryG2:  "#0891b2",
  success:    "#059669",
  successBg:  "#ecfdf5",
  successBd:  "#a7f3d0",
  warning:    "#d97706",
  warningBg:  "#fffbeb",
  warningBd:  "#fde68a",
  danger:     "#dc2626",
  dangerBg:   "#fef2f2",
  dangerBd:   "#fecaca",
  text:       "#0f172a",
  textSub:    "#475569",
  textMuted:  "#94a3b8",
  border:     "#e2e8f0",
  borderLt:   "#f1f5f9",
  bg:         "#f8fafc",
  surface:    "#ffffff",
  font: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans SC', 'PingFang SC', sans-serif",
  sh:   "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
  shMd: "0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.04)",
  shLg: "0 10px 15px -3px rgba(0,0,0,0.06), 0 4px 6px -4px rgba(0,0,0,0.03)",
  r6: 6, r8: 8, r12: 12, r16: 16, r20: 20, rFull: 999,
};

const cardBase = {
  background: DS.surface,
  borderRadius: DS.r16,
  border: `1px solid ${DS.border}`,
  boxShadow: DS.sh,
  padding: 24,
};

const sectionTitle = {
  margin: 0, fontSize: 18, fontWeight: 700,
  color: DS.text, letterSpacing: "-0.01em",
};

const sectionSub = {
  margin: "4px 0 20px", fontSize: 13,
  color: DS.textSub, lineHeight: 1.6,
};

// ── 基础子组件 ────────────────────────────────────

function StepIndicator({ current, total }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", position: "relative", zIndex: 1,
          }}>
            {i > 0 && (
              <div style={{
                position: "absolute", top: 15,
                right: "50%", width: "100%", height: 2,
                background: done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)",
                zIndex: -1, transition: "background 0.3s ease",
              }} />
            )}
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
              background: done
                ? "rgba(255,255,255,0.3)"
                : active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.1)",
              color: done ? "#fff" : active ? "#0f766e" : "rgba(255,255,255,0.4)",
              border: active ? "2.5px solid rgba(255,255,255,0.9)" : "2.5px solid transparent",
              boxShadow: active ? "0 0 0 4px rgba(255,255,255,0.15)" : "none",
              transition: "all 0.3s ease",
            }}>
              {done ? "\u2713" : step.icon}
            </div>
            <span style={{
              marginTop: 6, fontSize: 11, fontWeight: active ? 700 : 500,
              color: done || active ? "#fff" : "rgba(255,255,255,0.4)",
              transition: "all 0.2s ease",
            }}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackGrad = `linear-gradient(90deg, ${DS.primaryG1} 0%, ${DS.primaryG2} ${pct}%, #e2e8f0 ${pct}%)`;
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "baseline", marginBottom: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: DS.text }}>{label}</span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: DS.primary,
          background: DS.primaryL, padding: "2px 10px", borderRadius: DS.rFull,
          minWidth: 48, textAlign: "center",
        }}>
          {value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%", height: 6, borderRadius: 3,
          appearance: "auto", cursor: "pointer",
          background: trackGrad, accentColor: DS.primary,
        }}
      />
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 10, color: DS.textMuted, marginTop: 2,
      }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

function ColorSwatch({ lab, label, size = 110 }) {
  const css = labToCss(lab);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: size, height: size, borderRadius: DS.r12,
        background: css, margin: "0 auto",
        boxShadow: `0 4px 14px ${css}55, inset 0 2px 6px rgba(255,255,255,0.15)`,
        border: "3px solid rgba(255,255,255,0.9)",
        outline: `1px solid ${DS.border}`,
      }} />
      <p style={{ margin: "10px 0 2px", fontSize: 12, fontWeight: 600, color: DS.text }}>{label}</p>
      <span style={{ fontSize: 11, color: DS.textMuted, fontFamily: "monospace" }}>{formatLab(lab)}</span>
    </div>
  );
}

function FabricSwatch({ lab, label, lightRgb, size = 130 }) {
  const baseColor = simulateUnderLight(lab, lightRgb);
  const texture = `repeating-linear-gradient(
    45deg, transparent, transparent 2px,
    rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px
  ), repeating-linear-gradient(
    -45deg, transparent, transparent 2px,
    rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px
  )`;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: size, height: size, borderRadius: DS.r12,
        background: `${texture}, ${baseColor}`,
        border: `1px solid ${DS.border}`,
        boxShadow: DS.shMd,
        margin: "0 auto",
      }} />
      <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: DS.textSub }}>{label}</p>
    </div>
  );
}

function Btn({ children, primary, disabled, onClick, style: extra }) {
  const base = {
    borderRadius: DS.r12, padding: "10px 24px",
    fontWeight: 600, fontSize: 14, fontFamily: DS.font,
    cursor: disabled ? "default" : "pointer",
    transition: "all 0.2s ease", border: "none",
    display: "inline-flex", alignItems: "center", gap: 6,
  };
  if (primary) {
    return (
      <button disabled={disabled} onClick={onClick} style={{
        ...base,
        background: disabled ? "#cbd5e1" : `linear-gradient(135deg, ${DS.primaryG1}, ${DS.primaryG2})`,
        color: "#fff",
        boxShadow: disabled ? "none" : DS.shMd,
        ...extra,
      }}>{children}</button>
    );
  }
  return (
    <button disabled={disabled} onClick={onClick} style={{
      ...base,
      background: disabled ? "#f8fafc" : DS.surface,
      color: disabled ? DS.textMuted : DS.primary,
      border: `1.5px solid ${disabled ? DS.border : DS.primary}`,
      ...extra,
    }}>{children}</button>
  );
}

function RiskBadge({ risk, size = "md" }) {
  const sz = size === "lg" ? { px: 16, py: 8, fs: 14 } : { px: 12, py: 5, fs: 12 };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: `${sz.py}px ${sz.px}px`,
      borderRadius: DS.rFull, fontSize: sz.fs, fontWeight: 700,
      background: RISK_BG[risk] || RISK_BG["待评估"],
      color: RISK_COLOR[risk] || RISK_COLOR["待评估"],
      border: `1.5px solid ${RISK_BORDER[risk] || RISK_BORDER["待评估"]}`,
    }}>
      <span style={{
        width: size === "lg" ? 10 : 8, height: size === "lg" ? 10 : 8,
        borderRadius: "50%",
        background: RISK_COLOR[risk] || RISK_COLOR["待评估"],
        display: "inline-block",
      }} />
      {risk}
    </span>
  );
}

function InfoGrid({ items, cols = 4 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{
          background: DS.bg, borderRadius: DS.r12, padding: "14px 12px",
          textAlign: "center", border: `1px solid ${DS.borderLt}`,
        }}>
          <div style={{ fontSize: 11, color: DS.textMuted, marginBottom: 6, fontWeight: 500 }}>{label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: DS.text }}>{value || "\u2014"}</div>
        </div>
      ))}
    </div>
  );
}

function Divider({ margin = 16 }) {
  return <div style={{ height: 1, background: DS.border, margin: `${margin}px 0` }} />;
}

// ── 步骤组件 ──────────────────────────────────────

function RequirementStep({ order, intent, onSubmitRequirement }) {
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const hasData = order.raw_text && order.raw_text.length > 0;

  const handleSubmit = async () => {
    if (!inputText.trim() || submitting) return;
    setSubmitting(true);
    if (onSubmitRequirement) {
      await onSubmitRequirement(inputText.trim());
    }
    setSubmitting(false);
  };

  return (
    <div style={cardBase}>
      <h3 style={sectionTitle}>客户需求</h3>
      <p style={sectionSub}>
        {hasData ? "AI 从用户描述中提取的关键信息" : "在下方输入调色需求，系统将自动识别意图并匹配历史数据"}
      </p>

      {/* 输入区域 - 没有订单数据时显示 */}
      {!hasData && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: "flex", gap: 10, alignItems: "flex-end",
          }}>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder="例如：客户要高级一点的雾霾蓝，别太紫，做在棉针织上"
              rows={3}
              style={{
                flex: 1, padding: "12px 16px", borderRadius: DS.r12,
                border: `1px solid ${DS.border}`, fontSize: 14, lineHeight: 1.6,
                fontFamily: "inherit", resize: "vertical", outline: "none",
                background: DS.surface, color: DS.text,
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!inputText.trim() || submitting}
              style={{
                padding: "12px 24px", borderRadius: DS.r12,
                border: "none", cursor: inputText.trim() && !submitting ? "pointer" : "default",
                background: inputText.trim() && !submitting ? DS.primary : DS.border,
                color: "#fff", fontWeight: 600, fontSize: 14,
                whiteSpace: "nowrap", transition: "background 0.15s",
              }}
            >
              {submitting ? "分析中..." : "开始分析"}
            </button>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["雾霾蓝棉针织怎么做", "涤纶四面弹黑色历史配方", "锦纶深紫上次偏深怎么调"].map((example) => (
              <button key={example}
                onClick={() => setInputText(example)}
                style={{
                  padding: "6px 14px", borderRadius: DS.rFull,
                  border: `1px solid ${DS.border}`, background: DS.surface,
                  color: DS.textSub, fontSize: 12, cursor: "pointer",
                }}>
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 已有数据时显示需求文本 */}
      {hasData && (
        <div style={{
          background: `linear-gradient(135deg, ${DS.primaryL}44, ${DS.primaryL}88)`,
          borderRadius: DS.r12, padding: "18px 22px", marginBottom: 20,
          borderLeft: `4px solid ${DS.primary}`,
        }}>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: DS.text, fontStyle: "italic" }}>
            "{order.raw_text}"
          </p>
        </div>
      )}

      <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: DS.textSub }}>
        AI 识别结果
      </h4>
      <InfoGrid items={[
        ["意图类型", intent.intent_type],
        ["面料",     intent.fabric],
        ["颜色",     intent.color_name],
        ["染料体系", intent.dye_type],
      ]} />

      {intent.target_lab && (
        <>
          <Divider margin={20} />
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ColorSwatch lab={intent.target_lab} label="目标色" size={80} />
            <div>
              <p style={{ margin: 0, fontSize: 13, color: DS.textSub, fontFamily: "monospace" }}>
                {formatLab(intent.target_lab)}
              </p>
              <div style={{
                marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 12px", borderRadius: DS.rFull,
                background: DS.primaryL, fontSize: 12, fontWeight: 600, color: DS.primary,
              }}>
                置信度 {(intent.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HistoryStep({ matches }) {
  return (
    <div style={cardBase}>
      <h3 style={sectionTitle}>历史批次匹配</h3>
      <p style={sectionSub}>基于面料、颜色、染料体系的历史生产数据相似度排序</p>

      <div style={{ display: "grid", gap: 10 }}>
        {(matches || []).map((item) => (
          <div key={item.id} style={{
            border: item.selected ? `2px solid ${DS.primary}` : `1px solid ${DS.border}`,
            borderRadius: DS.r12, padding: 18,
            background: item.selected
              ? `linear-gradient(135deg, ${DS.primaryL}22, ${DS.primaryL}44)`
              : DS.surface,
            boxShadow: item.selected ? DS.shMd : DS.sh,
            transition: "all 0.2s ease",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: DS.r8,
                  background: item.selected
                    ? `linear-gradient(135deg, ${DS.primaryG1}, ${DS.primaryG2})`
                    : "#f1f5f9",
                  color: item.selected ? "#fff" : DS.textSub,
                  fontSize: 12, fontWeight: 700,
                }}>
                  {item.rank}
                </span>
                <b style={{ fontSize: 15, color: DS.text }}>{item.batch_no}</b>
                {item.selected && (
                  <span style={{
                    fontSize: 11, color: DS.primary, background: DS.primaryL,
                    padding: "2px 10px", borderRadius: DS.rFull, fontWeight: 600,
                  }}>已选中</span>
                )}
              </div>
              <span style={{
                fontSize: 12, color: DS.textMuted, background: DS.bg,
                padding: "4px 10px", borderRadius: DS.rFull,
              }}>
                相似度 {Number(item.similarity_score).toFixed(2)}
              </span>
            </div>
            <div style={{
              display: "flex", gap: 14, fontSize: 13, marginBottom: 10, flexWrap: "wrap",
            }}>
              <span style={{ color: DS.textSub }}>
                {"\u0394"}E: <b style={{ color: DS.text }}>{item.delta_e}</b>
              </span>
              <span style={{ color: DS.textSub }}>
                RFT: <b style={{ color: item.rft ? DS.success : DS.danger }}>{item.rft ? "是" : "否"}</b>
              </span>
              <span style={{ color: DS.textSub }}>面料: {item.fabric}</span>
              <span style={{ color: DS.textSub }}>颜色: {item.color_name}</span>
            </div>
            <div style={{ fontSize: 13, color: DS.textSub, lineHeight: 1.5 }}>
              {item.difference_note}
            </div>
            {item.risk_note && (
              <div style={{
                fontSize: 12, color: DS.warning, marginTop: 8,
                padding: "6px 12px", background: DS.warningBg,
                borderRadius: DS.r8, border: `1px solid ${DS.warningBd}`,
              }}>
                {item.risk_note}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TuningStep({ dyeType, base, targetLab, params, setParams }) {
  const sliders = SLIDER_CONFIGS[dyeType] || DEFAULT_SLIDERS;
  const predicted = useMemo(() => previewLab(targetLab, base, params), [targetLab, base, params]);
  const risk = useMemo(() => riskFromParams(base, params, dyeType), [base, params]);

  const readOnly = [];
  if (base.liquor_ratio != null) readOnly.push({ label: "浴比", value: `1:${base.liquor_ratio}` });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={cardBase}>
        <h3 style={sectionTitle}>工艺参数调配</h3>
        <p style={{ ...sectionSub, marginBottom: 16 }}>
          当前染料体系：
          <span style={{
            fontWeight: 700, color: DS.primary,
            background: DS.primaryL, padding: "1px 8px",
            borderRadius: DS.rFull, fontSize: 12,
          }}> {dyeType}</span>
        </p>
        <div style={{ display: "grid", gap: 16 }}>
          {sliders.map((s) => (
            <Slider key={s.key} label={s.label} value={params[s.key] ?? s.min}
              min={s.min} max={s.max} step={s.step} unit={s.unit}
              onChange={(v) => setParams({ ...params, [s.key]: v })} />
          ))}
        </div>
        {readOnly.length > 0 && (
          <>
            <Divider />
            <div style={{ fontSize: 13, color: DS.textSub }}>
              {readOnly.map((p) => (
                <div key={p.label} style={{
                  display: "flex", justifyContent: "space-between", padding: "4px 0",
                }}>
                  <span>{p.label}</span>
                  <b style={{ color: DS.text }}>{p.value}</b>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={cardBase}>
        <h3 style={sectionTitle}>实时预览</h3>
        <p style={sectionSub}>调整参数后预测的色彩变化</p>

        <div style={{
          display: "flex", gap: 16, justifyContent: "center",
          alignItems: "center", marginBottom: 24, padding: "16px 0",
        }}>
          <ColorSwatch lab={targetLab} label="目标色" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <svg width="40" height="20" viewBox="0 0 40 20">
              <path d="M0 10 L32 10 M26 4 L32 10 L26 16" fill="none"
                stroke={DS.textMuted} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <ColorSwatch lab={predicted} label="预测色" />
        </div>

        <div style={{
          padding: 16, borderRadius: DS.r12,
          background: RISK_BG[risk],
          border: `1.5px solid ${RISK_BORDER[risk]}`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <RiskBadge risk={risk} size="lg" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: DS.text }}>综合风险评估</div>
            <div style={{ fontSize: 12, color: DS.textSub, marginTop: 2 }}>
              偏离历史成功参数越多，风险越高
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: DS.textSub, marginBottom: 8 }}>
            参数偏离详情
          </div>
          {sliders.map((s) => {
            const baseVal = base[s.key];
            const curVal = params[s.key] ?? s.min;
            const diff = baseVal != null ? curVal - baseVal : 0;
            const threshold = (RISK_THRESHOLDS[dyeType] || RISK_THRESHOLDS["活性染料"])[s.key] || 2;
            const exceed = Math.abs(diff) > threshold;
            if (diff === 0 && baseVal == null) return null;
            return (
              <div key={s.key} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", fontSize: 12, padding: "3px 0",
              }}>
                <span style={{ color: DS.textSub }}>{s.label}</span>
                <span style={{
                  fontWeight: 600,
                  color: exceed ? DS.danger : Math.abs(diff) > 0 ? DS.warning : DS.success,
                }}>
                  {diff === 0 ? "\u2014" : `${diff > 0 ? "+" : ""}${Number(diff).toFixed(1)}${s.unit}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompareStep({ variants, currentParams, currentRisk, currentLab, onAdd, onRemove, selectedIdx, onSelect }) {
  return (
    <div style={cardBase}>
      <h3 style={sectionTitle}>方案对比</h3>
      <p style={sectionSub}>点击选中一个方案作为最终方案，或保存当前调配参数为新方案</p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14,
      }}>
        {variants.map((v, i) => (
          <div key={v.name}
            onClick={() => onSelect(i)}
            style={{
              border: i === selectedIdx ? `2px solid ${DS.primary}` : `1px solid ${DS.border}`,
              borderRadius: DS.r16, padding: 18,
              background: i === selectedIdx ? DS.primaryL : DS.surface,
              boxShadow: i === selectedIdx ? `0 0 0 3px ${DS.primary}22, ${DS.sh}` : DS.sh,
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s",
            }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10,
            }}>
              <b style={{ fontSize: 14, color: DS.text }}>{v.name}</b>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {i === selectedIdx && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: DS.primary,
                    background: `${DS.primary}18`, padding: "2px 8px",
                    borderRadius: DS.rFull,
                  }}>{"\u2713"} 已选</span>
                )}
                {i > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); onRemove(i); }} style={{
                    border: "none", background: "none",
                    color: DS.danger, fontSize: 16, cursor: "pointer",
                    lineHeight: 1, padding: "2px 4px", borderRadius: 4, opacity: 0.6,
                  }}>{"\u00d7"}</button>
                )}
              </div>
            </div>
            <div style={{
              height: 70, borderRadius: DS.r12, margin: "8px 0 12px",
              background: labToCss(v.lab),
              boxShadow: `0 4px 12px ${labToCss(v.lab)}44, inset 0 2px 4px rgba(255,255,255,0.15)`,
              border: "2px solid rgba(255,255,255,0.8)",
            }} />
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <RiskBadge risk={v.risk} />
            </div>
            <div style={{ fontSize: 12, color: DS.textSub, lineHeight: 1.8 }}>
              <div>温度 {v.params.temperature}{"\u00b0"}C / pH {v.params.pH}</div>
              <div>升温 {v.params.heating_rate}{"\u00b0"}C/min / 保温 {v.params.hold_time}min</div>
            </div>
          </div>
        ))}

        <div onClick={onAdd} style={{
          border: `2px dashed ${DS.border}`,
          borderRadius: DS.r16, padding: 18,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          cursor: "pointer", minHeight: 180,
          background: DS.bg,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: DS.primaryL, color: DS.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 300, marginBottom: 10,
          }}>+</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: DS.primary }}>
            保存当前方案
          </span>
          <span style={{ fontSize: 11, color: DS.textMuted, marginTop: 4 }}>
            风险 {currentRisk}
          </span>
        </div>
      </div>
    </div>
  );
}

function LightStep({ lab, fabric }) {
  const [activeLight, setActiveLight] = useState("D65");
  const [customTemp, setCustomTemp] = useState(5000);
  const [useCustom, setUseCustom] = useState(false);

  const currentLight = useCustom
    ? { key: "custom", label: `自定义 ${customTemp}K`, ...colorTempToRgb(customTemp) }
    : LIGHT_SOURCES.find((ls) => ls.key === activeLight) || LIGHT_SOURCES[0];

  return (
    <div style={cardBase}>
      <h3 style={sectionTitle}>光源模拟</h3>
      <p style={sectionSub}>
        同一块布在不同光源下看起来颜色不同（同色异谱现象）。切换光源查看面料的实际视觉效果。
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {LIGHT_SOURCES.map((ls) => {
          const active = !useCustom && activeLight === ls.key;
          return (
            <button key={ls.key}
              onClick={() => { setActiveLight(ls.key); setUseCustom(false); }}
              style={{
                border: active ? `2px solid ${DS.primary}` : `1px solid ${DS.border}`,
                borderRadius: DS.r12, padding: "12px 18px",
                background: active ? DS.primaryL : DS.surface,
                cursor: "pointer", textAlign: "left",
                boxShadow: active ? DS.shMd : DS.sh,
                transition: "all 0.2s ease", minWidth: 130,
              }}>
              <b style={{ fontSize: 14, color: active ? DS.primary : DS.text }}>{ls.label}</b>
              <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>{ls.temp}K</div>
            </button>
          );
        })}
        <button onClick={() => setUseCustom(true)}
          style={{
            border: useCustom ? `2px solid ${DS.primary}` : `1px solid ${DS.border}`,
            borderRadius: DS.r12, padding: "12px 18px",
            background: useCustom ? DS.primaryL : DS.surface,
            cursor: "pointer", textAlign: "left",
            boxShadow: useCustom ? DS.shMd : DS.sh,
            transition: "all 0.2s ease", minWidth: 130,
          }}>
          <b style={{ fontSize: 14, color: useCustom ? DS.primary : DS.text }}>自定义色温</b>
          <div style={{ fontSize: 11, color: DS.textMuted, marginTop: 2 }}>{customTemp}K</div>
        </button>
      </div>

      {useCustom && (
        <div style={{
          marginBottom: 20, padding: 18,
          background: DS.bg, borderRadius: DS.r12,
          border: `1px solid ${DS.borderLt}`,
        }}>
          <Slider label="色温" value={customTemp} min={2700} max={10000} step={100} unit="K"
            onChange={setCustomTemp} />
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 11, color: DS.textMuted, marginTop: 4,
          }}>
            <span>暖黄 2700K</span><span>中性 5000K</span><span>冷白 10000K</span>
          </div>
        </div>
      )}

      <div style={{
        padding: "12px 16px", borderRadius: DS.r8,
        background: DS.bg, border: `1px solid ${DS.borderLt}`,
        fontSize: 13, color: DS.textSub, marginBottom: 24, lineHeight: 1.6,
      }}>
        {useCustom ? `自定义色温 ${customTemp}K` : currentLight.desc}
      </div>

      <h4 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: DS.textSub }}>
        多光源对比
      </h4>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 14,
      }}>
        {LIGHT_SOURCES.map((ls) => (
          <FabricSwatch key={ls.key} lab={lab} label={ls.label} lightRgb={ls} size={120} />
        ))}
        <FabricSwatch lab={lab} label={`自定义 ${customTemp}K`} lightRgb={colorTempToRgb(customTemp)} size={120} />
      </div>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <FabricSwatch lab={lab} label={`${currentLight.label} 下的面料效果`} lightRgb={currentLight} size={180} />
      </div>
    </div>
  );
}

function ConfirmStep({ order, intent, recipe, formula, params, risk, predicted, base }) {
  return (
    <div style={cardBase}>
      <h3 style={sectionTitle}>方案确认</h3>
      <p style={sectionSub}>审核全部信息后确认方案，下发至生产车间</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <h4 style={{
            margin: "0 0 14px", fontSize: 14, fontWeight: 700,
            color: DS.textSub, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>订单信息</h4>
          <div style={{
            background: DS.bg, borderRadius: DS.r12, padding: 16,
            border: `1px solid ${DS.borderLt}`,
          }}>
            {[
              ["订单号", order.order_id],
              ["状态",   order.status],
              ["面料",   intent.fabric],
              ["颜色",   intent.color_name],
              ["染料体系", intent.dye_type],
            ].map(([label, value], idx, arr) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 13, padding: "6px 0",
                borderBottom: idx < arr.length - 1 ? `1px solid ${DS.borderLt}` : "none",
              }}>
                <span style={{ color: DS.textSub }}>{label}</span>
                <b style={{ color: DS.text }}>{value}</b>
              </div>
            ))}
          </div>

          <h4 style={{
            margin: "20px 0 14px", fontSize: 14, fontWeight: 700,
            color: DS.textSub, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>染料配方</h4>
          <div style={{
            background: DS.bg, borderRadius: DS.r12, padding: 16,
            border: `1px solid ${DS.borderLt}`,
          }}>
            {(formula || []).map((f, idx, arr) => (
              <div key={f.name} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 13, padding: "5px 0",
                borderBottom: idx < arr.length - 1 ? `1px solid ${DS.borderLt}` : "none",
              }}>
                <span style={{ color: DS.textSub }}>{f.name}</span>
                <b style={{ color: DS.text }}>{f.dosage}{f.unit} ({f.share}%)</b>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 style={{
            margin: "0 0 14px", fontSize: 14, fontWeight: 700,
            color: DS.textSub, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>工艺参数</h4>
          <div style={{
            background: DS.bg, borderRadius: DS.r12, padding: 16,
            border: `1px solid ${DS.borderLt}`,
          }}>
            {Object.entries(params).map(([k, v], idx, arr) => {
              const cfg = (SLIDER_CONFIGS[intent.dye_type] || DEFAULT_SLIDERS).find((s) => s.key === k);
              const baseVal = base[k];
              const diff = baseVal != null ? (v - baseVal) : 0;
              const threshold = (RISK_THRESHOLDS[intent.dye_type] || RISK_THRESHOLDS["活性染料"])[k] || 2;
              const exceed = Math.abs(diff) > threshold;
              return (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 13, padding: "5px 0",
                  borderBottom: idx < arr.length - 1 ? `1px solid ${DS.borderLt}` : "none",
                }}>
                  <span style={{ color: DS.textSub }}>{cfg?.label || k}</span>
                  <span>
                    <b style={{ color: DS.text }}>{v}{cfg?.unit || ""}</b>
                    {diff !== 0 && (
                      <span style={{
                        marginLeft: 8,
                        color: exceed ? DS.danger : DS.warning,
                        fontSize: 11, fontWeight: 700,
                      }}>
                        ({diff > 0 ? "+" : ""}{Number(diff).toFixed(1)})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <h4 style={{
            margin: "20px 0 14px", fontSize: 14, fontWeight: 700,
            color: DS.textSub, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>色彩预览</h4>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <ColorSwatch lab={intent.target_lab} label="目标色" size={80} />
            <svg width="32" height="16" viewBox="0 0 32 16">
              <path d="M0 8 L24 8 M20 3 L26 8 L20 13" fill="none"
                stroke={DS.textMuted} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <ColorSwatch lab={predicted} label="预测色" size={80} />
          </div>

          <div style={{
            marginTop: 16, padding: 14, borderRadius: DS.r12,
            background: RISK_BG[risk],
            border: `1.5px solid ${RISK_BORDER[risk]}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <RiskBadge risk={risk} size="lg" />
            <span style={{ fontSize: 13, fontWeight: 600, color: DS.text }}>综合风险</span>
          </div>
        </div>
      </div>

      {recipe.risk_notes && recipe.risk_notes.length > 0 && (
        <div style={{
          marginTop: 20, padding: 18,
          background: DS.warningBg, borderRadius: DS.r12,
          border: `1px solid ${DS.warningBd}`,
        }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: DS.warning }}>
            风险提示
          </h4>
          {recipe.risk_notes.map((note, i) => (
            <div key={i} style={{
              fontSize: 13, color: DS.text, marginBottom: 6,
              paddingLeft: 14, position: "relative", lineHeight: 1.6,
            }}>
              <span style={{
                position: "absolute", left: 0, top: 8,
                width: 6, height: 6, borderRadius: "50%",
                background: DS.warning,
              }} />
              {note}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────

export default function RecipeWorkflowPanel(props) {
  const orderId = props.order?.order_id || "empty";
  return <WizardInner key={orderId} {...props} />;
}

function WizardInner(props) {
  const order = props.order || {};
  const intent = props.intent || {};
  const recipe = props.recipe || {};
  const base = props.tuning_defaults || {};
  const dyeType = intent.dye_type || "活性染料";
  const sliders = SLIDER_CONFIGS[dyeType] || DEFAULT_SLIDERS;
  const targetLab = props.color_preview?.target;

  const initParams = useMemo(() => {
    const p = {};
    for (const s of sliders) p[s.key] = base[s.key] ?? s.min;
    return p;
  }, []);

  const [step, setStep] = useState(0);
  const [params, setParams] = useState(initParams);
  const [variants, setVariants] = useState([
    { name: "V1 历史推荐", params: { ...initParams }, risk: order.risk || "低", lab: props.color_preview?.predicted },
  ]);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const predicted = useMemo(() => previewLab(targetLab, base, params), [targetLab, base, params]);
  const liveRisk = useMemo(() => riskFromParams(base, params, dyeType), [base, params, dyeType]);
  const selectedVariant = variants[selectedIdx] || variants[0];

  const addVariant = useCallback(() => {
    const nextName = `V${variants.length + 1} 调配方案`;
    setVariants([...variants, { name: nextName, params: { ...params }, risk: liveRisk, lab: predicted }]);
  }, [variants, params, liveRisk, predicted]);

  const removeVariant = useCallback((idx) => {
    setVariants(variants.filter((_, i) => i !== idx));
  }, [variants]);

  const confirmRecipe = useCallback(async () => {
    const actionCaller = typeof callAction !== "undefined" ? callAction : (typeof window !== "undefined" ? window.callAction : null);
    if (!actionCaller || !order.order_id) return;
    setConfirming(true);
    await actionCaller({
      name: "confirm_visual_recipe",
      payload: {
        order_id: order.order_id,
        variant_name: selectedVariant?.name || "最终方案",
        params: selectedVariant?.params || params,
        predicted_lab: selectedVariant?.lab || predicted,
        risk: selectedVariant?.risk || liveRisk,
      },
    });
    setConfirmed(true);
    setConfirming(false);
  }, [order.order_id, selectedVariant, params, predicted, liveRisk]);

  const submitRequirement = useCallback(async (text) => {
    const actionCaller = typeof callAction !== "undefined" ? callAction : (typeof window !== "undefined" ? window.callAction : null);
    if (!actionCaller || !text) return;
    await actionCaller({
      name: "submit_requirement",
      payload: { text },
    });
  }, []);

  const canNext = step < STEPS.length - 1;
  const canPrev = step > 0;

  return (
    <div style={{
      fontFamily: DS.font, color: DS.text,
      display: "flex", flexDirection: "column", height: "100%",
      background: DS.bg,
    }}>
      {/* 顶部导航 — 渐变品牌头部 */}
      <header style={{
        padding: "18px 24px 16px",
        background: `linear-gradient(135deg, ${DS.primaryG1}, ${DS.primaryG2})`,
        color: "#fff",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -30, right: -20,
          width: 120, height: 120, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
        }} />
        <div style={{
          position: "absolute", bottom: -40, left: 60,
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
        }} />

        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", position: "relative", zIndex: 1,
          marginBottom: 16,
        }}>
          <div>
            <p style={{
              margin: 0, fontSize: 11, opacity: 0.75, fontWeight: 500,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              ColorBridge 配方工作流
            </p>
            <h2 style={{
              margin: "4px 0 0", fontSize: 20, fontWeight: 700,
              letterSpacing: "-0.01em",
            }}>
              {order.order_id || "未创建订单"}
            </h2>
            {confirmed && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                marginTop: 6, fontSize: 11, fontWeight: 600,
                background: "rgba(255,255,255,0.2)",
                padding: "3px 12px", borderRadius: DS.rFull,
              }}>
                {"\u2713"} 方案已确认
              </span>
            )}
          </div>
          <RiskBadge risk={liveRisk} size="lg" />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <StepIndicator current={step} total={STEPS.length} />
        </div>
      </header>

      {/* 内容区域 */}
      <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {step === 0 && <RequirementStep order={order} intent={intent} onSubmitRequirement={submitRequirement} />}
        {step === 1 && <HistoryStep matches={props.matches} />}
        {step === 2 && <TuningStep dyeType={dyeType} base={base} targetLab={targetLab} params={params} setParams={setParams} />}
        {step === 3 && <CompareStep variants={variants} currentParams={params} currentRisk={liveRisk} currentLab={predicted} onAdd={addVariant} onRemove={removeVariant} selectedIdx={selectedIdx} onSelect={setSelectedIdx} />}
        {step === 4 && <LightStep lab={selectedVariant?.lab || predicted || targetLab} fabric={intent.fabric} />}
        {step === 5 && <ConfirmStep order={order} intent={intent} recipe={recipe} formula={props.formula} params={selectedVariant?.params || params} risk={selectedVariant?.risk || liveRisk} predicted={selectedVariant?.lab || predicted} base={base} />}
      </main>

      {/* 底部导航 */}
      <footer style={{
        padding: "14px 24px", background: DS.surface,
        borderTop: `1px solid ${DS.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <Btn onClick={() => setStep(step - 1)} disabled={!canPrev}>
          {"\u2190"} 上一步
        </Btn>
        <span style={{
          fontSize: 12, color: DS.textMuted, fontWeight: 500,
          background: DS.bg, padding: "4px 14px", borderRadius: DS.rFull,
        }}>
          {step + 1} / {STEPS.length}
        </span>
        {step === STEPS.length - 1 ? (
          <Btn primary onClick={() => confirmRecipe()} disabled={confirming || confirmed}>
            {confirmed ? "\u2713 已确认" : confirming ? "确认中..." : "确认方案并提交"}
          </Btn>
        ) : (
          <Btn primary onClick={() => setStep(step + 1)}>
            下一步 {"\u2192"}
          </Btn>
        )}
      </footer>
    </div>
  );
}
