import { randomUUID, createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { db } from "../src/db";
import { encryptCredentials } from "../src/credential-vault";
import { runScanJob } from "../src/scan-job";
import { scanTarget } from "../src/targets";
import { evidenceDirectory } from "../src/evidence-directory";

const url = process.env.BAROMI_SMOKE_URL;
const username = process.env.BAROMI_SMOKE_USERNAME;
const password = process.env.BAROMI_SMOKE_PASSWORD;
if (!url || !username || !password) throw new Error("BAROMI_SMOKE_URL, BAROMI_SMOKE_USERNAME, BAROMI_SMOKE_PASSWORD를 설정해야 합니다.");
const target = scanTarget(url);
if (!target) throw new Error("BAROMI_SMOKE_URL은 공개 HTTPS 쇼핑몰 주소여야 합니다.");
if (target.scenario !== "public") throw new Error("공개 쇼핑몰만 외부 진단할 수 있습니다.");
const publicTarget = target;
const credentials = { username: username!, password: password! };
const requestedRepeats = Number(process.env.BAROMI_SMOKE_REPEAT ?? "1");
const repeatCount = Number.isFinite(requestedRepeats) ? Math.min(Math.max(Math.floor(requestedRepeats), 1), 3) : 1;
const requestedHardTimeout = Number(process.env.BAROMI_SMOKE_HARD_TIMEOUT_MS ?? "360000");
const hardTimeoutMs = Number.isFinite(requestedHardTimeout) ? Math.min(Math.max(Math.floor(requestedHardTimeout), 30_000), 900_000) : 360_000;
const viewport = process.env.BAROMI_SMOKE_VIEWPORT === "MOBILE" ? "MOBILE" : "DESKTOP";
const purchasePath = process.env.BAROMI_SMOKE_PURCHASE_PATH === "DIRECT" ? "DIRECT" : "CART";

type PageTextEvidence = { tag: string; text: string; visible: boolean; fontSize: string; color: string; opacity: string; bounds: { x: number; y: number; width: number; height: number }; href?: string };
type PageInteractiveEvidence = { tag: string; label: string; role: string; type: string; visible: boolean; disabled: boolean; selected?: boolean; href?: string };
type ScanSummary = {
  scanStatus: string; reached: string | null; collectionFailure: string | null; collectionFailureCode: string | null;
  explorationBlocker: unknown; stageTimingsMs: Record<string, number>; durationMs: number;
  explorationMetrics: {
    productLinksFound: number; productLinksConsidered: number; productLinksUnselected: number; productLinksVisited: number;
    surfaceCandidates: number; surfaceCandidatesInspected: number; surfaceCandidatesUninspected: number;
    purchaseActions: number; priceResponses: number;
  };
  phaseResults: Record<string, { status: string; durationMs?: number; reason?: string }>;
  surfaceDestinations: { kind: string; href: string; text: string }[];
  siteCrawl: { complete: boolean; loginReplayed: boolean; controlProbeCount: number; controlProbeDurationMs: number; duplicateStates: number; visited: number; discovered: number; visitedStates: number; discoveredStates: number; uniqueVisitedUrls: number; uniqueDiscoveredUrls: number; productCards: number; failed: number; pending: string[]; unexploredControls: { url: string; label: string; reason: string }[]; nonNavigatingControls: { url: string; label: string; reason: string }[]; skippedControls: { url: string; label: string; reason: string }[]; pages: { url: string; statePath: string[]; outcome: string; failureReason?: string; durationMs?: number; title: string; text: string; domText: PageTextEvidence[]; linksFound: number; controlsFound: string[]; productCardsFound: string[]; bodyTextLength: number; anchorCount: number; interactiveCount: number; elementCount: number; hiddenTextElementCount: number; interactiveLabels: string[]; interactives: PageInteractiveEvidence[]; formCount: number }[] } | null;
  ruleCoverage: Record<string, { status: string; reason: string; evidenceIds: string[] }>;
  interactions: { id: string; stage: string; kind: string; outcome: string; afterSelected?: boolean; revealedText?: string[] }[];
  notTestedReasons: Record<string, string>;
  snapshots: {
    stage: string; path: string; productIdentity?: string; requestedProductIdentity?: string;
    cartItemCount?: number; cartCountBeforeAdd?: number; cartBaselineVerified?: boolean; requestedQuantity?: number;
    cartLineIdentities?: string[]; cartLinesComplete?: boolean; cartContentsVerified?: boolean;
    priceLineCount?: number; feeCount?: number; inspection?: { prices?: string; feeRows?: string };
    priceLines?: string[];
    payableAmount?: number;
    payableCandidates?: number[];
  }[];
  surfaceObservations: { kind: string; outcome: string; source?: string }[];
  findings: { type: string; stage: string; status: string; reason: string; evidenceIds: string[] }[];
  reviewCandidates: { id: string; kind: string; stage: string; text: string; reason: string; evidenceIds: string[]; ruleType?: string }[];
};
async function summarize(reportPath: string): Promise<ScanSummary> {
  const report = JSON.parse(await readFile(reportPath, "utf8")) as {
    scanStatus?: string; snapshots?: {
      stage: string; url: string; productIdentity?: string; requestedProductIdentity?: string;
      cartItemCount?: number; cartCountBeforeAdd?: number; cartBaselineVerified?: boolean; requestedQuantity?: number;
      cartLineIdentities?: string[]; cartLinesComplete?: boolean; cartContentsVerified?: boolean;
      priceLines?: string[]; fees?: unknown[]; inspection?: { prices?: string; feeRows?: string };
      payableAmount?: number;
      payableCandidates?: number[];
    }[]; collectionFailure?: string | null; collectionFailureCode?: string | null;
    explorationBlocker?: unknown; stageTimingsMs?: Record<string, number>; durationMs?: number;
    explorationMetrics?: ScanSummary["explorationMetrics"];
    phaseResults?: ScanSummary["phaseResults"];
    surfaceDestinations?: ScanSummary["surfaceDestinations"];
    siteCrawl?: {
      complete: boolean; loginReplayed?: boolean; controlProbeCount?: number; controlProbeDurationMs?: number; duplicateStates?: unknown[]; visitedUrlCount: number; discoveredUrlCount: number; visitedStateCount: number; discoveredStateCount: number; uniqueVisitedUrlCount: number; uniqueDiscoveredUrlCount: number; productCardCount: number; failedUrlCount: number; pendingUrls: string[];
      unexploredControls: { url: string; label: string; reason: string }[];
      nonNavigatingControls: { url: string; label: string; reason: string }[];
      skippedControls: { url: string; label: string; reason: string }[];
      pages: { url: string; statePath?: string[]; outcome: string; failureReason?: string; durationMs?: number; title: string; text: string; domText: PageTextEvidence[]; linksFound: number; controlsFound?: string[]; productCardsFound?: string[]; bodyTextLength: number; anchorCount: number; interactiveCount: number; elementCount: number; hiddenTextElementCount: number; interactives: PageInteractiveEvidence[]; formsFound: { method: string; action: string }[] }[];
    };
    ruleCoverage?: Record<string, { status: string; reason: string; evidenceIds?: string[] }>;
    interactions?: ScanSummary["interactions"];
    surfaceObservations?: { kind: string; outcome: string; source?: string }[];
    reviewCandidates?: { id: string; kind: string; stage: string; text: string; reason: string; evidenceIds: string[]; ruleType?: string }[];
    findings?: { type: string; stage: string; status: string; reason: string; evidence?: { evidenceId?: string }[] }[];
  };
  return {
    scanStatus: report.scanStatus ?? "UNKNOWN",
    reached: report.snapshots?.at(-1)?.stage ?? null,
    collectionFailure: report.collectionFailure ?? null,
    collectionFailureCode: report.collectionFailureCode ?? null,
    explorationBlocker: report.explorationBlocker ?? null,
    stageTimingsMs: report.stageTimingsMs ?? {},
    durationMs: report.durationMs ?? 0,
    explorationMetrics: report.explorationMetrics ?? {
      productLinksFound: 0, productLinksConsidered: 0, productLinksUnselected: 0, productLinksVisited: 0,
      surfaceCandidates: 0, surfaceCandidatesInspected: 0, surfaceCandidatesUninspected: 0,
      purchaseActions: 0, priceResponses: 0,
    },
    phaseResults: Object.fromEntries(Object.entries(report.phaseResults ?? {}).map(([phase, result]) => [phase, {
      status: result.status, durationMs: result.durationMs, reason: result.reason,
    }])),
    surfaceDestinations: (report.surfaceDestinations ?? []).map(({ kind, href, text }) => ({ kind, href, text: text.slice(0, 100) })),
    siteCrawl: report.siteCrawl ? {
      complete: report.siteCrawl.complete, loginReplayed: report.siteCrawl.loginReplayed === true,
      controlProbeCount: report.siteCrawl.controlProbeCount ?? 0,
      controlProbeDurationMs: report.siteCrawl.controlProbeDurationMs ?? 0,
      duplicateStates: report.siteCrawl.duplicateStates?.length ?? 0, visited: report.siteCrawl.visitedUrlCount,
      discovered: report.siteCrawl.discoveredUrlCount, visitedStates: report.siteCrawl.visitedStateCount,
      discoveredStates: report.siteCrawl.discoveredStateCount, uniqueVisitedUrls: report.siteCrawl.uniqueVisitedUrlCount,
      uniqueDiscoveredUrls: report.siteCrawl.uniqueDiscoveredUrlCount, productCards: report.siteCrawl.productCardCount,
      failed: report.siteCrawl.failedUrlCount,
      pending: report.siteCrawl.pendingUrls, unexploredControls: report.siteCrawl.unexploredControls,
      nonNavigatingControls: report.siteCrawl.nonNavigatingControls,
      skippedControls: report.siteCrawl.skippedControls,
      pages: report.siteCrawl.pages.map(({ url, statePath = [], outcome, failureReason, durationMs, title, text, domText, linksFound, controlsFound = [], productCardsFound = [], bodyTextLength, anchorCount, interactiveCount, elementCount, hiddenTextElementCount, interactives, formsFound }) => ({
        url, statePath, outcome, failureReason, durationMs, title, text, domText, linksFound, controlsFound, productCardsFound, bodyTextLength, anchorCount, interactiveCount,
        elementCount, hiddenTextElementCount, interactiveLabels: interactives.map(({ label }) => redactValidationText(label, credentials)).filter(Boolean),
        interactives: interactives.map((item) => ({ ...item, label: redactValidationText(item.label, credentials) })), formCount: formsFound.length,
      })),
    } : null,
    ruleCoverage: Object.fromEntries(Object.entries(report.ruleCoverage ?? {}).map(([type, result]) => [type, {
      status: result.status, reason: redactValidationText(result.reason, credentials), evidenceIds: result.evidenceIds ?? [],
    }])),
    interactions: (report.interactions ?? []).map(({ id, stage, kind, outcome, afterSelected, revealedText }) => ({ id, stage, kind, outcome, afterSelected, revealedText })),
    notTestedReasons: Object.fromEntries(Object.entries(report.ruleCoverage ?? {}).filter(([, result]) => result.status === "NOT_TESTED").map(([type, result]) => [type, result.reason])),
    snapshots: (report.snapshots ?? []).map(({ stage, url, productIdentity, requestedProductIdentity, cartItemCount,
      cartCountBeforeAdd, cartBaselineVerified, requestedQuantity, cartLineIdentities, cartLinesComplete, cartContentsVerified, priceLines, payableAmount, payableCandidates, fees, inspection }) => ({
      stage, path: (() => { try { return new URL(url).pathname; } catch { return ""; } })(),
      productIdentity, requestedProductIdentity, cartItemCount, cartCountBeforeAdd, cartBaselineVerified, requestedQuantity,
      cartLineIdentities, cartLinesComplete, cartContentsVerified,
      priceLineCount: priceLines?.length, priceLines: priceLines?.map((line) => redactValidationText(line, credentials)), payableAmount, payableCandidates, feeCount: fees?.length, inspection,
    })),
    surfaceObservations: (report.surfaceObservations ?? []).map(({ kind, outcome, source }) => ({ kind, outcome, source })),
    findings: (report.findings ?? []).map(({ type, stage, status, reason, evidence }) => ({
      type, stage, status, reason: redactValidationText(reason, credentials),
      evidenceIds: (evidence ?? []).map(({ evidenceId }) => evidenceId).filter(Boolean) as string[],
    })).sort((a, b) => a.type.localeCompare(b.type)),
    reviewCandidates: (report.reviewCandidates ?? []).map((candidate) => ({
      ...candidate, text: redactValidationText(candidate.text, credentials), reason: redactValidationText(candidate.reason, credentials),
    })),
  };
}

function redactValidationText(value: string, secrets: { username: string; password: string }) {
  return value
    .replaceAll(secrets.username, "[계정정보 가림]")
    .replaceAll(secrets.password, "[계정정보 가림]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[이메일 가림]")
    .replace(/(?:\+?82[- ]?)?0?1[016789][- ]?\d{3,4}[- ]?\d{4}/g, "[연락처 가림]");
}

function stableSummary(report: ScanSummary) {
  return JSON.stringify({
    scanStatus: report.scanStatus,
    reached: report.reached,
    collectionFailure: report.collectionFailure,
    collectionFailureCode: report.collectionFailureCode,
    explorationBlocker: report.explorationBlocker,
    surfaceObservations: report.surfaceObservations,
    siteCrawl: report.siteCrawl ? { complete: report.siteCrawl.complete, visited: report.siteCrawl.visited, discovered: report.siteCrawl.discovered, failed: report.siteCrawl.failed, pending: report.siteCrawl.pending, unexploredControls: report.siteCrawl.unexploredControls, nonNavigatingControls: report.siteCrawl.nonNavigatingControls, skippedControls: report.siteCrawl.skippedControls, pages: report.siteCrawl.pages } : null,
    findings: report.findings,
  });
}

function compactReport(report: ScanSummary) {
  const crawl = report.siteCrawl;
  const unexplored = new Map<string, number>();
  for (const item of crawl?.unexploredControls ?? []) {
    const key = `${item.label} · ${item.reason}`;
    unexplored.set(key, (unexplored.get(key) ?? 0) + 1);
  }
  return {
    scanStatus: report.scanStatus,
    durationMs: report.durationMs,
    stageTimingsMs: report.stageTimingsMs,
    phaseResults: report.phaseResults,
    explorationMetrics: report.explorationMetrics,
    crawl: crawl ? {
      complete: crawl.complete,
      loginReplayed: crawl.loginReplayed,
      duplicateStates: crawl.duplicateStates,
      uniqueVisitedUrls: crawl.uniqueVisitedUrls,
      uniqueDiscoveredUrls: crawl.uniqueDiscoveredUrls,
      visitedStates: crawl.visitedStates,
      discoveredStates: crawl.discoveredStates,
      productCards: crawl.productCards,
      failed: crawl.failed,
      pending: crawl.pending.length,
      unexploredControls: [...unexplored.entries()].map(([issue, count]) => ({ issue, count })),
      nonNavigatingControls: crawl.nonNavigatingControls,
      skippedControls: crawl.skippedControls,
      pages: crawl.pages.map(({ url, statePath, outcome, failureReason, durationMs, title, text, domText, controlsFound, productCardsFound, elementCount, hiddenTextElementCount, interactiveLabels, interactives, formCount }) => ({
        url, statePath, outcome, ...(failureReason ? { failureReason } : {}), durationMs, title, textLength: text.length,
        domTextCount: domText.length, controlsFound, productCardsFound, elementCount, hiddenTextElementCount,
        interactiveCount: interactives.length,
        selectedControls: interactives.filter(({ selected }) => selected).map(({ label, type }) => ({ label, type })),
        formCount,
      })),
    } : null,
    ruleCoverage: report.ruleCoverage,
    findings: report.findings,
  };
}

async function main() {
  const hardTimeout = setTimeout(() => {
    console.error(`외부 진단이 ${hardTimeoutMs}ms 제한을 초과해 중단되었습니다.`);
    process.exit(2);
  }, hardTimeoutMs);
  const store = db(); const shopId = randomUUID(); const scanIds: string[] = [];
  const ownerHash = createHash("sha256").update(`external-smoke:${shopId}`).digest("hex");
  try {
    await store.shop.create({ data: { id: shopId, url: publicTarget.url, ownerHash, verifiedAt: new Date() } });
    const reports: ScanSummary[] = [];
    const artifactBase = process.env.BAROMI_SMOKE_ARTIFACT_DIR ?? "scan-results/external-validation";
    const artifactsDirectory = join(artifactBase, `${new Date().toISOString().replace(/[:.]/g, "-")}-${new URL(publicTarget.url).hostname}`);
    await mkdir(artifactsDirectory, { recursive: true });
    for (let attempt = 0; attempt < repeatCount; attempt++) {
      const scanId = randomUUID(); scanIds.push(scanId);
      await store.scan.create({ data: { id: scanId, shopId, scenario: "public", executionMode: "DYNAMIC", viewport, purchasePath, targetUrl: publicTarget.url, status: "RUNNING", credentialCiphertext: encryptCredentials(credentials) } });
      const reportPath = await runScanJob(scanId, publicTarget.url);
      if (!reportPath) throw new Error("외부 진단 보고서 경로가 없습니다.");
      if (process.env.BAROMI_SMOKE_DEBUG_CART_SCREENSHOT === "1") {
        const rawReport = JSON.parse(await readFile(reportPath, "utf8")) as { snapshots?: { stage: string; screenshot?: string }[] };
        const cartScreenshot = rawReport.snapshots?.find(({ stage }) => stage === "cart")?.screenshot;
        if (cartScreenshot) await copyFile(join(dirname(reportPath), cartScreenshot), "/private/tmp/baromi-vero-cart-debug.png");
      }
      const summary = await summarize(reportPath);
      reports.push(summary);
      await writeFile(join(artifactsDirectory, `run-${attempt + 1}.json`), JSON.stringify(summary, null, 2) + "\n");
      await rm(evidenceDirectory(scanId), { recursive: true, force: true }).catch(() => undefined);
    }
    const baseline = stableSummary(reports[0]);
    const matchingRuns = reports.filter((report) => stableSummary(report) === baseline).length;
    const durations = reports.map((report) => report.durationMs);
    const result = { ok: true, scanIds, repeatCount, matchingRuns, repeatability: matchingRuns / reports.length,
      durationMs: { min: Math.min(...durations), max: Math.max(...durations), average: durations.reduce((sum, value) => sum + value, 0) / durations.length }, artifactsDirectory, reports: reports.map(compactReport) };
    await writeFile(join(artifactsDirectory, "result.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
  } finally {
    clearTimeout(hardTimeout);
    await store.scan.deleteMany({ where: { shopId } }).catch(() => undefined);
    await store.shop.deleteMany({ where: { id: shopId } }).catch(() => undefined);
    await store.$disconnect();
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
