import { readFile } from "node:fs/promises";

type Label = { type: string; status: "RISK" | "REVIEW" | "NOT_OBSERVED" | "NOT_TESTED"; adjudication: "PENDING" | "AGREED" };
type Row = { shopGroupId: string; split: string; labels: Label[] };
const path = process.env.BAROMI_DATASET_PATH ?? "datasets/labels.example.jsonl";

async function main() {
  const rows = (await readFile(path, "utf8")).split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    try { return JSON.parse(line) as Row; } catch { throw new Error(`${path}:${index + 1}: JSON 형식이 아닙니다.`); }
  });
  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(row.shopGroupId, [...(groups.get(row.shopGroupId) ?? []), row]);
  const groupReports = [...groups.entries()].map(([shopGroupId, groupRows]) => {
    const labels = groupRows.flatMap((row) => row.labels).filter((label) => label.adjudication === "AGREED");
    const statusCounts = Object.fromEntries(["RISK", "REVIEW", "NOT_OBSERVED", "NOT_TESTED"].map((status) => [status, labels.filter((label) => label.status === status).length]));
    return { shopGroupId, splits: [...new Set(groupRows.map((row) => row.split))], records: groupRows.length, agreedLabels: labels.length, pendingLabels: groupRows.flatMap((row) => row.labels).filter((label) => label.adjudication === "PENDING").length, notTestedRate: labels.length ? statusCounts.NOT_TESTED / labels.length : null, riskRate: labels.length ? statusCounts.RISK / labels.length : null, statusCounts };
  });
  const allLabels = rows.flatMap((row) => row.labels);
  const agreedLabels = allLabels.filter((label) => label.adjudication === "AGREED");
  console.log(JSON.stringify({ path, groups: groupReports.length, records: rows.length, agreedLabels: agreedLabels.length, pendingLabels: allLabels.length - agreedLabels.length, groupReports, readyForReleaseGate: groupReports.length > 0 && groupReports.every((group) => group.agreedLabels > 0 && group.splits.length === 1) }, null, 2));
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
