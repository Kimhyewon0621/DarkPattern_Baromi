import Link from "next/link";
import { SiteHeader, SiteFooter } from "./components/site";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#ffffff" }}>
      <SiteHeader />
      <main style={{ flex: 1, display: "grid", placeItems: "center", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>
            ERROR 404
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-main)", margin: "12px 0 16px" }}>
            페이지를 찾을 수 없습니다
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 28px" }}>
            요청하신 주소가 올바르지 않거나, 이미 만료된 진단 세션일 수 있습니다. 홈 화면으로 이동하거나 새로운 진단을 시작해 보세요.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/" className="cs-btn-secondary" style={{ padding: "10px 18px", fontSize: 13.5 }}>
              홈으로 돌아가기
            </Link>
            <Link href="/scan/new" className="cs-btn-primary" style={{ padding: "10px 18px", fontSize: 13.5 }}>
              새 진단 시작하기
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
