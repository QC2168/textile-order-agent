import { DEMO_CUSTOMER_INPUT } from "./demo-data";

export function normalizeCustomerRequirementInput(input: string) {
  const normalized = input.trim();
  return normalized || DEMO_CUSTOMER_INPUT;
}
