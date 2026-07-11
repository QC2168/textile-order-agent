import { describe, expect, it } from "vitest";

import { DEMO_CUSTOMER_INPUT } from "./demo-data";
import { normalizeCustomerRequirementInput } from "./customer-input";

describe("normalizeCustomerRequirementInput", () => {
  it("keeps real customer requirement content and trims surrounding whitespace", () => {
    expect(normalizeCustomerRequirementInput("  客户要黑色棉卫衣，不能发红  ")).toBe(
      "客户要黑色棉卫衣，不能发红",
    );
  });

  it("falls back to the demo requirement when the input is blank", () => {
    expect(normalizeCustomerRequirementInput("   ")).toBe(DEMO_CUSTOMER_INPUT);
  });
});
