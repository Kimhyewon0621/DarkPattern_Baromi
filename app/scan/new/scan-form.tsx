"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { post, scanRequest } from "../../scan-request";

export function ScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = new URLSearchParams(location.search).get("url");
    if (u) setUrl(u);
  }, []);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [viewport, setViewport] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [purchasePath, setPurchasePath] = useState<"CART" | "DIRECT">("CART");
  const [dynamic, setDynamic] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [verification, setVerification] = useState<{ shopId: string; metaTag: string; filePath: string; dnsRecord: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const shop = await post("shops", { url: url.trim(), consent: new FormData(event.currentTarget).get("consent") === "on" });
      if (dynamic) {
        if (username && password) {
          const scan = await post("scans", scanRequest(shop.shopId, undefined, "DYNAMIC", viewport, purchasePath, { username, password }));
          router.push("/scan/" + scan.scanId);
          return;
        }
        if (!shop.verification) throw new Error("이 주소는 동적 검사 확인 정보를 발급할 수 없습니다.");
        setVerification({ shopId: shop.shopId, ...shop.verification });
        setPending(false);
        return;
      }
      const scan = await post("scans", scanRequest(shop.shopId, undefined, "CONTEST", viewport, purchasePath));
      router.push("/scan/" + scan.scanId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "진단을 시작하지 못했습니다.");
      setPending(false);
    }
  }

  async function verifyAndScan() {
    if (!verification) return;
    setPending(true);
    setError("");
    try {
      await post(`shops/${verification.shopId}/verify`, {});
      const scan = await post("scans", scanRequest(verification.shopId, undefined, "DYNAMIC", viewport, purchasePath,
        username && password ? { username, password } : undefined));
      router.push("/scan/" + scan.scanId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "소유 확인에 실패했습니다.");
      setPending(false);
    }
  }

  return (
    <form className="scan-form" onSubmit={submit}>
      <label className="field">
        쇼핑몰 또는 상품 URL
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-shopping-mall.co.kr"
          required
        />
      </label>

      {/* Segmented Control 1: Viewport */}
      <div className="scan-segmented-group">
        <label className="scan-segmented-label">화면 검사 환경</label>
        <div className="scan-segmented-buttons">
          <button
            type="button"
            className={`scan-segmented-btn ${viewport === "DESKTOP" ? "active" : ""}`}
            onClick={() => setViewport("DESKTOP")}
          >
            PC 데스크톱 (1440×1000)
          </button>
          <button
            type="button"
            className={`scan-segmented-btn ${viewport === "MOBILE" ? "active" : ""}`}
            onClick={() => setViewport("MOBILE")}
          >
            모바일 스마트폰 (390×844)
          </button>
        </div>
      </div>

      {/* Segmented Control 2: Purchase Path */}
      <div className="scan-segmented-group">
        <label className="scan-segmented-label">구매 탐색 경로</label>
        <div className="scan-segmented-buttons">
          <button
            type="button"
            className={`scan-segmented-btn ${purchasePath === "CART" ? "active" : ""}`}
            onClick={() => setPurchasePath("CART")}
          >
            장바구니 담기 경유 (권장)
          </button>
          <button
            type="button"
            className={`scan-segmented-btn ${purchasePath === "DIRECT" ? "active" : ""}`}
            onClick={() => setPurchasePath("DIRECT")}
          >
            바로구매 즉시 주문서
          </button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div
        className="scan-mode-toggle"
        onClick={() => setDynamic(!dynamic)}
        style={{ borderLeft: dynamic ? "3px solid var(--primary)" : "1px solid var(--border-subtle)" }}
      >
        <div>
          <div className="scan-mode-info">
            {dynamic ? "전체 구매 흐름 정밀 검사 활성화됨" : "동적 구매 흐름 정밀 점검 옵션"}
          </div>
          <div className="scan-mode-sub">
            {dynamic ? "상품 → 장바구니 → 주문서까지 브라우저 세션을 열어 점검합니다." : "소유 권한 확인 또는 테스트 계정으로 주문서 단계까지 점검"}
          </div>
        </div>
        <input
          type="checkbox"
          checked={dynamic}
          onChange={() => {}}
          style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
        />
      </div>

      {dynamic && (
        <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>테스트 계정 입력 (선택 사항)</div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
            회원 전용 가격이나 비회원 주문 제한이 있는 경우 테스트 계정을 입력하세요. 비밀번호는 검사 직후 영구 삭제됩니다.
          </p>
          <label className="field" style={{ marginBottom: 10 }}>
            아이디
            <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="test-user" />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            비밀번호
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
        </div>
      )}

      <label className="scan-consent">
        <input type="checkbox" name="consent" required />
        <span>해당 쇼핑몰에 대한 사전 점검 권한을 확인하였으며, 서비스 약관 및 자동화 검사에 동의합니다. (실제 결제는 실행되지 않습니다)</span>
      </label>

      <button type="submit" className="scan-submit-btn" disabled={pending}>
        {pending ? "검사 세션 생성 중..." : "사전 점검 시작하기"}
      </button>

      {error && (
        <p style={{ color: "var(--rose)", fontSize: 13, marginTop: 12, textAlign: "center" }}>
          {error}
        </p>
      )}

      {verification && (
        <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 18, marginTop: 24 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: "0 0 6px" }}>쇼핑몰 소유 권한 확인</h3>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 12px" }}>
            아래 3가지 방법 중 하나를 선택해 인증을 완료해 주세요.
          </p>
          <ol style={{ fontSize: 12, color: "var(--text-body)", paddingLeft: 16, lineHeight: 1.8, margin: 0 }}>
            <li>메타 태그: <code>{verification.metaTag}</code></li>
            <li>파일 업로드: <code>{verification.filePath}</code></li>
            <li>DNS TXT 레코드: <code>{verification.dnsRecord}</code></li>
          </ol>
          <button
            type="button"
            className="cs-btn-primary"
            style={{ width: "100%", marginTop: 14, justifyContent: "center" }}
            onClick={verifyAndScan}
            disabled={pending}
          >
            {pending ? "확인 중..." : "인증 확인 후 동적 점검 시작"}
          </button>
        </div>
      )}
    </form>
  );
}
