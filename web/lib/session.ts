"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * The API answers 404 (not 401) when the session cookie is gone, so screens tied to a
 * session send the user back to registration with a short explanation.
 */
export function useBackToRegistration() {
  const router = useRouter();
  return useCallback(() => router.replace("/scan/new?expired=1"), [router]);
}

export function readFlag(name: string): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(name) === "1";
}
