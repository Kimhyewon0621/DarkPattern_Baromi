import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && /^\/(?!\/)[^\\]*$/.test(next) ? next : "/scan/new";
  return <main className="auth-page">
    <section className="auth-card" aria-labelledby="login-title">
      <a className="brand" href="/" aria-label="바로미 홈"><img src="/brand/baromi-logo-full.png" alt="바로미" /></a>
      <p className="eyebrow">BAROMI ACCOUNT</p>
      <h1 id="login-title">바로미 로그인</h1>
      <p>로그인하면 내 쇼핑몰과 진단 보고서를 안전하게 관리할 수 있어요.</p>
      <LoginForm next={safeNext} />
    </section>
  </main>;
}
