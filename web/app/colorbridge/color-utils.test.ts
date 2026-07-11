import { describe, expect, it } from "vitest";
import { deltaE76, labToCssColor } from "./color-utils";

describe("deltaE76", () => {
  it("calculates CIE76 distance and rounds to one decimal place", () => {
    expect(deltaE76({ l: 50, a: 0, b: 0 }, { l: 47, a: 4, b: 0 })).toBe(5);
    expect(
      deltaE76(
        { l: 62.4, a: -3.1, b: -11.8 },
        { l: 62.1, a: -2.9, b: -12 },
      ),
    ).toBe(0.4);
  });
});

describe("labToCssColor", () => {
  it("maps a Lab value to the deterministic HSL swatch used by the demo", () => {
    expect(labToCssColor({ l: 62.4, a: -3.1, b: -11.8 })).toBe(
      "hsl(198 27% 62%)",
    );
  });

  it("clamps extreme Lab values into the display-safe range", () => {
    expect(labToCssColor({ l: 90, a: 40, b: 40 })).toBe("hsl(228 30% 78%)");
  });
});
