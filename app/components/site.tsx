"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export const navItems = [
  ["/about", "서비스 소개"],
  ["/method", "분석 방법"],
  ["/criteria", "탐지 기준"],
  ["/principles", "안전과 원칙"],
] as const;

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <img
      src="/brand/baromi-symbol.png"
      alt="바로미 심벌"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", display: "inline-block", verticalAlign: "middle" }}
    />
  );
}

export function Reveal({ children, delay = 0, rotate = 0, className = "" }: { children: ReactNode; delay?: number; rotate?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`rv ${className}`} style={{ "--d": `${delay}s`, "--r": `${rotate}deg` } as CSSProperties}>{children}</div>;
}

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="cs-header">
      <div className="clean-wrap" style={{ width: "100%" }}>
        <div className="cs-header-inner">
          <Link className="cs-brand" href="/" aria-label="바로미 홈" style={{ display: "inline-flex", alignItems: "center" }}>
            <img
              src="/brand/baromi-logo.png"
              alt="바로미 - 쇼핑몰을 더 바르게"
              height={30}
              style={{ height: 30, width: "auto", objectFit: "contain", display: "block" }}
            />
          </Link>
          <nav className="cs-nav" aria-label="주요 메뉴">
            {navItems.map(([href, label]) => {
              const active = path === href;
              return (
                <Link
                  key={href}
                  href={href}
                  style={active ? { color: "var(--primary)", fontWeight: 700, background: "var(--primary-light)" } : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href="/login"
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text-main)",
                textDecoration: "none",
                padding: "6px 8px",
                transition: "color 0.15s",
              }}
            >
              로그인
            </Link>
            <Link className="cs-btn-secondary" href="/report/sample" style={{ padding: "6px 12px", fontSize: 13 }}>
              샘플 결과
            </Link>
            <Link className="cs-btn-primary" href="/scan/new">
              무료 진단 시작
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="cs-footer">
      <div className="clean-wrap">
        <div className="cs-footer-inner" style={{ flexWrap: "wrap", gap: 24 }}>
          <div>
            <Link className="cs-brand" href="/" style={{ marginBottom: 12, display: "inline-flex", alignItems: "center" }}>
              <img
                src="/brand/baromi-logo.png"
                alt="바로미"
                height={26}
                style={{ height: 26, width: "auto", objectFit: "contain", display: "block" }}
              />
            </Link>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13, maxWidth: 440, lineHeight: 1.6 }}>
              <strong>쇼핑몰을 더 바르게.</strong><br />
              소상공인과 D2C 브랜드를 위한 다크패턴 위험 자동 사전 진단·예방 솔루션입니다.
            </p>
          </div>
          <div className="cs-footer-links">
            <Link href="/about">서비스 소개</Link>
            <Link href="/method">분석 방법</Link>
            <Link href="/criteria">탐지 기준</Link>
            <Link href="/principles">안전 원칙</Link>
            <Link href="/login">로그인</Link>
            <Link href="/scan/new">진단 시작</Link>
          </div>
        </div>
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-sub)", lineHeight: 1.5 }}>
            바로미의 진단 결과는 법률 판정이 아닌 공정거래위원회 심사지침 기준의 위험 신호입니다. 실제 결제 및 주문 확정은 절대 실행되지 않습니다.
          </p>
          <span className="tabular" style={{ fontSize: 12, color: "var(--text-sub)" }}>© 2026 Baromi Labs. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#ffffff" }}>
      <SiteHeader />
      <main style={{ flex: 1 }}>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHead({ eyebrow, title, lede }: { eyebrow: string; title: ReactNode; lede: string }) {
  return (
    <section className="page-head">
      <div className="clean-wrap">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display">{title}</h1>
        <p className="lede">{lede}</p>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="cs-cta-band">
      <div className="clean-wrap">
        <div className="cs-cta-inner">
          <div>
            <h2>배포하기 전에,<br />한 번만 <em>먼저</em> 점검하세요.</h2>
            <p>쇼핑몰을 더 바르게. 실제 결제는 절대 일어나지 않으며, 3분 안에 공정위 기준 위험 신호를 확인합니다.</p>
          </div>
          <Link className="cs-btn-primary" href="/scan/new" style={{ padding: "12px 24px", fontSize: 14 }}>
            내 쇼핑몰 무료 진단하기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Tag({ kind, children }: { kind: "live" | "soon"; children: ReactNode }) {
  return <span className={kind === "live" ? "tag-live" : "tag-soon"}>{children}</span>;
}
