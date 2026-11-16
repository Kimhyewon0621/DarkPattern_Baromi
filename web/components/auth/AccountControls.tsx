"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function AccountControls({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    const supabase = supabaseBrowser();
    void supabase.auth.getUser().then((result: { data: { user: User | null } }) => setUser(result.data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    setUser(null);
    router.replace("/");
    router.refresh();
  }

  if (!user) return <Link href="/login" className={compact ? "nav-link" : "btn btn--tertiary btn--md"}>로그인</Link>;
  return compact ? (
    <div className="account-controls account-controls--compact">
      <span title={user.email ?? "로그인"}>{user.email ?? "로그인"}</span>
      <Button variant="tertiary" size="sm" onClick={signOut}>로그아웃</Button>
    </div>
  ) : (
    <div className="account-controls">
      <Link href="/shops" className="btn btn--tertiary btn--md">내 쇼핑몰</Link>
      <Button variant="tertiary" size="md" onClick={signOut}>로그아웃</Button>
    </div>
  );
}
