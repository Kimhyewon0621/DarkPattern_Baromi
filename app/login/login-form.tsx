"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../src/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = supabaseBrowser();
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/login` } });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMessage("가입 확인 메일을 보냈어요. 이메일 인증을 마친 뒤 로그인해 주세요.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "로그인 요청을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    <label>이메일<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>비밀번호<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <button className="action" type="submit" disabled={busy}>{busy ? "처리 중…" : mode === "login" ? "로그인" : "계정 만들기"}</button>
    <button className="auth-switch" type="button" disabled={busy} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
      {mode === "login" ? "처음 오셨나요? 계정 만들기" : "이미 계정이 있나요? 로그인"}
    </button>
    {message && <p role="status" className="auth-message">{message}</p>}
    <p className="auth-note">비밀번호는 Supabase Auth에서 처리하며 바로미 진단 기록에 저장하지 않습니다.</p>
  </form>;
}
