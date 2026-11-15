import { setTimeout as delay } from "node:timers/promises";
import { db } from "../src/db";
import { runScanJob } from "../src/scan-job";
import { notifySpringScanStatus } from "../src/spring-status";
import { claimSpringScan, isClaimCompatible, recoverSpringScans } from "../src/spring-queue";
import { runAiReviewJob } from "../src/ai-review-job";
import { scanStaleBefore } from "../src/scan-timeout";
import { initialScanPhases, parseScanPhases, updateScanPhase } from "../src/scan-phases";

async function main() {
  const store = db();
  let stopping = false;
  let lastSpringRecovery = 0;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });

  try {
    while (!stopping) {
      if (Date.now() - lastSpringRecovery >= 30_000) {
        lastSpringRecovery = Date.now();
        await recoverSpringScans(scanStaleBefore()).catch((error) => console.warn(error instanceof Error ? error.message : error));
        await store.$executeRaw`
          UPDATE "AiReview" SET status = 'FAILED', completedAt = CURRENT_TIMESTAMP, error = '워커 재시작으로 작업이 만료되었습니다.'
          WHERE status = 'RUNNING' AND startedAt IS NOT NULL
          AND julianday("startedAt") < julianday(${scanStaleBefore().toISOString()})
        `.catch((error) => console.warn(error instanceof Error ? error.message : error));
      }
      const springJob = await claimSpringScan().catch((error) => { console.warn(error instanceof Error ? error.message : error); return null; });
      if (springJob) {
        const local = await store.scan.findUnique({ where: { id: springJob.scanId }, select: { status: true, targetUrl: true, phaseResultsJson: true } });
        const targetMatches = isClaimCompatible(local, springJob);
        const started = targetMatches
          ? await store.scan.updateMany({ where: { id: springJob.scanId, status: "QUEUED" }, data: {
            status: "RUNNING", startedAt: new Date(), durationMs: null,
            phaseResultsJson: local?.phaseResultsJson && local.phaseResultsJson !== "{}" ? local.phaseResultsJson : JSON.stringify(initialScanPhases(springJob.purchasePath === "DIRECT" ? "DIRECT" : "CART", springJob.executionMode === "DYNAMIC")),
          } })
          : { count: 0 };
        if (started.count) {
          const dynamicPhases = springJob.executionMode === "DYNAMIC";
          const purchasePath = springJob.purchasePath === "DIRECT" ? "DIRECT" : "CART";
          await runScanJob(springJob.scanId, springJob.targetUrl ?? "", {
            onPhase: async (phaseId, status, details = {}) => {
              const current = await store.scan.findUnique({ where: { id: springJob.scanId }, select: { phaseResultsJson: true } });
              const phases = updateScanPhase(parseScanPhases(current?.phaseResultsJson, initialScanPhases(purchasePath, dynamicPhases)), phaseId, { status, ...details });
              await store.scan.update({ where: { id: springJob.scanId }, data: { phaseResultsJson: JSON.stringify(phases), currentStage: `${phaseId}:${status}` } });
            },
          }).catch((error) => console.error(springJob.scanId, error));
        } else {
          if (local && !targetMatches) console.error(`${springJob.scanId} Spring/SQLite target mismatch; refusing to run`);
          await notifySpringScanStatus(springJob.scanId, "failed");
        }
        continue;
      }
      // Reconcile jobs from an interrupted worker once their execution limit has passed.
      await store.$executeRaw`
        UPDATE "Scan" SET status = CASE WHEN "cancelRequested" THEN 'CANCELLED' ELSE 'FAILED' END
      WHERE status = 'RUNNING' AND "startedAt" IS NOT NULL
          AND ("cancelRequested" OR julianday("startedAt") < julianday(${scanStaleBefore().toISOString()}))
      `;
      const [job] = await store.$queryRaw<{ id: string; targetUrl: string; purchasePath: string; executionMode: string }[]>`
        UPDATE "Scan" SET status = 'RUNNING', "startedAt" = CURRENT_TIMESTAMP, "durationMs" = NULL,
          "phaseResultsJson" = CASE WHEN "phaseResultsJson" = '{}'
            THEN CASE WHEN "purchasePath" = 'DIRECT'
              THEN CASE WHEN "executionMode" = 'DYNAMIC' THEN ${JSON.stringify(initialScanPhases("DIRECT", true))} ELSE ${JSON.stringify(initialScanPhases("DIRECT", false))} END
              ELSE CASE WHEN "executionMode" = 'DYNAMIC' THEN ${JSON.stringify(initialScanPhases("CART", true))} ELSE ${JSON.stringify(initialScanPhases("CART", false))} END END
            ELSE "phaseResultsJson" END
        WHERE id = (SELECT id FROM "Scan" WHERE status = 'QUEUED' ORDER BY "createdAt", id LIMIT 1)
          AND NOT EXISTS (SELECT 1 FROM "Scan" WHERE status = 'RUNNING' AND "startedAt" IS NOT NULL)
        RETURNING id, "targetUrl", "purchasePath", "executionMode"
      `;
      if (job) {
        const dynamicPhases = job.executionMode === "DYNAMIC";
        const purchasePath = job.purchasePath === "DIRECT" ? "DIRECT" : "CART";
        await notifySpringScanStatus(job.id, "running");
        await runScanJob(job.id, job.targetUrl, {
          onPhase: async (phaseId, status, details = {}) => {
            const current = await store.scan.findUnique({ where: { id: job.id }, select: { phaseResultsJson: true } });
            const phases = updateScanPhase(parseScanPhases(current?.phaseResultsJson, initialScanPhases(purchasePath, dynamicPhases)), phaseId, { status, ...details });
            await store.scan.update({ where: { id: job.id }, data: { phaseResultsJson: JSON.stringify(phases), currentStage: `${phaseId}:${status}` } });
          },
        }).catch((error) => console.error(job.id, error));
      } else {
        const [aiJob] = await store.$queryRaw<{ id: string }[]>`
          UPDATE "AiReview" SET status = 'RUNNING', "startedAt" = CURRENT_TIMESTAMP, error = NULL
          WHERE id = (SELECT id FROM "AiReview" WHERE status = 'QUEUED' ORDER BY "requestedAt", id LIMIT 1)
            AND NOT EXISTS (SELECT 1 FROM "AiReview" WHERE status = 'RUNNING')
          RETURNING id
        `;
        if (aiJob) await runAiReviewJob(aiJob.id).catch((error) => console.error(aiJob.id, error));
        else await delay(500);
      }
    }
  } finally {
    await store.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
