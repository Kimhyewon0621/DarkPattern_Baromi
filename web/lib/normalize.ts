import type { Report, ScanState, ScanStatus, SurfaceKind, SurfaceStatus } from "./types";
import { surfaceKinds } from "./types";

/**
 * The public API normalizes Spring's lowercase states, but the UI stays defensive:
 * a lowercase or `succeeded` status from any path still renders correctly.
 */
export function normalizeStatus(value: unknown): ScanStatus {
  const upper = String(value ?? "").toUpperCase();
  if (upper === "SUCCEEDED") return "COMPLETED";
  return (["QUEUED", "RUNNING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"] as const).find((s) => s === upper) ?? "FAILED";
}

/** Spec examples use SEARCH / LOGIN; the Node API uses CATALOG / AUTH. Both map onto the same seven areas. */
const surfaceAlias: Record<string, SurfaceKind> = {
  CATALOG: "CATALOG", SEARCH: "CATALOG", CATEGORY: "CATALOG", LIST: "CATALOG",
  AUTH: "AUTH", LOGIN: "AUTH", SIGNUP: "AUTH", JOIN: "AUTH",
  COUPON: "COUPON", PROMOTION: "COUPON",
  RECOMMENDATION: "RECOMMENDATION", REVIEW: "RECOMMENDATION", POPULAR: "RECOMMENDATION",
  SUBSCRIPTION: "SUBSCRIPTION", MEMBERSHIP: "SUBSCRIPTION",
  CANCELLATION: "CANCELLATION", CANCEL: "CANCELLATION", REFUND: "CANCELLATION", WITHDRAWAL: "CANCELLATION",
  POLICY: "POLICY", SHIPPING: "POLICY",
};
const surfaceRank: Record<SurfaceStatus, number> = { COVERED: 6, DISCOVERED: 5, BLOCKED: 4, NOT_FOUND: 3, PENDING: 2, SKIPPED: 1 };
const isSurfaceStatus = (value: unknown): value is SurfaceStatus => typeof value === "string" && value in surfaceRank;

export function normalizeSurfaces(raw: Record<string, unknown> | undefined | null, fallback: SurfaceStatus): Record<SurfaceKind, SurfaceStatus> {
  const result = Object.fromEntries(surfaceKinds.map((kind) => [kind, undefined])) as Record<SurfaceKind, SurfaceStatus | undefined>;
  for (const [key, value] of Object.entries(raw ?? {})) {
    const kind = surfaceAlias[key.toUpperCase()];
    const status = typeof value === "string" ? value.toUpperCase() : value;
    if (!kind || !isSurfaceStatus(status)) continue;
    const current = result[kind];
    if (!current || surfaceRank[status] > surfaceRank[current]) result[kind] = status;
  }
  return Object.fromEntries(surfaceKinds.map((kind) => [kind, result[kind] ?? fallback])) as Record<SurfaceKind, SurfaceStatus>;
}

export function normalizeScan(raw: ScanState): ScanState {
  const status = normalizeStatus(raw.status);
  const active = status === "QUEUED" || status === "RUNNING";
  return {
    ...raw,
    status,
    cancelRequested: Boolean(raw.cancelRequested),
    progress: Math.max(0, Math.min(100, Number(raw.progress) || (active ? 0 : 100))),
    surfaceCoverage: normalizeSurfaces(raw.surfaceCoverage, active ? "PENDING" : "NOT_FOUND"),
  };
}

export function normalizeReport(raw: Report): Report {
  return {
    ...raw,
    targetUrl: raw.targetUrl ?? "",
    scanStatus: raw.scanStatus ? normalizeStatus(raw.scanStatus) : "COMPLETED",
    executionMode: raw.executionMode ?? "DYNAMIC",
    findings: raw.findings ?? [],
    summary: raw.summary ?? { suspected: 0, reviewNeeded: 0, notTested: 0 },
    surfaceCoverage: normalizeSurfaces(raw.surfaceCoverage, raw.executionMode === "STATIC" ? "SKIPPED" : "NOT_FOUND"),
  };
}
