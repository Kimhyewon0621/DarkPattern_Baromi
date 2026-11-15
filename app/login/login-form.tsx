"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    setTimeout(() => {
      setLoading(false);
      setMessage(
        mode === "login"
          ? "로그인 완료: 사장님의 상점 진단 관리자 콘솔로 이동합니다."
          : "무료 회원가입 완료: 환영합니다! 사장님의 상점 진단 콘솔로 이동합니다."
      );
      setTimeout(() => {
        router.push("/shop/m.cafe24-sample.shop");
      }, 700);
    }, 900);
  };

  const handleSocialLogin = (provider: string) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMessage(`${provider} 간편 로그인 완료: 상점 관리 콘솔로 이동합니다.`);
      setTimeout(() => {
        router.push("/shop/m.cafe24-sample.shop");
      }, 700);
    }, 800);
  };

  return (
    <div>
      {/* Tab Switcher: Login vs Sign Up */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => { setMode("login"); setMessage(""); }}
          style={{
            flex: 1,
            padding: "10px 0",
            border: "none",
            background: "transparent",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            color: mode === "login" ? "var(--primary)" : "var(--text-muted)",
            borderBottom: mode === "login" ? "2px solid var(--primary)" : "2px solid transparent",
            transition: "all 0.15s",
          }}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => { setMode("signup"); setMessage(""); }}
          style={{
            flex: 1,
            padding: "10px 0",
            border: "none",
            background: "transparent",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            color: mode === "signup" ? "var(--primary)" : "var(--text-muted)",
            borderBottom: mode === "signup" ? "2px solid var(--primary)" : "2px solid transparent",
            transition: "all 0.15s",
          }}
        >
          무료 회원가입
        </button>
      </div>

      {/* Social Login Buttons */}
      <div className="auth-social-list">
        <button
          type="button"
          className="auth-social-btn auth-btn-kakao"
          onClick={() => handleSocialLogin("카카오")}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.707 4.8 4.27 6.054-.188.702-.682 2.545-.78 2.94-.122.494.181.488.382.354.158-.105 2.534-1.722 3.56-2.418.513.076 1.037.116 1.568.116 4.97 0 9-3.186 9-7.116C21 6.185 16.97 3 12 3z" />
          </svg>
          카카오로 3초 만에 시작하기
        </button>

        <button
          type="button"
          className="auth-social-btn auth-btn-naver"
          onClick={() => handleSocialLogin("네이버")}
          disabled={loading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
          </svg>
          네이버 아이디로 로그인
        </button>

        <button
          type="button"
          className="auth-social-btn auth-btn-google"
          onClick={() => handleSocialLogin("Google")}
          disabled={loading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
          </svg>
          Google 계정으로 계속하기
        </button>
      </div>

      <div className="auth-divider">
        <span>또는 비즈니스 이메일로 {mode === "login" ? "로그인" : "가입"}</span>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", background: "var(--primary-light)", border: "1px solid var(--primary-border)", borderRadius: 6, fontSize: 13, color: "var(--primary)", marginBottom: 16, textAlign: "center", fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Email / Password Form */}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="auth-email">이메일 주소</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ceo@your-store.com"
            required
          />
        </div>

        <div className="auth-field">
          <label htmlFor="auth-pw">비밀번호</label>
          <input
            id="auth-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상 영문, 숫자 조합"
            required
          />
        </div>

        {mode === "signup" && (
          <div className="auth-field">
            <label htmlFor="auth-shop">운영 중인 쇼핑몰 주소 (선택)</label>
            <input
              id="auth-shop"
              type="url"
              value={shopUrl}
              onChange={(e) => setShopUrl(e.target.value)}
              placeholder="https://your-shop.co.kr"
            />
          </div>
        )}

        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? "처리 중..." : mode === "login" ? "로그인" : "무료 계정 생성하기"}
        </button>
      </form>

      {/* Free Benefit Banner */}
      <div className="auth-banner-free">
        무료 계정으로 시작해도 상점 진단 이력 보관 및 기본 점검은 영구 무료로 제공됩니다.
      </div>

      {/* Help Links */}
      <div className="auth-footer-help">
        {mode === "login" ? (
          <>
            <span style={{ fontSize: 12 }}>계정이 없으신가요?</span>
            <button
              type="button"
              onClick={() => setMode("signup")}
              style={{ background: "transparent", border: "none", color: "var(--primary)", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
            >
              무료 회원가입 →
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12 }}>이미 계정이 있으신가요?</span>
            <button
              type="button"
              onClick={() => setMode("login")}
              style={{ background: "transparent", border: "none", color: "var(--primary)", fontWeight: 700, cursor: "pointer", fontSize: 12.5 }}
            >
              기존 계정으로 로그인 →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
