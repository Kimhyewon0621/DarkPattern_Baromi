import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { supabaseOwner } from "../src/supabase-auth";

const jwt = (secret: string, claims: Record<string, unknown>) => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(claims);
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
};

test("Supabase Bearer JWT owner is verified by Supabase Auth without issuing a cookie", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    fetch: globalThis.fetch,
  };
  const secret = "test-secret";
  const validToken = jwt(secret, { sub: "user-123", exp: Math.floor(Date.now() / 1000) + 300, aud: "authenticated" });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    return headers.get("authorization") === `Bearer ${validToken}`
      ? new Response(JSON.stringify({ id: "user-123" }), { status: 200 })
      : new Response(JSON.stringify({ message: "Invalid token" }), { status: 401 });
  };
  try {
    const request = new NextRequest("http://localhost/api/v1/shops", { headers: { authorization: `Bearer ${validToken}` } });
    expect(await supabaseOwner(request)).toBe("user-123");
    const tampered = new NextRequest("http://localhost/api/v1/shops", { headers: { authorization: `Bearer ${validToken.slice(0, -1)}x` } });
    expect(await supabaseOwner(tampered)).toBeNull();
  } finally {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.key;
    globalThis.fetch = previous.fetch;
  }
});
