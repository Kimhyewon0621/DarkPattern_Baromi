import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "../../components/site";
import { ShopHistory } from "./shop-history";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "상점 진단 이력 | 바로미",
  robots: { index: false, follow: false },
};

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  return (
    <div className="shop-shell">
      <SiteHeader />
      
      <div className="shop-header">
        <div className="clean-wrap">
          <div className="shop-meta-strip">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Link
                  href="/"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    textDecoration: "none",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  홈으로
                </Link>
                <span style={{ color: "var(--text-sub)", fontSize: 12 }}>/</span>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>상점 이력</span>
              </div>
              <h1 className="shop-domain-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                {decodedId}
              </h1>
            </div>

            <Link
              href={`/scan/new?targetUrl=${encodeURIComponent("https://" + decodedId)}`}
              className="cs-btn-primary"
              style={{ padding: "9px 18px", fontSize: 13 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              이 상점 새 진단 실행
            </Link>
          </div>
        </div>
      </div>

      <main className="clean-wrap" style={{ paddingTop: 32 }}>
        <ShopHistory shopId={id} />
      </main>

      <SiteFooter />
    </div>
  );
}
