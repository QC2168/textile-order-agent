"use server";

import {
  adoptSampleAttempt,
  attachHistoricalCases,
  attachNextSampleAttempt,
  confirmRequirement,
  createCustomerRequirementOrder,
  getWorkbenchState,
  resetDemoOrder,
  runAnalysis,
  selectHistoricalCase,
} from "./colorbridge/db";
import type { ConfirmedRequirement } from "./colorbridge/types";

export async function loadWorkbenchAction() {
  return getWorkbenchState();
}

export async function resetDemoAction() {
  return resetDemoOrder();
}

export async function resetAndAnalyzeDemoAction() {
  const created = await resetDemoOrder();
  if (!created.orderId) return created;
  return runAnalysis(created.orderId);
}

export async function createRequirementAction(customerInput: string) {
  return createCustomerRequirementOrder(customerInput);
}

export async function createAndAnalyzeRequirementAction(customerInput: string) {
  const created = await createCustomerRequirementOrder(customerInput);
  if (!created.orderId) return created;
  return runAnalysis(created.orderId);
}

export async function runAnalysisAction(orderId: string | null) {
  if (!orderId) return resetDemoOrder();
  return runAnalysis(orderId);
}

export async function confirmRequirementAction(
  orderId: string | null,
  fields: ConfirmedRequirement,
) {
  if (!orderId) return resetDemoOrder();
  return confirmRequirement(orderId, fields);
}

export async function matchHistoryAction(orderId: string | null) {
  if (!orderId) return resetDemoOrder();
  return attachHistoricalCases(orderId);
}

export async function selectCaseAction(orderId: string | null, caseId: string) {
  if (!orderId) return resetDemoOrder();
  return selectHistoricalCase(orderId, caseId);
}

export async function compareSamplesAction(orderId: string | null) {
  if (!orderId) return resetDemoOrder();
  return attachNextSampleAttempt(orderId);
}

export async function adoptSampleAction(
  orderId: string | null,
  sampleId: string,
) {
  if (!orderId) return resetDemoOrder();
  return adoptSampleAttempt(orderId, sampleId);
}
