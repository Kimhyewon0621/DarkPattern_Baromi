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

test("Supabase Bearer JWT owner is validated without issuing a cookie", () => {
  const previous = { secret: process.env.SUPABASE_JWT_SECRET, audience: process.env.SUPABASE_JWT_AUDIENCE };
  process.env.SUPABASE_JWT_SECRET = "test-secret";
  process.env.SUPABASE_JWT_AUDIENCE = "authenticated";
  try {
    const token = jwt("test-secret", { sub: "user-123", exp: Math.floor(Date.now() / 1000) + 300, aud: "authenticated" });
    const request = new NextRequest("http://localhost/api/v1/shops", { headers: { authorization: `Bearer ${token}` } });
    expect(supabaseOwner(request)).toBe("user-123");
    const tampered = new NextRequest("http://localhost/api/v1/shops", { headers: { authorization: `Bearer ${token.slice(0, -1)}x` } });
    expect(supabaseOwner(tampered)).toBeNull();
  } finally {
    if (previous.secret === undefined) delete process.env.SUPABASE_JWT_SECRET; else process.env.SUPABASE_JWT_SECRET = previous.secret;
    if (previous.audience === undefined) delete process.env.SUPABASE_JWT_AUDIENCE; else process.env.SUPABASE_JWT_AUDIENCE = previous.audience;
  }
});
