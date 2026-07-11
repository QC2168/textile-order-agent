export const MIN_LOADING_MS = 350;

export function waitForMinimumDuration(
  startedAt: number,
  finishedAt: number,
  minimumMs = MIN_LOADING_MS,
) {
  return Math.max(0, minimumMs - (finishedAt - startedAt));
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
