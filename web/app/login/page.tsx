import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "로그인", robots: { index: false, follow: false } };

/**
 * The public API (spec §8) has no account endpoints yet: shops and scans belong to the
 * server's HttpOnly session. This page keeps the route from feature/redesign but does not
 * pretend to sign anyone in.
 */
export default function LoginPage() {
  return (
    <div className="lp" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--canvas)" }}>
      <SiteHeader />
      <main id="main" style={{ flex: 1, display: "grid", placeItems: "center", padding: "72px 20px" }}>
        <div className="panel panel--feature" style={{ width: "100%", maxWidth: 440, padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 className="t-page">로그인</h1>
            <p className="muted" style={{ fontSize: 14 }}>쇼핑몰 운영자 계정으로 진단 이력을 관리해요.</p>
          </div>
          <Alert kind="brand" title="계정 기능은 준비 중이에요">
            지금은 로그인 없이 이 브라우저 세션에 쇼핑몰과 진단 이력이 저장돼요. 같은 브라우저에서 ‘내 쇼핑몰’로 다시 볼 수 있어요.
          </Alert>
          <form style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-describedby="login-note">
            <label className="field">
              <span className="field__label">이메일</span>
              <input className="input" type="email" autoComplete="email" disabled placeholder="owner@shop.co.kr" />
            </label>
            <label className="field">
              <span className="field__label">비밀번호</span>
              <input className="input" type="password" autoComplete="current-password" disabled />
            </label>
            <Button type="submit" block disabled>로그인</Button>
            <span id="login-note" className="faint" style={{ fontSize: 13 }}>계정 API가 연결되면 사용할 수 있어요.</span>
          </form>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <ButtonLink href="/shops" variant="secondary">내 쇼핑몰 보기</ButtonLink>
            <ButtonLink href="/scan/new" variant="brand">무료로 진단하기</ButtonLink>
          </div>
          <p className="faint" style={{ fontSize: 13 }}>처음이신가요? <Link href="/about">서비스 소개</Link>를 먼저 보세요.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
