export type ActiveAction =
  | "load"
  | "analysis"
  | "confirm"
  | "history"
  | "select-case"
  | "sampling"
  | "adopt-sample"
  | null;

const feedback = {
  load: {
    title: "需求集合创建中",
    detail: "正在保存客户输入并初始化流程状态",
    steps: ["规范化输入内容", "创建需求集合", "准备 AI 分析"],
  },
  analysis: {
    title: "AI 分析中",
    detail: "正在调用模型并解析结构化颜色需求",
    steps: ["读取需求集合", "调用 DeepSeek V4 Flash", "解析结构化 JSON"],
  },
  confirm: {
    title: "字段确认中",
    detail: "正在保存光源、基布、目标 Lab 与验收阈值",
    steps: ["校验确认字段", "保存订单要求", "准备历史检索"],
  },
  history: {
    title: "历史案例检索中",
    detail: "正在匹配相似案例并生成参考候选",
    steps: ["读取历史案例", "匹配面料与 Lab", "生成候选参考"],
  },
  "select-case": {
    title: "参考案例保存中",
    detail: "正在锁定本次调色参考案例",
    steps: ["记录选中案例", "写入追溯事件", "准备打样对比"],
  },
  sampling: {
    title: "打样对比中",
    detail: "正在读取 Lab、计算 Delta E 并判断是否达标",
    steps: ["读取目标 Lab 与阈值", "计算 Delta E", "判断达标结果"],
  },
  "adopt-sample": {
    title: "样版采用中",
    detail: "正在校验达标状态并生成确认追溯入口",
    steps: ["校验达标样版", "锁定客户确认版本", "汇总追溯时间线"],
  },
} satisfies Record<NonNullable<ActiveAction>, { title: string; detail: string; steps: string[] }>;

export function getActionFeedback(action: ActiveAction) {
  return action ? feedback[action] : null;
}
