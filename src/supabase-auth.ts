import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

type Claims = { sub?: unknown; exp?: unknown; aud?: unknown; iss?: unknown };

const decode = (value: string) => JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Claims;

export function supabaseOwner(request: NextRequest): string | null {
  const secret = process.env.SUPABASE_JWT_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return null;
  const parts = authorization.slice("Bearer ".length).trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const [encodedHeader, encodedClaims, encodedSignature] = parts;
    const header = decode(encodedHeader) as Claims & { alg?: unknown };
    const claims = decode(encodedClaims);
    if (header.alg !== "HS256" || typeof claims.sub !== "string" || !claims.sub) return null;
    const expected = createHmac("sha256", secret).update(`${encodedHeader}.${encodedClaims}`).digest();
    const actual = Buffer.from(encodedSignature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    const audience = process.env.SUPABASE_JWT_AUDIENCE ?? "authenticated";
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(audience)) return null;
    const issuer = process.env.SUPABASE_JWT_ISSUER;
    if (issuer && claims.iss !== issuer) return null;
    return claims.sub;
  } catch {
    return null;
  }
}
