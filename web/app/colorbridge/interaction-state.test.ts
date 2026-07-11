import { describe, expect, it } from "vitest";

import { getActionFeedback } from "./interaction-state";

describe("getActionFeedback", () => {
  it("describes the AI analysis process as three visible steps", () => {
    expect(getActionFeedback("analysis")).toEqual({
      title: "AI 分析中",
      detail: "正在调用模型并解析结构化颜色需求",
      steps: ["读取需求集合", "调用 DeepSeek V4 Flash", "解析结构化 JSON"],
    });
  });

  it("describes the sampling process as three visible steps", () => {
    expect(getActionFeedback("sampling")).toEqual({
      title: "打样对比中",
      detail: "正在读取 Lab、计算 Delta E 并判断是否达标",
      steps: ["读取目标 Lab 与阈值", "计算 Delta E", "判断达标结果"],
    });
  });

  it("does not show a process panel when there is no active action", () => {
    expect(getActionFeedback(null)).toBeNull();
  });
});
