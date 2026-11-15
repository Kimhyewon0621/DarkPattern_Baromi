import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "../../../components/site";
import { FindingDetail } from "./finding-detail";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "발견 상세 인스펙터 | 바로미",
  robots: { index: false, follow: false },
};

export default async function FindingPage({ params }: { params: Promise<{ id: string; finding: string }> }) {
  const { id, finding } = await params;

  return (
    <div className="finding-shell">
      <SiteHeader />

      <main className="clean-wrap" style={{ paddingTop: 24 }}>
        <FindingDetail id={id} finding={finding} />
      </main>

      <SiteFooter />
    </div>
  );
}
