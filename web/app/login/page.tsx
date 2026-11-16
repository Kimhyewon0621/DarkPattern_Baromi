import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { LoginForm } from "@/components/auth/LoginForm";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && /^\/(?!\/)[^\\]*$/.test(next) ? next : "/shops";
  return (
    <div className="lp" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--canvas)" }}>
      <SiteHeader />
      <main id="main" style={{ flex: 1, display: "grid", placeItems: "center", padding: "72px 20px" }}>
        <section className="panel panel--feature" style={{ width: "100%", maxWidth: 480, padding: 32, display: "flex", flexDirection: "column", gap: 20 }} aria-labelledby="login-title">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p className="eyebrow">BAROMI ACCOUNT</p>
            <h1 id="login-title" className="t-page">바로미 로그인</h1>
            <p className="muted" style={{ fontSize: 14 }}>로그인하면 내 쇼핑몰과 진단 보고서를 안전하게 관리할 수 있어요.</p>
          </div>
          <LoginForm next={safeNext} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <ButtonLink href="/report/sample" variant="secondary">예시 보고서 보기</ButtonLink>
            <ButtonLink href="/scan/new" variant="brand">무료로 진단하기</ButtonLink>
          </div>
          <p className="faint" style={{ fontSize: 13 }}>처음이신가요? <Link href="/about">서비스 소개</Link>를 먼저 보세요.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
