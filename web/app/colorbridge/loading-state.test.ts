import { describe, expect, it } from "vitest";

import { waitForMinimumDuration } from "./loading-state";

describe("waitForMinimumDuration", () => {
  it("waits for the remaining visible loading duration", () => {
    expect(waitForMinimumDuration(1000, 1080, 250)).toBe(170);
  });

  it("does not wait when the action already exceeded the minimum duration", () => {
    expect(waitForMinimumDuration(1000, 1300, 250)).toBe(0);
  });
});
