import type { Metadata } from "next";
import { CtaBand, PageHead, PageShell, Tag } from "../components/site";

export const metadata: Metadata = {
  title: "분석 방법 | 바로미",
  description: "바로미가 구매 흐름을 안전하게 탐색하고 증거를 수집해 위험 신호를 판정하는 전 과정을 설명합니다.",
};

const evidenceItems = [
  "고유 증거 ID 및 규칙 엔진 버전, 진단 세션 ID",
  "관측 단계 (상품·장바구니·주문서), 페이지 URL 및 수집 시각",
  "화면 내 요소 CSS 선택자 및 바운딩 박스 픽셀 좌표 (x, y, w, h)",
  "요소 가시성(Visibility), 선택 여부(Checked), 텍스트 라벨, 노출 금액",
  "렌더링 스크린샷 원본 및 의심 영역 하이라이트",
  "동적 가격 원장(Price Ledger) 단계별 변동 기록",
];

export default function Method() {
  return (
    <PageShell>
      <PageHead
        eyebrow="Analysis Method"
        title={<>소비자가 보는 순서대로, <em>기록하며</em> 따라갑니다.</>}
        lede="바로미의 분석은 4개 단계의 안전 파이프라인으로 구성됩니다. 각 단계는 다음 단계가 증거로 활용할 수 있는 재현 가능한 기록을 생성합니다."
      />

      <div className="clean-wrap" style={{ paddingBottom: 80 }}>
        {/* 단계 1: 등록과 안전 확인 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>1. 등록과 안전 확인</h2>
            <p>Pre-flight Verification</p>
          </div>
          <div className="doc-body">
            <p>
              쇼핑몰 URL 입력 시 사설 IP, 로컬호스트 등 내부망 공격(SSRF) 가능 주소를 철저히 차단하며, 오직 공개 HTTPS 엔드포인트만 진단 대상으로 접수합니다.
            </p>
            <div className="doc-grid-2">
              <div className="doc-card card-ok">
                <h3>
                  <span>소유 확인 전 기본 검사</span>
                  <Tag kind="live">제공 중</Tag>
                </h3>
                <ul>
                  <li>공개된 상품 상세 화면을 비침습적으로 분석합니다.</li>
                  <li>장바구니와 주문서 등 인증이 필요한 단계는 '미검사'로 안전하게 보류합니다.</li>
                </ul>
              </div>

              <div className="doc-card">
                <h3>
                  <span>소유 확인 후 동적 심층 검사</span>
                  <Tag kind="soon">준비 중</Tag>
                </h3>
                <ul>
                  <li>쇼핑몰에 발급된 메타 태그로 사이트 관리자 권한을 인증합니다.</li>
                  <li>격리된 샌드박스 브라우저 세션에서 장바구니-주문서 전 과정을 검사합니다.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 단계 2: 구매 흐름 탐색 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>2. 구매 흐름 탐색</h2>
            <p>Checkout Path Traversal</p>
          </div>
          <div className="doc-body">
            <p>
              특정 호스팅 플랫폼의 고정 URL에 의존하지 않고, W3C 표준 구조화 데이터(Schema.org Product / ItemList) 및 메타데이터를 분석하여 상품과 구매 버튼을 식별합니다.
            </p>
            <p>
              한국어 로케일, 서울 표준시(Asia/Seoul), 표준 모바일/PC 뷰포트 해상도로 설정된 신규 브라우저 컨텍스트를 생성하며, <strong>최종 주문 확정·결제 승인·탈퇴 버튼은 실행 단계에서 엄격히 차단</strong>합니다.
            </p>
          </div>
        </section>

        {/* 단계 3: 증거 수집 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>3. 증거 수집 및 가격 원장</h2>
            <p>Evidence & Ledger</p>
          </div>
          <div className="doc-body">
            <p>
              페이지 렌더링 완료 시점과 사용자 인터랙션(옵션 선택, 다음 단계 이동) 직후의 DOM 스냅샷 및 렌더 트리를 캡처하여 아래의 공통 증거 규격으로 영구 보관합니다.
            </p>
            <div className="doc-card" style={{ marginBottom: 16 }}>
              <ul>
                {evidenceItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="doc-card">
              <h3>
                <span>동적 가격 원장 (Price Ledger)</span>
                <Tag kind="live">제공 중</Tag>
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>
                상품 화면 표시가 → 장바구니 옵션 추가금 → 주문서 필수 배송비/수수료의 연속성을 일렬로 기록하여, 사용자 인지 없이 추가된 숨은 비용을 계산합니다.
              </p>
            </div>
          </div>
        </section>

        {/* 단계 4: 판정과 리포트 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>4. 판정과 리포트</h2>
            <p>Deterministic Rules First</p>
          </div>
          <div className="doc-body">
            <p>
              체크박스 체크 상태, 금액 차이, 요소 좌표처럼 <strong>코드로 100% 측정 가능한 사실은 결정론적 규칙(Deterministic Rules)으로 엄격히 판정</strong>합니다.
            </p>
            <p>
              LLM이나 AI는 문맥 해석이 매우 모호한 일부 안내 문구 분류에만 제한적 보조 도구로 사용되며, AI 단독 판단으로 위험을 확정하지 않습니다.
            </p>
            <div className="doc-grid-2">
              <div className="doc-card card-risk">
                <h3>위험 신호 (Suspected)</h3>
                <ul>
                  <li>공정위 심사지침 금지 규칙 조건을 객관적 증거로 충족한 경우</li>
                  <li>화면 위치 하이라이트 및 관리자 개선 가이드 동시 제공</li>
                </ul>
              </div>
              <div className="doc-card">
                <h3>검토 필요 (Review Needed)</h3>
                <ul>
                  <li>통상적 배송비 조건부 무료 등 예외 가능성이 존재하는 경우</li>
                  <li>접근 실패, 추가 본인인증 요구 등은 정상이 아닌 '미검사'로 별도 구분</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 투명한 성능 측정 현황 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>검증 현황 공개</h2>
            <p>Transparency</p>
          </div>
          <div className="doc-body">
            <p>
              통제된 합성 쇼핑몰 환경에서 100%의 회귀 테스트 통과율을 검증했습니다. 다만 실제 운영 중인 라이브 쇼핑몰의 정확도는 다양한 커스텀 스크립트와 레이아웃에 따라 달라질 수 있습니다.
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              바로미는 실제 측정되지 않은 수치를 임의로 부풀려 홍보하지 않으며, 승인된 테스트 쇼핑몰 군을 대상으로 한 반복 일치율 및 오탐률 통계를 지속적으로 공개할 예정입니다.
            </p>
          </div>
        </section>
      </div>

      <CtaBand />
    </PageShell>
  );
}
