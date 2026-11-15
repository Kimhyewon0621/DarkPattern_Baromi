const configuredMs = Number(process.env.BAROMI_SCAN_STALE_MS ?? 300_000);

/**
 * The worker must recover jobs no later than the browser's hard execution cap.
 * Keep the value bounded so a bad environment variable cannot reintroduce
 * multi-minute or effectively unbounded stuck jobs.
 */
export const scanStaleMs = Number.isFinite(configuredMs)
  ? Math.min(Math.max(Math.trunc(configuredMs), 60_000), 600_000)
  : 300_000;

export const scanStaleBefore = (now = Date.now()) => new Date(now - scanStaleMs);
