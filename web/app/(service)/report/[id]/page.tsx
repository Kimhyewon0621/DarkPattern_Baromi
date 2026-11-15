import type { Metadata } from "next";
import { ScanReport } from "@/components/report/ScanReport";

export const metadata: Metadata = { title: "진단 보고서" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScanReport id={id} />;
}
