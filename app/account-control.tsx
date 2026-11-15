"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "../src/supabase/client";

export function AccountControl() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let client: ReturnType<typeof supabaseBrowser>;
    try { client = supabaseBrowser(); }
    catch { return; }
    void client.auth.getSession().then(({ data }: { data: { session: Session | null } }) => setSignedIn(Boolean(data.session)));
    const { data } = client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!signedIn) return <Link className="text-link" href="/login">로그인</Link>;
  return <button className="text-link account-signout" type="button" onClick={async () => {
    const { error } = await supabaseBrowser().auth.signOut();
    if (!error) window.location.assign("/");
  }}>로그아웃</button>;
}
