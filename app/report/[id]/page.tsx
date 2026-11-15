import { ScanReport } from "./scan-report";

export const metadata = {
  title: "쇼핑몰 결제 여정 점검 리포트 | 바로미",
  robots: { index: false, follow: false },
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <ScanReport id={id} />
    </main>
  );
}
