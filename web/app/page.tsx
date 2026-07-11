"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  History,
  LoaderCircle,
  Play,
  RefreshCcw,
  Search,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  adoptSampleAction,
  compareSamplesAction,
  confirmRequirementAction,
  createRequirementAction,
  loadWorkbenchAction,
  matchHistoryAction,
  resetDemoAction,
  runAnalysisAction,
  selectCaseAction,
} from "./actions";
import { labToCssColor } from "./colorbridge/color-utils";
import { DEFAULT_CONFIRMATION } from "./colorbridge/demo-data";
import {
  getActionFeedback,
  type ActiveAction,
} from "./colorbridge/interaction-state";
import { delay, waitForMinimumDuration } from "./colorbridge/loading-state";
import type {
  ConfirmedRequirement,
  LabValue,
  StepId,
  WorkbenchState,
} from "./colorbridge/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const steps: { id: StepId; label: string }[] = [
  { id: "load", label: "客户需求集合" },
  { id: "analysis", label: "AI 分析" },
  { id: "confirm", label: "人工确认" },
  { id: "history", label: "历史案例" },
  { id: "sampling", label: "打样对比" },
  { id: "trace", label: "确认追溯" },
];

function completedIndex(state: WorkbenchState | null) {
  if (!state?.orderId && state?.status !== "fallback") return -1;
  if (state?.status === "fallback") return 5;
  if (state?.selectedSampleId) return 5;
  if (state?.sampleAttempts.length) return 4;
  if (state?.selectedCaseId) return 3;
  if (state?.confirmedFields) return 2;
  if (state?.analysis) return 1;
  if (state?.customerInput) return 0;
  return -1;
}

function formatLab(lab: LabValue) {
  return `L ${lab.l.toFixed(1)} / a ${lab.a.toFixed(1)} / b ${lab.b.toFixed(1)}`;
}

function sourceLabel(source: string | null | undefined) {
  if (!source) return "待分析";
  return source === "cached-demo-json" ? "缓存 JSON" : source;
}

export default function Home() {
  const [state, setState] = useState<WorkbenchState | null>(null);
  const [activeStep, setActiveStep] = useState<StepId>("load");
  const [form, setForm] = useState<ConfirmedRequirement>(DEFAULT_CONFIRMATION);
  const [customerDraft, setCustomerDraft] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const next = await loadWorkbenchAction();
      setState(next);
      setForm(next.confirmedFields ?? DEFAULT_CONFIRMATION);
      setCustomerDraft(next.customerInput);
    });
  }, []);

  const done = completedIndex(state);
  const targetLab = state?.confirmedFields?.targetLab ?? form.targetLab;
  const selectedCase = state?.historicalCases.find(
    (item) => item.id === state.selectedCaseId,
  );
  const selectedSample = state?.sampleAttempts.find(
    (item) => item.id === state.selectedSampleId,
  );
  const passingSample = state?.sampleAttempts.find((item) => item.passed);
  const traceReady = Boolean(
    state?.selectedSampleId || state?.status === "fallback",
  );
  const actionFeedback = getActionFeedback(activeAction);
  const isBusy = isPending || Boolean(activeAction);

  const statusText = useMemo(() => {
    if (actionFeedback) return actionFeedback.title;
    if (!state) return "初始化";
    if (state.error) return "缓存兜底";
    if (state.analysisError) return "AI 分析失败";
    if (done >= 5) return "已生成确认卡";
    return `流程 ${Math.max(done + 1, 1)}/6`;
  }, [actionFeedback, done, state]);

  function run(
    action: () => Promise<WorkbenchState>,
    nextStep: StepId,
    pendingAction: ActiveAction,
  ) {
    const startedAt = performance.now();
    setActiveAction(pendingAction);
    startTransition(async () => {
      try {
        const next = await action();
        setState(next);
        setForm(next.confirmedFields ?? form);
        setCustomerDraft(next.customerInput);
        setActiveStep(
          pendingAction === "analysis" && next.analysisError
            ? "analysis"
            : nextStep,
        );
      } finally {
        const remainingMs = waitForMinimumDuration(startedAt, performance.now());
        if (remainingMs) await delay(remainingMs);
        setActiveAction(null);
      }
    });
  }

  function updateLab(key: keyof LabValue, value: string) {
    setForm((current) => ({
      ...current,
      targetLab: { ...current.targetLab, [key]: Number(value) },
    }));
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[#eef1ec] text-[#18222c]">
        <header className="border-b border-[#cfd8d1] bg-[#fbfaf7] px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#44646d]">
                ColorBridge
              </p>
              <h1 className="text-2xl font-semibold text-[#14212a]">
                色译通打样工作台
              </h1>
              <p className="mt-1 text-sm text-[#50616c]">
                把模糊颜色表达转成可确认、可打样、可追溯的标准色需求。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="h-9 bg-white px-3 text-sm">
                {statusText}
              </Badge>
              <Badge
                variant="outline"
                className="h-9 bg-white px-3 text-sm text-[#2f5f5f]"
              >
                {sourceLabel(state?.analysisSource)}
              </Badge>
              <Button
                className="bg-[#1f6f78] text-white hover:bg-[#195d64]"
                disabled={isBusy}
                onClick={() => run(resetDemoAction, "analysis", "load")}
              >
                <ActionIcon active={activeAction === "load"}>
                  <Play />
                </ActionIcon>
                {activeAction === "load" ? "正在载入..." : "使用演示样例"}
              </Button>
              <Button
                variant="outline"
                disabled={isBusy}
                onClick={() => run(resetDemoAction, "load", "load")}
              >
                <ActionIcon active={activeAction === "load"}>
                  <RefreshCcw />
                </ActionIcon>
                {activeAction === "load" ? "正在重置..." : "重置 Demo"}
              </Button>
            </div>
          </div>
        </header>

        <Tabs
          value={activeStep}
          onValueChange={(value) => setActiveStep(value as StepId)}
          className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:px-6"
        >
          <aside className="self-start rounded-md border border-[#cfd8d1] bg-[#fbfaf7] p-3">
            <TabsList className="grid h-auto w-full gap-2 bg-transparent p-0">
              {steps.map((step, index) => (
                <Tooltip key={step.id}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={step.id}
                      disabled={step.id === "trace" && !traceReady}
                      className="h-12 justify-start gap-2 rounded-md border border-[#cfd8d1] bg-white px-3 py-2 text-left text-[#33424f] data-[state=active]:bg-[#1f6f78] data-[state=active]:text-white"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-current text-xs">
                        {index + 1}
                      </span>
                      <span className="truncate">{step.label}</span>
                      <span className="ml-auto text-xs">
                        {index <= done ? "完成" : "待办"}
                      </span>
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">{step.label}</TooltipContent>
                </Tooltip>
              ))}
            </TabsList>
          </aside>

          <section className="min-h-[640px] rounded-md border border-[#cfd8d1] bg-white p-4">
            {state?.error ? (
              <Alert className="mb-4 border-[#d7a64a] bg-[#fff7df] text-[#6f4d00]">
                <AlertTriangle />
                <AlertTitle>兜底路径已启用</AlertTitle>
                <AlertDescription>
                  当前使用缓存演示数据：{state.error}
                </AlertDescription>
              </Alert>
            ) : null}

            {actionFeedback ? (
              <ProcessPanel feedback={actionFeedback} className="mb-4" />
            ) : null}

            <TabsContent value="load" className="mt-0 grid gap-4">
              <SectionTitle
                title="1. 客户需求集合"
                description="粘贴客户原话、群聊摘要或业务员整理的需求，创建后进入 AI 分析。"
              />
              <div className="grid gap-2">
                <Label htmlFor="customer-requirement">客户需求集合</Label>
                <Textarea
                  id="customer-requirement"
                  value={customerDraft}
                  placeholder="例如：客户要一批棉针织卫衣布，颜色接近上一季的雾霾蓝，但这次不能偏紫，D65 下看要更稳重。"
                  className="min-h-40 resize-y text-sm leading-6"
                  onChange={(event) => setCustomerDraft(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-[#1f6f78] text-white hover:bg-[#195d64]"
                  disabled={isBusy}
                  onClick={() =>
                    run(
                      () => createRequirementAction(customerDraft),
                      "analysis",
                      "load",
                    )
                  }
                >
                  <ActionIcon active={activeAction === "load"}>
                    <ClipboardCheck />
                  </ActionIcon>
                  {activeAction === "load" ? "正在创建..." : "创建需求集合"}
                </Button>
                <Button
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => run(resetDemoAction, "analysis", "load")}
                >
                  <ActionIcon active={activeAction === "load"}>
                    <Play />
                  </ActionIcon>
                  {activeAction === "load" ? "正在载入..." : "使用演示样例"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => setCustomerDraft("")}
                >
                  <RefreshCcw />
                  清空
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="mt-0 grid gap-4">
              <SectionTitle
                title="2. AI 结构化分析"
                description="调用 DeepSeek V4 Flash 返回真实结构化 JSON；失败时显示错误，不静默写入缓存假数据。"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="bg-[#1f6f78] text-white hover:bg-[#195d64]"
                  disabled={isBusy}
                  onClick={() =>
                    run(
                      () => runAnalysisAction(state?.orderId ?? null),
                      "confirm",
                      "analysis",
                    )
                  }
                >
                  <ActionIcon active={activeAction === "analysis"}>
                    <ClipboardCheck />
                  </ActionIcon>
                  {activeAction === "analysis" ? "正在分析..." : "运行 AI 分析"}
                </Button>
                <Badge variant="outline">
                  来源：{sourceLabel(state?.analysisSource)}
                </Badge>
              </div>
              {state?.analysisError ? (
                <Alert className="border-[#d7a64a] bg-[#fff7df] text-[#6f4d00]">
                  <AlertTriangle />
                  <AlertTitle>AI 分析未完成</AlertTitle>
                  <AlertDescription>{state.analysisError}</AlertDescription>
                </Alert>
              ) : null}
              {activeAction === "analysis" ? (
                <AnalysisSkeleton />
              ) : state?.analysis ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="颜色意图" value={state.analysis.colorIntent} />
                  <Info label="目标颜色" value={state.analysis.targetColorName} />
                  <Info label="面料" value={state.analysis.fabric} />
                  <Info label="风险" value={state.analysis.avoidHueRisk} />
                  <Info
                    label="置信度"
                    value={`${Math.round(state.analysis.confidence * 100)}%`}
                  />
                  <Info
                    label="缺失字段"
                    value={
                      state.analysis.missingFields.length
                        ? state.analysis.missingFields.join("、")
                        : "无"
                    }
                  />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="confirm" className="mt-0 grid gap-4">
              <SectionTitle
                title="3. 人工确认缺失字段"
                description="确认光源、基布、目标 Lab 和 Delta E 阈值后再检索历史案例。"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="光源"
                  value={form.illuminant}
                  onChange={(value) => setForm({ ...form, illuminant: value })}
                />
                <Field
                  label="基布"
                  value={form.baseCloth}
                  onChange={(value) => setForm({ ...form, baseCloth: value })}
                />
                <NumberField
                  label="Lab L"
                  value={form.targetLab.l}
                  onChange={(value) => updateLab("l", value)}
                />
                <NumberField
                  label="Lab a"
                  value={form.targetLab.a}
                  onChange={(value) => updateLab("a", value)}
                />
                <NumberField
                  label="Lab b"
                  value={form.targetLab.b}
                  onChange={(value) => updateLab("b", value)}
                />
                <NumberField
                  label="Delta E 阈值"
                  value={form.deltaEThreshold}
                  onChange={(value) =>
                    setForm({ ...form, deltaEThreshold: Number(value) })
                  }
                />
              </div>
              <Button
                className="w-fit bg-[#1f6f78] text-white hover:bg-[#195d64]"
                disabled={isBusy}
                onClick={() =>
                  run(
                    () => confirmRequirementAction(state?.orderId ?? null, form),
                    "history",
                    "confirm",
                  )
                }
              >
                <ActionIcon active={activeAction === "confirm"}>
                  <CheckCircle2 />
                </ActionIcon>
                {activeAction === "confirm" ? "正在确认..." : "确认需求字段"}
              </Button>
            </TabsContent>

            <TabsContent value="history" className="mt-0 grid gap-4">
              <SectionTitle
                title="4. 相似历史案例"
                description="先命中确定性种子案例，再由操作员选择本次参考版本。"
              />
              <Button
                className="w-fit bg-[#1f6f78] text-white hover:bg-[#195d64]"
                disabled={isBusy}
                onClick={() =>
                  run(
                    () => matchHistoryAction(state?.orderId ?? null),
                    "history",
                    "history",
                  )
                }
              >
                <ActionIcon active={activeAction === "history"}>
                  <Search />
                </ActionIcon>
                {activeAction === "history"
                  ? "正在检索..."
                  : "检索 3 条候选案例"}
              </Button>
              <div className="grid gap-3">
                {state?.historicalCases.map((item) => {
                  const selected = item.id === state.selectedCaseId;
                  return (
                    <Card
                      key={item.id}
                      className={`gap-3 rounded-md py-3 shadow-none ${
                        selected ? "border-[#1f6f78] bg-[#f2fbfa]" : ""
                      }`}
                    >
                      <CardHeader className="px-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <CardTitle className="text-base">
                              {item.name}
                            </CardTitle>
                            <CardDescription>
                              {item.fabric} / {item.baseCloth} /{" "}
                              {formatLab(item.lab)}
                            </CardDescription>
                          </div>
                          <Button
                            variant={selected ? "secondary" : "outline"}
                            size="sm"
                            disabled={isBusy}
                            onClick={() =>
                              run(
                                () =>
                                  selectCaseAction(
                                    state?.orderId ?? null,
                                    item.id,
                                  ),
                                "sampling",
                                "select-case",
                              )
                            }
                          >
                            <ActionIcon active={activeAction === "select-case"}>
                              <ArrowRight />
                            </ActionIcon>
                            {activeAction === "select-case"
                              ? "保存中..."
                              : selected
                                ? "已选择"
                                : "选为参考"}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-1 px-3 text-sm">
                        <p>{item.similarityReason}</p>
                        <p className="text-[#8a4a1f]">{item.riskNote}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="sampling" className="mt-0 grid gap-4">
              <SectionTitle
                title="5. 打样 Lab 与 Delta E 对比"
                description="V1 未达标时停留在本步骤；V2 达标后必须人工采用才能进入追溯。"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="bg-[#1f6f78] text-white hover:bg-[#195d64]"
                  disabled={isBusy || !state?.selectedCaseId}
                  onClick={() =>
                    run(
                      () => compareSamplesAction(state?.orderId ?? null),
                      "sampling",
                      "sampling",
                    )
                  }
                >
                  <ActionIcon active={activeAction === "sampling"}>
                    <FlaskConical />
                  </ActionIcon>
                  {activeAction === "sampling"
                    ? "对比中..."
                    : state?.sampleAttempts.length
                      ? "继续打样"
                      : "对比打样结果"}
                </Button>
                {!state?.selectedCaseId ? (
                  <Badge variant="outline">请先选择参考案例</Badge>
                ) : null}
                {passingSample && !state?.selectedSampleId ? (
                  <Button
                    variant="outline"
                    disabled={isBusy}
                    onClick={() =>
                      run(
                        () =>
                          adoptSampleAction(
                            state?.orderId ?? null,
                            passingSample.id,
                          ),
                        "trace",
                        "adopt-sample",
                      )
                    }
                  >
                    <ActionIcon active={activeAction === "adopt-sample"}>
                      <CheckCircle2 />
                    </ActionIcon>
                    {activeAction === "adopt-sample"
                      ? "正在采用..."
                      : "采用达标样版"}
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {state?.sampleAttempts.map((item) => (
                  <Card
                    key={item.id}
                    className={`gap-3 rounded-md py-3 shadow-none ${
                      item.id === state.selectedSampleId
                        ? "border-[#1f6f78] bg-[#f2fbfa]"
                        : ""
                    }`}
                  >
                    <CardHeader className="flex-row items-center justify-between px-3">
                      <CardTitle className="text-base">{item.version}</CardTitle>
                      <Badge
                        className={
                          item.passed
                            ? "border-transparent bg-[#d9efe4] text-[#0f6842]"
                            : "border-transparent bg-[#f8ded7] text-[#9a3412]"
                        }
                      >
                        {item.passed ? "达标" : "未达标"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="grid gap-1 px-3 text-sm">
                      <p>{formatLab(item.lab)}</p>
                      <p>Delta E {item.deltaE.toFixed(1)}</p>
                      <p className="text-[#50616c]">{item.deviation}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {state?.sampleAttempts.length && !state.selectedSampleId ? (
                <Alert className="border-[#cfd8d1]">
                  <AlertTriangle />
                  <AlertTitle>追溯入口未开放</AlertTitle>
                  <AlertDescription>
                    只有采用达标样版后，才能进入确认卡和追溯时间线。
                  </AlertDescription>
                </Alert>
              ) : null}
            </TabsContent>

            <TabsContent value="trace" className="mt-0 grid gap-4">
              <SectionTitle
                title="6. 客户确认卡与追溯"
                description="汇总订单、AI 分析、人工确认、参考案例、达标样版和追溯事件。"
              />
              <div className="rounded-md border border-[#cfd8d1] bg-[#f8faf9] p-4">
                <h3 className="font-semibold">报告预览</h3>
                <p className="mt-2 text-sm">
                  需求：{state?.analysis?.targetColorName ?? "待分析"}，
                  {state?.analysis?.avoidHueRisk ?? "待补充风险"}。
                </p>
                <p className="text-sm">
                  条件：{state?.confirmedFields?.illuminant} /{" "}
                  {state?.confirmedFields?.baseCloth} / Delta E{" "}
                  {state?.confirmedFields?.deltaEThreshold}
                </p>
                <p className="text-sm">
                  参考案例：{selectedCase?.name ?? "未选择"}
                </p>
                <p className="text-sm">
                  达标样版：
                  {selectedSample?.version ?? passingSample?.version ?? "未采用"}
                </p>
              </div>
              <div className="grid gap-2">
                {state?.traceEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-md border border-[#cfd8d1] px-3 py-2 text-sm"
                  >
                    <p className="font-medium">{event.label}</p>
                    <p className="text-[#50616c]">{event.detail}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </section>

          <aside className="grid gap-4 self-start">
            <Card className="gap-3 rounded-md py-3 shadow-none">
              <CardHeader className="px-3">
                <CardTitle className="text-base">当前需求集合</CardTitle>
              </CardHeader>
              <CardContent className="px-3 text-sm text-[#50616c]">
                <span className="line-clamp-6">{state?.customerInput}</span>
              </CardContent>
            </Card>
            <Card className="gap-3 rounded-md py-3 shadow-none">
              <CardHeader className="px-3">
                <CardTitle className="text-base">目标 Lab 色块</CardTitle>
              </CardHeader>
              <CardContent className="px-3">
                <div
                  className="h-24 rounded-md border border-[#b8aea2]"
                  style={{ backgroundColor: labToCssColor(targetLab) }}
                />
                <p className="mt-2 text-sm">{formatLab(targetLab)}</p>
              </CardContent>
            </Card>
            <Card className="gap-3 rounded-md py-3 shadow-none">
              <CardHeader className="px-3">
                <CardTitle className="text-base">当前决策</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 px-3 text-sm text-[#50616c]">
                <p>参考案例：{selectedCase?.name ?? "待选择"}</p>
                <p>打样版本：{selectedSample?.version ?? "待采用"}</p>
                <p>AI 来源：{sourceLabel(state?.analysisSource)}</p>
              </CardContent>
            </Card>
            <Card className="gap-3 rounded-md py-3 shadow-none">
              <CardHeader className="px-3">
                <CardTitle className="text-base">风险提示</CardTitle>
              </CardHeader>
              <CardContent className="px-3 text-sm text-[#8a4a1f]">
                {state?.analysis?.avoidHueRisk ??
                  state?.analysisError ??
                  "运行 AI 分析后显示风险。"}
              </CardContent>
            </Card>
            <Separator />
            <Card className="gap-3 rounded-md py-3 shadow-none">
              <CardHeader className="px-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="size-4" />
                  追溯状态
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 text-sm text-[#50616c]">
                {actionFeedback?.detail ??
                  state?.traceEvents.at(-1)?.label ??
                  "等待需求集合创建"}
              </CardContent>
            </Card>
          </aside>
        </Tabs>
      </main>
    </TooltipProvider>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-[#50616c]">{description}</p>
    </div>
  );
}

function ActionIcon({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return active ? <LoaderCircle className="animate-spin" /> : children;
}

function ProcessPanel({
  feedback,
  className,
}: {
  feedback: NonNullable<ReturnType<typeof getActionFeedback>>;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-[#b7d3cf] bg-[#f2fbfa] p-3 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-[#1f6f78] text-white">
          <LoaderCircle className="size-4 animate-spin" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-[#173b40]">{feedback.title}</p>
          <p className="mt-1 text-sm text-[#50616c]">{feedback.detail}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {feedback.steps.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-2 rounded-md border border-[#cfd8d1] bg-white px-3 py-2 text-sm"
          >
            <span className="grid size-5 shrink-0 place-items-center rounded border border-[#1f6f78] text-xs text-[#1f6f78]">
              {index + 1}
            </span>
            <span className="truncate">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2" aria-label="AI 分析加载中">
      {["颜色意图", "目标颜色", "面料", "风险", "置信度", "缺失字段"].map(
        (label) => (
          <Card key={label} className="gap-2 rounded-md py-3 shadow-none">
            <CardHeader className="px-3">
              <CardDescription className="font-semibold text-[#44646d]">
                {label}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 px-3">
              <div className="h-3 w-11/12 animate-pulse rounded bg-[#dfe8e3]" />
              <div className="h-3 w-7/12 animate-pulse rounded bg-[#e8eee9]" />
            </CardContent>
          </Card>
        ),
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-2 rounded-md py-3 shadow-none">
      <CardHeader className="px-3">
        <CardDescription className="font-semibold text-[#44646d]">
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-3 text-sm">{value}</CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1 text-sm">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1 text-sm">
      <Label>{label}</Label>
      <Input
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
