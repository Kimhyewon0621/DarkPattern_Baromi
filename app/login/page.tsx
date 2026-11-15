import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "로그인 / 무료 시작하기 | 바로미",
  description: "쇼핑몰 사장님을 위한 바로미 간편 로그인 및 무료 계정 생성",
};

export default function LoginPage() {
  return (
    <div className="auth-shell">
      {/* Top Simple Bar */}
      <div style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center" }}>
          <img
            src="/brand/baromi-logo.png"
            alt="바로미"
            height={28}
            style={{ height: 28, width: "auto", objectFit: "contain" }}
          />
        </Link>
        <Link
          href="/"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          홈으로 돌아가기
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-header">
            <img
              src="/brand/baromi-symbol.png"
              alt="바로미 심벌"
              width={40}
              height={40}
              style={{ objectFit: "contain", margin: "0 auto 8px", display: "block" }}
            />
            <h1>쇼핑몰을 더 바르게</h1>
            <p>로그인하시면 상점 진단 이력 영구 보관과 배포 전 자동 재검사 기능을 무료로 이용하실 수 있습니다.</p>
          </div>

          <LoginForm />
        </div>
      </main>

      {/* Footer Legal */}
      <footer style={{ padding: "20px 24px", textAlign: "center", fontSize: 12, color: "var(--text-sub)", borderTop: "1px solid var(--border-light)" }}>
        © 2026 Baromi Labs. All rights reserved. · 개인정보는 철저히 암호화되어 안전하게 보관됩니다.
      </footer>
    </div>
  );
}
