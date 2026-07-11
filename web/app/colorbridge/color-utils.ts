import type { LabValue } from "./types";

export function deltaE76(target: LabValue, sample: LabValue) {
  const l = target.l - sample.l;
  const a = target.a - sample.a;
  const b = target.b - sample.b;

  return Number(Math.sqrt(l * l + a * a + b * b).toFixed(1));
}

export function labToCssColor(lab: LabValue) {
  const lightness = Math.max(20, Math.min(78, lab.l));
  const hue = 210 + Math.max(-18, Math.min(18, lab.b));
  const saturation =
    18 + Math.max(0, Math.min(12, Math.abs(lab.a) + Math.abs(lab.b) / 2));

  return `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
}
