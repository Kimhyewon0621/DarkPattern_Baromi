import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, PageHead, PageShell } from "../components/site";

export const metadata: Metadata = {
  title: "서비스 소개 | 바로미",
  description: "바로미가 누구를 위해, 어떤 문제를 어떻게 풀고, 무엇을 결과물로 제공하는지 소개합니다.",
};

const deliverables = [
  ["검사 범위", "어느 단계(상품·장바구니·주문서)에서 어떤 유형을 점검했는지"],
  ["미검사 사유", "접근하지 못한 단계와 그 이유 (로그인 필요, 모호한 경로 등)"],
  ["위험 신호", "관측된 객관적 사실과 운영자 검토가 필요한 의심 항목 분리"],
  ["재현 증거", "화면 스크린샷, 요소 위치(좌표), 가격·선택 상태, 근거 ID"],
  ["수정 방향", "쇼핑몰 관리자에서 무엇을 어떻게 변경해야 하는지 액션 가이드"],
  ["재검사 Diff", "수정 후 재검사 시 신규·반복·해결된 항목의 시계열 비교"],
];

const faqs = [
  {
    q: "법률 위반 여부를 확정 판정해 주나요?",
    a: "아닙니다. 바로미의 진단 결과는 공정거래위원회 다크패턴 심사지침 기준의 ‘위험 신호’이며, 법률 자문이나 법적 적법성을 보증하지 않습니다. 최종 법적 판단이 필요한 사안은 전문 변호사 또는 법무 대리인의 검토를 받으셔야 합니다.",
  },
  {
    q: "어떤 쇼핑몰에서 사용할 수 있나요?",
    a: "카페24, 네이버 스마트스토어, 고도몰, 메이크샵, 아임웹, 쇼피파이 등 공개된 HTTPS 웹사이트 주소를 가진 모든 국내외 이커머스 쇼핑몰에서 점검할 수 있습니다.",
  },
  {
    q: "진단 중 실제로 주문이나 결제가 발생하나요?",
    a: "절대 발생하지 않습니다. 바로미의 자동화 탐색 엔진은 주문 확정, 결제 승인, 회원 탈퇴 등의 영구적 트랜잭션 버튼을 감지하여 실행 전에 원천 차단합니다.",
  },
  {
    q: "장바구니와 주문서 단계까지 자동으로 검사되나요?",
    a: "소유권 확인이 완료된 쇼핑몰은 상품 상세부터 장바구니, 주문서 진입 단계까지 동적으로 검사합니다. 소유권 확인 전 기본 검사에서는 공개 상품 상세 페이지를 중심으로 안전하게 점검하며, 접근 불가 단계는 '미검사'로 명확히 표기합니다.",
  },
  {
    q: "검사 결과 '위험 신호 없음'이면 100% 안심해도 되나요?",
    a: "검사된 시점과 범위 안에서 해당 규칙 조건이 관측되지 않았다는 의미입니다. 추후 상품 옵션 수정이나 마케팅 배너 변경 시 다시 위험 신호가 생길 수 있으므로, 배포 전 정기적인 재점검을 권장합니다.",
  },
];

export default function About() {
  return (
    <PageShell>
      <PageHead
        eyebrow="쇼핑몰을 더 바르게 · About Baromi"
        title={<>소상공인을 위한 다크패턴 사전 진단, <em>쇼핑몰을 더 바르게.</em></>}
        lede="복잡한 법률 용어나 거친 개발자 도구 없이도, 쇼핑몰 사장님이 배포 전에 구매 흐름 전체의 다크패턴 위험 신호를 확인하고 증거와 함께 개선할 수 있습니다."
      />

      <div className="clean-wrap" style={{ paddingBottom: 80 }}>
        {/* 섹션 1: 누구를 위한 서비스인가 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>누구를 위한 서비스인가</h2>
            <p>Target Audience</p>
          </div>
          <div className="doc-body">
            <p>
              국내 쇼핑몰, 특히 자사몰을 직접 운영하는 소상공인과 중견 D2C 브랜드, 이커머스 실무팀을 위해 만들었습니다.
            </p>
            <p>
              전담 법무팀이나 QA 엔지니어가 없는 환경에서도, 공정위의 다크패턴 규제 기준에 저촉될 소지가 있는지 사전에 점검하고 빠르게 수정할 수 있어야 합니다.
            </p>
          </div>
        </section>

        {/* 섹션 2: 어떤 문제를 푸는가 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>어떤 문제를 푸는가</h2>
            <p>Core Problem</p>
          </div>
          <div className="doc-body">
            <p>
              유료 옵션 기본 선택, 주문서에서 갑자기 튀어나오는 추가 비용처럼 다크패턴은 단일 화면이 아니라 **구매 흐름(상품 → 장바구니 → 주문서)을 거치는 과정**에서 발생합니다.
            </p>
            <p>
              단순히 소스코드를 정적으로 훑어서는 발견할 수 없으며, 사람이 일일이 브라우저를 열어 매번 반복 확인하기도 현실적으로 어렵습니다. 바로미는 실제 브라우저 세션에서 소비자의 여정을 그대로 따라가며 “어느 화면에서, 어떤 금액이, 왜 바뀌었는지”를 정밀 기록합니다.
            </p>
          </div>
        </section>

        {/* 섹션 3: 리포트에 담기는 6가지 핵심 결과물 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>리포트에 담기는 것</h2>
            <p>Inspection Deliverables</p>
          </div>
          <div className="doc-body">
            <p style={{ marginBottom: 16 }}>모든 바로미 진단 리포트는 객관성과 재현성을 갖춘 표준 원장 규격을 준수합니다.</p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>구분</th>
                  <th>상세 내용</th>
                </tr>
              </thead>
              <tbody>
                {deliverables.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 섹션 4: 자주 묻는 질문 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>자주 묻는 질문</h2>
            <p>FAQ</p>
          </div>
          <div className="doc-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {faqs.map(({ q, a }) => (
                <details
                  key={q}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    padding: "16px 20px",
                    cursor: "pointer",
                  }}
                >
                  <summary style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-main)", outline: "none" }}>
                    {q}
                  </summary>
                  <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65 }}>
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>

      <CtaBand />
    </PageShell>
  );
}
