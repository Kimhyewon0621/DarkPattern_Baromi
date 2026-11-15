import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 className="t-page">페이지를 찾지 못했어요</h1>
        <p className="muted">주소를 다시 확인하거나 진단을 새로 시작해 주세요.</p>
        <div style={{ display: "flex", gap: 8 }}><ButtonLink href="/">처음으로</ButtonLink><ButtonLink href="/scan/new" variant="secondary">새 진단</ButtonLink></div>
      </div>
    </main>
  );
}
