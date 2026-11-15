import type { Metadata } from "next";
import { FindingDetailView } from "@/components/report/FindingDetailView";

export const metadata: Metadata = { title: "발견 항목 상세" };

export default async function FindingPage({ params }: { params: Promise<{ id: string; finding: string }> }) {
  const { id, finding } = await params;
  return <FindingDetailView scanId={id} findingId={finding} />;
}
