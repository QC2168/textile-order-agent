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
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  adoptSampleAction,
  compareSamplesAction,
  createAndAnalyzeRequirementAction,
  confirmRequirementAction,
  loadWorkbenchAction,
  matchHistoryAction,
  resetAndAnalyzeDemoAction,
  resetDemoAction,
  selectCaseAction,
} from "./actions";
import {
  dyePlanForMaterial,
  labToCssColor,
  lightingRiskLabel,
  lightSceneLabel,
  previewLabForRendering,
} from "./colorbridge/color-utils";
import {
  adjustDraftLab,
  buildConfirmationDraft,
  confirmationDraftToRequirement,
  draftTargetLabToValue,
  REAL_WORLD_REFERENCE_LIGHTING,
  type ConfirmationDraft,
} from "./colorbridge/confirmation";
import {
  getActionFeedback,
  type ActiveAction,
} from "./colorbridge/interaction-state";
import { delay, waitForMinimumDuration } from "./colorbridge/loading-state";
import type {
  LabValue,
  StepId,
  WorkbenchState,
} from "./colorbridge/types";
import {
  displayLabForSchemeDecision,
  sampleAttemptLimitState,
} from "./colorbridge/workflow";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
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
  { id: "confirm", label: "人工确认" },
  { id: "history", label: "历史案例" },
  { id: "sampling", label: "方案选品" },
  { id: "trace", label: "确认追溯" },
];

const PRODUCTION_MATERIALS = ["纯棉", "人棉", "莫代尔", "锦纶", "涤棉混纺", "羊毛", "晴纶"];
const BASE_CLOTHS = ["本白布", "漂白布", "本白汗布", "本白罗纹", "客户原布"];

function completedIndex(state: WorkbenchState | null) {
  if (!state?.orderId && state?.status !== "fallback") return -1;
  if (state?.status === "fallback") return 4;
  if (state?.selectedSampleId) return 4;
  if (state?.sampleAttempts.length) return 3;
  if (state?.selectedCaseId) return 2;
  if (state?.confirmedFields) return 1;
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
  const [form, setForm] = useState<ConfirmationDraft>(
    buildConfirmationDraft({ analysis: null, confirmedFields: null }),
  );
  const [customerDraft, setCustomerDraft] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [isTuningOpen, setIsTuningOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const next = await loadWorkbenchAction();
      setState(next);
      setForm(buildConfirmationDraft(next));
      setCustomerDraft(next.customerInput);
    });
  }, []);

  const done = completedIndex(state);
  const confirmedRequirement = confirmationDraftToRequirement(form);
  const draftTargetLab = draftTargetLabToValue(form);
  const selectedCase = state?.historicalCases.find(
    (item) => item.id === state.selectedCaseId,
  );
  const targetLab =
    draftTargetLab ??
    state?.confirmedFields?.targetLab ??
    state?.analysis?.targetLab ??
    null;
  const aiTargetLab = state?.analysis?.targetLab ?? null;
  const referenceLab = selectedCase?.lab ?? aiTargetLab ?? draftTargetLab;
  const renderMaterial = form.productionMaterial || state?.analysis?.fabric || "";
  const renderBaseCloth = form.baseCloth || state?.analysis?.baseCloth || "";
  const livePreviewLab = draftTargetLab
    ? previewLabForRendering(
        draftTargetLab,
        form.illuminant,
        form.lighting,
        renderMaterial,
        renderBaseCloth,
      )
    : null;
  const riskLabel = lightingRiskLabel(form.illuminant, form.reviewIlluminant);
  const referenceSourceLabel = selectedCase
    ? "历史库样本"
    : "AI 初始提取 fallback";
  const materialPlan = dyePlanForMaterial(
    form.productionMaterial || state?.analysis?.fabric || "",
  );
  const selectedSample = state?.sampleAttempts.find(
    (item) => item.id === state.selectedSampleId,
  );
  const renderedTargetLab = displayLabForSchemeDecision({
    selectedSample,
    livePreviewLab,
    targetLab,
  });
  const renderedTargetLighting = selectedSample
    ? sampleLighting(selectedSample, form.lighting)
    : form.lighting;
  const decisionIlluminant = selectedSample?.illuminant ?? form.illuminant;
  const decisionReviewIlluminant =
    selectedSample?.reviewIlluminant ?? form.reviewIlluminant;
  const decisionProductionMaterial =
    selectedSample?.productionMaterial ?? form.productionMaterial;
  const decisionDyeType = selectedSample?.dyeType ?? form.dyeType;
  const decisionBaseCloth = selectedSample?.baseCloth ?? form.baseCloth;
  const sampleLimit = sampleAttemptLimitState(
    state?.sampleAttempts.length ?? 0,
  );
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
    if (done >= 4) return "已生成确认卡";
    return `流程 ${Math.max(done + 1, 1)}/5`;
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
        setForm(buildConfirmationDraft(next));
        setCustomerDraft(next.customerInput);
        setActiveStep(nextStep);
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
      targetLab: { ...current.targetLab, [key]: value },
    }));
  }

  function setLabValue(key: keyof LabValue, value: number) {
    updateLab(key, String(value));
  }

  function nudgeLab(delta: LabValue) {
    setForm((current) => adjustDraftLab(current, delta));
  }

  function updateLighting(
    key: keyof ConfirmationDraft["lighting"],
    value: number,
  ) {
    setForm((current) => ({
      ...current,
      lighting: { ...current.lighting, [key]: value },
    }));
  }

  function updateImagePrompt(
    key: keyof ConfirmationDraft["imagePromptHints"],
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      imagePromptHints: { ...current.imagePromptHints, [key]: value },
    }));
  }

  function selectProductionMaterial(value: string) {
    const dyePlan = dyePlanForMaterial(value);
    setForm((current) => ({
      ...current,
      productionMaterial: value,
      dyeType: dyePlan.dyeType,
      imagePromptHints: {
        ...current.imagePromptHints,
        materialHint: `${value} 对应 ${dyePlan.dyeType}`,
      },
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
                onClick={() =>
                  run(resetAndAnalyzeDemoAction, "confirm", "analysis")
                }
              >
                <ActionIcon active={activeAction === "analysis"}>
                  <Play />
                </ActionIcon>
                {activeAction === "analysis" ? "正在分析..." : "使用演示样例"}
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
          className="mx-auto grid max-w-[1560px] gap-4 px-4 py-4 lg:grid-cols-[200px_minmax(0,1fr)_300px] lg:px-6"
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
                description="粘贴客户原话、群聊摘要或业务员整理的需求，创建后自动提取可用参数并进入人工确认。"
              />
              <div className="grid gap-2">
                <Label htmlFor="customer-requirement">客户需求集合</Label>
                <Textarea
                  id="customer-requirement"
                  value={customerDraft}
                  placeholder="例如：客户要一批棉针织卫衣布，颜色接近上一季的雾霾蓝，但这次在日照看样下要更稳重。"
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
                      () => createAndAnalyzeRequirementAction(customerDraft),
                      "confirm",
                      "analysis",
                    )
                  }
                >
                  <ActionIcon active={activeAction === "analysis"}>
                    <ClipboardCheck />
                  </ActionIcon>
                  {activeAction === "analysis"
                    ? "正在提取参数..."
                    : "创建需求集合"}
                </Button>
                <Button
                  variant="outline"
                  disabled={isBusy}
                  onClick={() =>
                    run(resetAndAnalyzeDemoAction, "confirm", "analysis")
                  }
                >
                  <ActionIcon active={activeAction === "analysis"}>
                    <Play />
                  </ActionIcon>
                  {activeAction === "analysis" ? "正在分析..." : "使用演示样例"}
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

            <TabsContent value="confirm" className="mt-0 grid gap-4">
              <SectionTitle
                title="2. 确认目标色与方案参数"
                description="区分 AI 初始提取、人工实时确认和历史库参考；多光源预览只表达趋势，不替代实测光谱。"
              />
              <div className="grid gap-4">
                <div className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <ColorReviewCard
                      title="AI 初始提取参数"
                      lab={aiTargetLab}
                      emptyText="AI 尚未提取目标 Lab"
                      lines={[
                        `语义：${state?.analysis?.targetColorName ?? "待分析"}`,
                        `色彩意图：${state?.analysis?.colorIntent ?? "待分析"}`,
                        aiTargetLab
                          ? `AI 原始 Lab：${formatLab(aiTargetLab)}`
                          : "AI 原始 Lab：待提取",
                      ]}
                    />
                    <ColorReviewCard
                      title="人工确认实时值"
                      lab={livePreviewLab}
                      lighting={form.lighting}
                      illuminant={form.illuminant}
                      active
                      emptyText="待补全目标 Lab"
                      lines={[
                        livePreviewLab ? formatLab(livePreviewLab) : "Lab 待补全",
                        `看样环境：${lightSceneLabel(form.illuminant)} / ${form.lighting.cctKelvin}K`,
                        `观察：${form.lighting.viewingAngle}° / ${form.lighting.illuminanceLux} lux`,
                      ]}
                    />
                    <ColorReviewCard
                      title="历史库参考值"
                      lab={referenceLab}
                      dashed={!selectedCase}
                      emptyText="无历史参考"
                      lines={[
                        selectedCase
                          ? selectedCase.name
                          : "未命中历史库，暂用 AI 初始提取值",
                        `来源：${referenceSourceLabel}`,
                        selectedCase?.riskNote ?? "待历史样验证",
                      ]}
                    />
                  </div>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
                    <MaterialAndDyeControls
                      form={form}
                      materialPlan={materialPlan}
                      setForm={setForm}
                      selectProductionMaterial={selectProductionMaterial}
                    />
                    <LabAdjustmentControls
                      draftTargetLab={draftTargetLab}
                      updateLab={updateLab}
                      setLabValue={setLabValue}
                      nudgeLab={nudgeLab}
                      form={form}
                    />
                  </div>

                  <div className="grid gap-3 rounded-md border border-[#cfd8d1] bg-white p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="font-semibold">实时渲染预览</p>
                        <p className="mt-1 max-w-2xl text-sm text-[#50616c]">
                          当前预览绑定 Lab、看样环境、对照环境、色温、光照强度、观察角度、纹理/光泽、生产材质和染料类型。点击进入大屏调试后关闭，会同步回本页和右侧面板。
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="w-fit bg-[#1f6f78] text-white hover:bg-[#195d64]"
                        onClick={() => setIsTuningOpen(true)}
                      >
                        打开大屏调试
                      </Button>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <LivePreviewSurface
                        lab={livePreviewLab}
                        baseLab={draftTargetLab}
                        form={form}
                      />
                      <MaterialImpactPanel
                        form={form}
                        materialPlan={materialPlan}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="grid gap-2 rounded-md border border-[#cfd8d1] bg-white p-4">
                    <p className="font-semibold">确认参数</p>
                    <ParameterRow label="看样环境" value={`${lightSceneLabel(form.illuminant)} / ${form.lighting.cctKelvin}K / ${form.lighting.illuminanceLux} lux`} />
                    <ParameterRow label="对照环境" value={lightSceneLabel(form.reviewIlluminant || "")} />
                    <ParameterRow label="生产材质" value={form.productionMaterial || "待确认"} />
                    <ParameterRow label="染料" value={form.dyeType || materialPlan.dyeType} />
                    <ParameterRow label="基布" value={form.baseCloth || "待确认"} />
                    <ParameterRow label="目标 Lab" value={draftTargetLab ? formatLab(draftTargetLab) : "待补全"} />
                    <ParameterRow label="容差" value={`${form.deltaEThreshold || "待确认"} / ${form.toleranceMode}`} />
                    <ParameterRow label="确认备注" value={form.confirmationNote || "未填写"} />
                  </div>
                  <Alert className="border-[#d7a64a] bg-[#fffdf5] text-[#533600]">
                    <AlertTriangle />
                    <AlertTitle>风险与下一步</AlertTitle>
                    <AlertDescription>{riskLabel}</AlertDescription>
                  </Alert>
                </div>
              </div>
              <SpectralTuningDialog
                open={isTuningOpen}
                onOpenChange={setIsTuningOpen}
                form={form}
                setForm={setForm}
                draftTargetLab={draftTargetLab}
                livePreviewLab={livePreviewLab}
                materialPlan={materialPlan}
                riskLabel={riskLabel}
                updateLighting={updateLighting}
                updateImagePrompt={updateImagePrompt}
                updateLab={updateLab}
                setLabValue={setLabValue}
                nudgeLab={nudgeLab}
                selectProductionMaterial={selectProductionMaterial}
              />
              {!confirmedRequirement ? (
                <Alert className="border-[#d7a64a] bg-[#fff7df] text-[#6f4d00]">
                  <AlertTriangle />
                  <AlertTitle>仍有参数待确认</AlertTitle>
                  <AlertDescription>
                    请确认光源、基布、目标 Lab 和 Delta E 阈值后再进入历史案例。
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button
                className="w-fit bg-[#1f6f78] text-white hover:bg-[#195d64]"
                disabled={isBusy || !confirmedRequirement}
                onClick={() =>
                  confirmedRequirement
                    ? run(
                        () =>
                          confirmRequirementAction(
                            state?.orderId ?? null,
                            confirmedRequirement,
                          ),
                        "history",
                        "confirm",
                      )
                    : undefined
                }
              >
                <ActionIcon active={activeAction === "confirm"}>
                  <CheckCircle2 />
                </ActionIcon>
                {activeAction === "confirm" ? "正在确认..." : "确认方案参数"}
              </Button>
            </TabsContent>

            <TabsContent value="history" className="mt-0 grid gap-4">
              <SectionTitle
                title="3. 相似历史案例"
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
                title="4. 方案选品"
                description="把每次人工确认后的实时渲染成品保存为 V1、V2、V3 方案，可继续调试，也可直接选为最终方案。"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="bg-[#1f6f78] text-white hover:bg-[#195d64]"
                  disabled={isBusy || !state?.selectedCaseId || sampleLimit.reached}
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
                    ? "生成中..."
                    : sampleLimit.buttonText}
                </Button>
                <Button
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => setActiveStep("confirm")}
                >
                  回到人工确认继续调试
                </Button>
                {!state?.selectedCaseId ? (
                  <Badge variant="outline">请先选择参考案例</Badge>
                ) : null}
              </div>
              {sampleLimit.reached ? (
                <Alert className="border-[#d7a64a] bg-[#fffdf5] text-[#533600]">
                  <AlertTriangle />
                  <AlertTitle>已达到 3 个候选方案上限</AlertTitle>
                  <AlertDescription>
                    请从 V1、V2、V3 中选择最终方案；如仍需调整，回到人工确认修改 Lab、看样环境、材质或基布后，再重新生成方案。
                  </AlertDescription>
                </Alert>
              ) : null}
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
                      <Badge className="border-transparent bg-[#d9efe4] text-[#0f6842]">
                        可选方案
                      </Badge>
                    </CardHeader>
                    <CardContent className="grid gap-3 px-3 text-sm">
                      <div className="grid gap-2">
                        <SampleSwatch
                          label={`${item.version} 成品预览`}
                          lab={item.lab}
                          lighting={sampleLighting(item, form.lighting)}
                        />
                      </div>
                      {item.confirmationSummary ? (
                        <p className="text-[#50616c]">
                          推荐参数：{item.confirmationSummary}
                        </p>
                      ) : null}
                      <p className="text-[#50616c]">{item.deviation}</p>
                      <Button
                        className="w-fit bg-[#1f6f78] text-white hover:bg-[#195d64]"
                        disabled={isBusy}
                        onClick={() =>
                          run(
                            () =>
                              adoptSampleAction(
                                state?.orderId ?? null,
                                item.id,
                              ),
                            "trace",
                            "adopt-sample",
                          )
                        }
                      >
                        <ActionIcon active={activeAction === "adopt-sample"}>
                          <CheckCircle2 />
                        </ActionIcon>
                        {item.id === state?.selectedSampleId
                          ? "已选为最终方案"
                          : "选为最终方案"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {state?.sampleAttempts.length && !state.selectedSampleId ? (
                <Alert className="border-[#cfd8d1]">
                  <AlertTriangle />
                  <AlertTitle>请选择最终方案</AlertTitle>
                  <AlertDescription>
                    可以回到人工确认继续调试并保存下一版，也可以直接选择当前任一方案进入追溯。
                  </AlertDescription>
                </Alert>
              ) : null}
            </TabsContent>

            <TabsContent value="trace" className="mt-0 grid gap-4">
              <SectionTitle
                title="5. 客户确认卡与追溯"
                description="汇总订单、AI 分析、人工确认、参考案例、最终方案和追溯事件。"
              />
              <div className="rounded-md border border-[#cfd8d1] bg-[#f8faf9] p-4">
                <h3 className="font-semibold">报告预览</h3>
                <p className="mt-2 text-sm">
                  需求：{state?.analysis?.targetColorName ?? "待分析"}，
                  {state?.analysis?.avoidHueRisk ?? "待补充风险"}。
                </p>
                <p className="text-sm">
                  条件：{lightSceneLabel(state?.confirmedFields?.illuminant ?? "")} /{" "}
                  {state?.confirmedFields?.reviewIlluminant
                    ? lightSceneLabel(state.confirmedFields.reviewIlluminant)
                    : "未设置对照环境"} /{" "}
                  {state?.confirmedFields?.productionMaterial ?? "待确认材质"} /{" "}
                  {state?.confirmedFields?.baseCloth} / Delta E{" "}
                  {state?.confirmedFields?.deltaEThreshold}
                </p>
                <p className="text-sm">
                  参考案例：{selectedCase?.name ?? "未选择"}
                </p>
                <p className="text-sm">
                  确认方案：
                  {selectedSample?.version ?? "未采用"}
                  {selectedSample
                    ? ` / ${formatLab(selectedSample.lab)}`
                    : ""}
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
              <CardContent className="grid gap-2 px-3 text-sm text-[#50616c]">
                <p>任务编号：{state?.taskNo ?? "待生成"}</p>
                <p>客户名：{state?.customerName ?? "待填写"}</p>
                <span className="line-clamp-6">{state?.customerInput}</span>
              </CardContent>
            </Card>
            <Card className="gap-3 rounded-md py-3 shadow-none">
              <CardHeader className="px-3">
                <CardTitle className="text-base">实时目标 Lab</CardTitle>
              </CardHeader>
              <CardContent className="px-3">
                {renderedTargetLab ? (
                  <>
                    <div
                      className="h-24 rounded-md border border-[#b8aea2]"
                      style={previewSurfaceStyle(
                        renderedTargetLab,
                        renderedTargetLighting,
                      )}
                    />
                    <p className="mt-2 text-sm">{formatLab(renderedTargetLab)}</p>
                  </>
                ) : (
                  <div className="grid h-24 place-items-center rounded-md border border-dashed border-[#b8aea2] bg-[#f8faf9] text-sm text-[#50616c]">
                    待补充目标 Lab
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="gap-3 rounded-md py-3 shadow-none">
              <CardHeader className="px-3">
                <CardTitle className="text-base">当前决策</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 px-3 text-sm text-[#50616c]">
                <p>AI 目标：{state?.analysis?.targetColorName ?? "待分析"}</p>
                <p>面料：{state?.analysis?.fabric ?? "待分析"}</p>
                <p>看样环境：{lightSceneLabel(decisionIlluminant)}</p>
                <p>对照环境：{lightSceneLabel(decisionReviewIlluminant || "")}</p>
                <p>生产材质：{decisionProductionMaterial || "待确认"}</p>
                <p>染料：{decisionDyeType || materialPlan.dyeType}</p>
                <p>基布：{decisionBaseCloth || "待确认"}</p>
                <p>
                  容差：{form.deltaEThreshold || "待确认"} /{" "}
                  {form.toleranceMode}
                </p>
                <p>参考来源：{referenceSourceLabel}</p>
                <p>参考案例：{selectedCase?.name ?? "待选择"}</p>
                <p>
                  最终方案：
                  {selectedSample
                    ? `${selectedSample.version} / ${formatLab(selectedSample.lab)}`
                    : "待选择"}
                </p>
                <p>AI 来源：{sourceLabel(state?.analysisSource)}</p>
              </CardContent>
            </Card>
            <Card className="gap-3 rounded-md py-3 shadow-none">
              <CardHeader className="px-3">
                <CardTitle className="text-base">风险提示</CardTitle>
              </CardHeader>
              <CardContent className="px-3 text-sm text-[#8a4a1f]">
                {state?.analysisError ??
                  `${state?.analysis?.avoidHueRisk ?? "运行 AI 分析后显示风险。"} ${riskLabel}`}
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

function ColorReviewCard({
  title,
  lab,
  lighting,
  illuminant,
  lines,
  emptyText,
  active,
  dashed,
}: {
  title: string;
  lab: LabValue | null | undefined;
  lighting?: ConfirmationDraft["lighting"];
  illuminant?: string;
  lines: string[];
  emptyText: string;
  active?: boolean;
  dashed?: boolean;
}) {
  return (
    <div
      className={`rounded-md border bg-white p-3 ${
        active ? "border-[#1f6f78] ring-2 ring-[#d9eeee]" : "border-[#cfd8d1]"
      }`}
    >
      <p className="text-xs font-semibold uppercase text-[#44646d]">{title}</p>
      {lab ? (
        <div
          className={`my-2 h-24 rounded-md border ${
            dashed ? "border-dashed" : ""
          } border-[#b8aea2]`}
          style={
            lighting
              ? previewSurfaceStyle(lab, lighting)
              : { backgroundColor: labToCssColor(lab) }
          }
        />
      ) : (
        <div className="my-2 grid h-24 place-items-center rounded-md border border-dashed border-[#b8aea2] bg-[#f8faf9] text-xs text-[#50616c]">
          {emptyText}
        </div>
      )}
      <div className="grid gap-1 text-sm text-[#33424f]">
        {lighting ? (
          <p className="font-medium">{lightSceneLabel(illuminant ?? "")} 渲染成品</p>
        ) : null}
        {lines.map((line) => (
          <p key={line} className="break-words">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function SampleSwatch({
  label,
  lab,
  lighting,
}: {
  label: string;
  lab: LabValue | null | undefined;
  lighting: ConfirmationDraft["lighting"];
}) {
  return (
    <div className="grid gap-2 rounded-md border border-[#cfd8d1] bg-[#fbfaf7] p-2">
      <div
        className="h-14 rounded border border-[#b8aea2]"
        style={lab ? previewSurfaceStyle(lab, lighting) : { backgroundColor: "#eef1ec" }}
      />
      <div>
        <p className="text-xs font-semibold text-[#33424f]">{label}</p>
        <p className="text-xs text-[#50616c]">
          {lab ? formatLab(lab) : "待生成"}
        </p>
      </div>
    </div>
  );
}

function sampleLighting(
  sample: WorkbenchState["sampleAttempts"][number],
  fallback: ConfirmationDraft["lighting"],
) {
  return {
    cctKelvin: sample.cctKelvin ?? fallback.cctKelvin,
    illuminanceLux: sample.illuminanceLux ?? fallback.illuminanceLux,
    viewingAngle: sample.viewingAngle ?? fallback.viewingAngle,
    textureGloss: sample.textureGloss ?? fallback.textureGloss,
  };
}

function LivePreviewSurface({
  title,
  subtitle,
  lab,
  baseLab,
  form,
  large,
}: {
  title?: string;
  subtitle?: string;
  lab: LabValue | null | undefined;
  baseLab: LabValue | null | undefined;
  form: ConfirmationDraft;
  large?: boolean;
}) {
  const lux = form.lighting.illuminanceLux;
  const cct = form.lighting.cctKelvin;
  const angle = form.lighting.viewingAngle;
  const delta = lab && baseLab ? diffLab(baseLab, lab) : null;

  return (
    <div className="grid gap-3">
      <div
        className={`relative overflow-hidden rounded-md border border-[#b8aea2] ${
          large ? "min-h-[420px]" : "min-h-[260px]"
        }`}
        style={lab ? previewSurfaceStyle(lab, form.lighting) : undefined}
      >
        <div className="absolute left-3 top-3 rounded-md border border-white/55 bg-white/82 px-3 py-2 text-sm text-[#18222c] shadow-sm">
          <p className="font-semibold">
            {title ?? `${lightSceneLabel(form.illuminant)} 实时预览`}
          </p>
          {subtitle ? (
            <p className="text-[11px] text-[#50616c]">{subtitle}</p>
          ) : null}
          <p className="text-xs text-[#50616c]">
            {lab ? formatLab(lab) : "待补全 Lab"}
          </p>
        </div>
        <div className="absolute right-3 top-3 grid gap-1 rounded-md border border-white/55 bg-white/82 p-2 text-xs text-[#33424f] shadow-sm">
          <span>绑定色块</span>
          <span
            className="h-8 w-20 rounded border border-[#b8aea2]"
            style={{ backgroundColor: lab ? labToCssColor(lab) : "#eef1ec" }}
          />
        </div>
        <div className="absolute bottom-3 left-3 right-3 grid gap-2 rounded-md border border-white/55 bg-white/84 p-3 text-xs text-[#33424f] shadow-sm sm:grid-cols-4">
          <Metric label="色温" value={`${cct}K`} />
          <Metric label="光照" value={`${lux} lux`} />
          <Metric label="角度" value={`${angle}°`} />
          <Metric label="纹理/光泽" value={`${form.lighting.textureGloss}%`} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <DeltaMetric label="L 亮度变化" value={delta?.l ?? 0} />
        <DeltaMetric label="a 红绿变化" value={delta?.a ?? 0} />
        <DeltaMetric label="b 黄蓝变化" value={delta?.b ?? 0} />
      </div>
    </div>
  );
}

function previewSurfaceStyle(
  lab: LabValue,
  lighting: ConfirmationDraft["lighting"],
): CSSProperties {
  const gloss = lighting.textureGloss;
  const warmCool =
    lighting.cctKelvin < 5600
      ? `rgba(255, 188, 84, ${Math.min(0.28, (5600 - lighting.cctKelvin) / 10000)})`
      : `rgba(80, 164, 255, ${Math.min(0.22, (lighting.cctKelvin - 5600) / 12000)})`;
  const shade = Math.max(0.02, Math.min(0.13, 1 - lighting.illuminanceLux / 2600));
  const shine = Math.min(0.22, gloss / 260);

  return {
    backgroundColor: labToCssColor(lab),
    backgroundImage: [
      `radial-gradient(circle at ${28 + gloss * 0.55}% 22%, rgba(255,255,255,${shine}) 0, rgba(255,255,255,0) 34%)`,
      `linear-gradient(${lighting.viewingAngle}deg, rgba(255,255,255,0.1), rgba(0,0,0,${shade}))`,
      `linear-gradient(0deg, ${warmCool}, ${warmCool})`,
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 2px, rgba(0,0,0,0.018) 2px 5px)",
    ].join(", "),
  };
}

function MaterialImpactPanel({
  form,
  materialPlan,
}: {
  form: ConfirmationDraft;
  materialPlan: ReturnType<typeof dyePlanForMaterial>;
}) {
  const glossImpact = Math.round(form.lighting.textureGloss * 0.45);
  const materialImpact = materialVisualScore(form.productionMaterial);
  const baseImpact = baseClothVisualScore(form.baseCloth);
  const angleImpact = Math.round(Math.abs(form.lighting.viewingAngle - 45) * 0.35);
  const lightImpact = Math.round(
    Math.abs(form.lighting.illuminanceLux - 1000) / 80,
  );

  return (
    <div className="grid gap-2 rounded-md border border-[#cfd8d1] bg-[#fbfaf7] p-3 text-sm">
      <div>
        <p className="font-semibold">材质与染料影响</p>
        <p className="text-xs text-[#50616c]">
          {form.productionMaterial || materialPlan.materialFamily} /{" "}
          {form.dyeType || materialPlan.dyeType}
        </p>
      </div>
      <ImpactBar label="材质吸收" value={materialImpact} />
      <ImpactBar label="基布底色" value={baseImpact} />
      <ImpactBar label="纹理反光" value={glossImpact} />
      <ImpactBar label="观察角差" value={angleImpact} />
      <ImpactBar label="光照偏离" value={lightImpact} />
    </div>
  );
}

function materialVisualScore(material: string) {
  if (/涤棉|涤.*棉|棉.*涤/.test(material)) return 24;
  if (/(纯棉|人棉|莫代尔|棉)/.test(material)) return 18;
  if (/锦纶/.test(material)) return 20;
  if (/羊毛/.test(material)) return 26;
  if (/(晴纶|腈纶)/.test(material)) return 22;
  return 12;
}

function baseClothVisualScore(baseCloth: string) {
  if (baseCloth === "漂白布") return 12;
  if (baseCloth === "本白布") return 16;
  if (baseCloth === "本白汗布") return 18;
  if (baseCloth === "本白罗纹") return 20;
  if (baseCloth === "客户原布") return 26;
  return 10;
}

function MaterialAndDyeControls({
  form,
  materialPlan,
  setForm,
  selectProductionMaterial,
}: {
  form: ConfirmationDraft;
  materialPlan: ReturnType<typeof dyePlanForMaterial>;
  setForm: Dispatch<SetStateAction<ConfirmationDraft>>;
  selectProductionMaterial: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-[#cfd8d1] bg-white p-4">
      <p className="font-semibold">材质、基布与染料</p>
      <ChoiceGroup
        label="生产材质"
        value={form.productionMaterial}
        options={PRODUCTION_MATERIALS}
        onSelect={selectProductionMaterial}
      />
      <ChoiceGroup
        label="基布"
        value={form.baseCloth}
        options={BASE_CLOTHS}
        onSelect={(value) =>
          setForm((current) => ({ ...current, baseCloth: value }))
        }
      />
      <Field
        label="染料类型"
        value={form.dyeType || materialPlan.dyeType}
        onChange={(value) =>
          setForm((current) => ({ ...current, dyeType: value }))
        }
      />
    </div>
  );
}

function LabAdjustmentControls({
  draftTargetLab,
  updateLab,
  setLabValue,
  nudgeLab,
  form,
}: {
  draftTargetLab: LabValue | null;
  updateLab: (key: keyof LabValue, value: string) => void;
  setLabValue: (key: keyof LabValue, value: number) => void;
  nudgeLab: (delta: LabValue) => void;
  form: ConfirmationDraft;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-[#cfd8d1] bg-white p-4">
      <p className="font-semibold">目标 Lab 调节</p>
      <div className="grid gap-2 sm:grid-cols-3">
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
      </div>
      {draftTargetLab ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <NudgeButton onClick={() => nudgeLab({ l: -1, a: 0, b: 0 })}>
              更深
            </NudgeButton>
            <NudgeButton onClick={() => nudgeLab({ l: 1, a: 0, b: 0 })}>
              更浅
            </NudgeButton>
            <NudgeButton onClick={() => nudgeLab({ l: 0, a: -1, b: 0 })}>
              少红
            </NudgeButton>
            <NudgeButton onClick={() => nudgeLab({ l: 0, a: 0, b: -1 })}>
              更蓝
            </NudgeButton>
            <NudgeButton onClick={() => nudgeLab({ l: 0, a: 0, b: 1 })}>
              少蓝
            </NudgeButton>
          </div>
          <LabSlider
            label="亮度 L"
            hint="更深 / 更浅"
            min={0}
            max={100}
            value={draftTargetLab.l}
            onChange={(value) => setLabValue("l", value)}
          />
          <LabSlider
            label="红绿 a"
            hint="偏绿 / 偏红"
            min={-60}
            max={60}
            value={draftTargetLab.a}
            onChange={(value) => setLabValue("a", value)}
          />
          <LabSlider
            label="黄蓝 b"
            hint="偏蓝 / 偏黄"
            min={-60}
            max={80}
            value={draftTargetLab.b}
            onChange={(value) => setLabValue("b", value)}
          />
        </>
      ) : null}
    </div>
  );
}

function SpectralTuningDialog({
  open,
  onOpenChange,
  form,
  setForm,
  draftTargetLab,
  livePreviewLab,
  materialPlan,
  riskLabel,
  updateLighting,
  updateImagePrompt,
  updateLab,
  setLabValue,
  nudgeLab,
  selectProductionMaterial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ConfirmationDraft;
  setForm: Dispatch<SetStateAction<ConfirmationDraft>>;
  draftTargetLab: LabValue | null;
  livePreviewLab: LabValue | null;
  materialPlan: ReturnType<typeof dyePlanForMaterial>;
  riskLabel: string;
  updateLighting: (
    key: keyof ConfirmationDraft["lighting"],
    value: number,
  ) => void;
  updateImagePrompt: (
    key: keyof ConfirmationDraft["imagePromptHints"],
    value: string,
  ) => void;
  updateLab: (key: keyof LabValue, value: string) => void;
  setLabValue: (key: keyof LabValue, value: number) => void;
  nudgeLab: (delta: LabValue) => void;
  selectProductionMaterial: (value: string) => void;
}) {
  const referenceIlluminant = form.reviewIlluminant || form.illuminant;
  const referencePreviewLab = draftTargetLab
    ? previewLabForRendering(
        draftTargetLab,
        referenceIlluminant,
        REAL_WORLD_REFERENCE_LIGHTING,
        "",
        "",
      )
    : null;
  const referenceForm = {
    ...form,
    illuminant: referenceIlluminant,
    lighting: REAL_WORLD_REFERENCE_LIGHTING,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[92vh] w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] flex-col overflow-hidden border-[#91b8b6] bg-[#f8faf9] p-0 text-[#18222c] sm:max-w-[calc(100vw-48px)] xl:max-w-[1680px]"
      >
        <DialogHeader className="border-b border-[#cfd8d1] bg-[#fbfaf7] px-5 py-4 pr-5 text-left">
          <DialogTitle>大屏调试参数与实时渲染</DialogTitle>
          <DialogDescription className="mt-1 text-[#50616c]">
            这里调整的 Lab、光源、光度、材质和图片提示词，会直接同步到确认页和右侧面板。
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 items-start gap-4 overflow-y-auto p-5 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(380px,420px)]">
          <div className="grid min-w-0 gap-4">
            <div className="grid items-stretch gap-3 xl:grid-cols-2">
              <LivePreviewSurface
                title="真实环境对照"
                subtitle="只跟随对照环境；固定 6500K / 1000 lux / 45° / 20% 光泽"
                lab={referencePreviewLab}
                baseLab={draftTargetLab}
                form={referenceForm}
              />
              <LivePreviewSurface
                title="当前调试预览"
                subtitle="跟随右侧 Lab、看样环境、光照和材质实时变化"
                lab={livePreviewLab}
                baseLab={draftTargetLab}
                form={form}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <MaterialImpactPanel form={form} materialPlan={materialPlan} />
              <Alert className="border-[#d7a64a] bg-[#fffdf5] text-[#533600]">
                <AlertTriangle />
                <AlertTitle>同色异谱风险</AlertTitle>
                <AlertDescription>{riskLabel}</AlertDescription>
              </Alert>
            </div>
          </div>

          <div className="grid min-w-0 content-start gap-4">
            <div className="grid gap-3 rounded-md border border-[#cfd8d1] bg-white p-4">
              <LightChoiceGroup
                label="看样环境"
                value={form.illuminant}
                onSelect={(value) =>
                  setForm((current) => ({ ...current, illuminant: value }))
                }
              />
              <LightChoiceGroup
                label="对照环境"
                value={form.reviewIlluminant}
                onSelect={(value) =>
                  setForm((current) => ({ ...current, reviewIlluminant: value }))
                }
              />
              <LightSlider
                label="模拟日光色温 CCT"
                value={form.lighting.cctKelvin}
                min={2700}
                max={9000}
                unit="K"
                onChange={(value) => updateLighting("cctKelvin", value)}
              />
              <LightSlider
                label="光照强度"
                value={form.lighting.illuminanceLux}
                min={100}
                max={2000}
                unit="lux"
                onChange={(value) => updateLighting("illuminanceLux", value)}
              />
              <LightSlider
                label="观察角度"
                value={form.lighting.viewingAngle}
                min={0}
                max={90}
                unit="°"
                onChange={(value) => updateLighting("viewingAngle", value)}
              />
              <LightSlider
                label="纹理/光泽影响"
                value={form.lighting.textureGloss}
                min={0}
                max={100}
                unit="%"
                onChange={(value) => updateLighting("textureGloss", value)}
              />
            </div>

          <MaterialAndDyeControls
            form={form}
            materialPlan={materialPlan}
            setForm={setForm}
            selectProductionMaterial={selectProductionMaterial}
          />

          <LabAdjustmentControls
            draftTargetLab={draftTargetLab}
            updateLab={updateLab}
            setLabValue={setLabValue}
            nudgeLab={nudgeLab}
            form={form}
          />

          <div className="grid gap-3 rounded-md border border-[#cfd8d1] bg-white p-4">
            <ChoiceGroup
              label="Delta E 阈值"
              value={form.deltaEThreshold}
              options={["1.0", "1.2", "1.5"]}
              onSelect={(value) =>
                setForm((current) => ({ ...current, deltaEThreshold: value }))
              }
            />
            <ChoiceGroup
              label="容差模式"
              value={form.toleranceMode}
              options={["deltaE76", "cmc"]}
              onSelect={(value) =>
                setForm((current) => ({
                  ...current,
                  toleranceMode: value as ConfirmationDraft["toleranceMode"],
                }))
              }
            />
            <Field
              label="确认备注"
              value={form.confirmationNote}
              onChange={(value) =>
                setForm((current) => ({ ...current, confirmationNote: value }))
              }
            />
            <div className="grid gap-2">
              <Label>图片内容提示词</Label>
              <Textarea
                value={form.imagePromptHints.colorDescription}
                onChange={(event) =>
                  updateImagePrompt("colorDescription", event.target.value)
                }
              />
              <Textarea
                value={form.imagePromptHints.imageRisk}
                onChange={(event) =>
                  updateImagePrompt("imageRisk", event.target.value)
                }
              />
              <Textarea
                value={form.imagePromptHints.materialHint}
                onChange={(event) =>
                  updateImagePrompt("materialHint", event.target.value)
                }
              />
              <Textarea
                value={form.imagePromptHints.followUpSuggestion}
                onChange={(event) =>
                  updateImagePrompt("followUpSuggestion", event.target.value)
                }
              />
            </div>
          </div>
        </div>
        </div>
        <DialogFooter className="border-t border-[#cfd8d1] bg-[#fbfaf7] px-5 py-3">
          <DialogClose asChild>
            <Button
              type="button"
              className="bg-[#1f6f78] text-white hover:bg-[#195d64]"
            >
              完成调试
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[#50616c]">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function DeltaMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#cfd8d1] bg-white p-3 text-sm">
      <p className="text-xs text-[#50616c]">{label}</p>
      <p className="mt-1 font-semibold">{formatSigned(value)}</p>
    </div>
  );
}

function ImpactBar({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-xs text-[#50616c]">
        <span>{label}</span>
        <span>{safeValue}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-[#dfe8e3]">
        <div
          className="h-full rounded bg-[#1f6f78]"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function diffLab(base: LabValue, next: LabValue) {
  return {
    l: Number((next.l - base.l).toFixed(1)),
    a: Number((next.a - base.a).toFixed(1)),
    b: Number((next.b - base.b).toFixed(1)),
  };
}

function formatSigned(value: number) {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function NudgeButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

function LightSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-xs font-medium text-[#33424f]">
          {value}
          {unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={unit === "K" ? 100 : 1}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        aria-label={label}
      />
    </div>
  );
}

function ParameterRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
      <span className="text-sm font-semibold text-[#18222c]">{label}</span>
      <span className="min-h-9 rounded-md border border-[#cfd8d1] bg-white px-3 py-2 text-sm text-[#18222c]">
        {value}
      </span>
    </div>
  );
}

function LabSlider({
  label,
  hint,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-xs text-[#50616c]">{hint}</span>
      </div>
      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3">
        <span className="text-right text-xs text-[#50616c]">{min}</span>
        <Slider
          min={min}
          max={max}
          step={0.1}
          value={[value]}
          onValueChange={([next]) => onChange(next)}
          aria-label={label}
        />
        <span className="text-xs text-[#50616c]">{max}</span>
      </div>
      <Input
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            variant={value === option ? "secondary" : "outline"}
            size="sm"
            onClick={() => onSelect(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

const lightChoices = [
  { value: "D65", label: "日照看样", hint: "D65" },
  { value: "D50", label: "柔和看样灯", hint: "D50" },
  { value: "TL84/F11", label: "商场/办公室光", hint: "TL84" },
  { value: "A 光源", label: "室内暖光", hint: "A" },
  { value: "LED-B3", label: "LED门店光", hint: "B3" },
  { value: "ID65", label: "冷白日光", hint: "ID65" },
];

function LightChoiceGroup({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 text-sm">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {lightChoices.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? "secondary" : "outline"}
            size="sm"
            className="h-auto flex-col items-start gap-0 px-3 py-2 text-left"
            onClick={() => onSelect(option.value)}
          >
            <span>{option.label}</span>
            <span className="text-xs opacity-70">{option.hint}</span>
          </Button>
        ))}
      </div>
    </div>
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
  value: string;
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
