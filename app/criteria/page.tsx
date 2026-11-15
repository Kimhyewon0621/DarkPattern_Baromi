import type { Metadata } from "next";
import { CtaBand, PageHead, PageShell, Tag } from "../components/site";

export const metadata: Metadata = {
  title: "탐지 기준 | 바로미",
  description: "바로미가 공정거래위원회 기준에 따라 위험 신호로 판단하는 조건과, 오탐을 방지하기 위해 예외 처리하는 기준을 상세히 공개합니다.",
};

const statusDefinitions = [
  {
    badgeClass: "badge-risk",
    label: "위험 신호 (Suspected)",
    definition: "공정위 심사지침 금지 행위 요건을 명확한 증거(금액 증가, 기본 체크 등)로 충족한 상태입니다.",
  },
  {
    badgeClass: "badge-review",
    label: "검토 필요 (Review Needed)",
    definition: "조건부 할인, 복합 옵션 등 상황에 따라 적법할 수 있어 사람 운영자의 맥락 확인이 필요한 상태입니다.",
  },
  {
    badgeClass: "badge-untested",
    label: "미검사 (Untested / Skipped)",
    definition: "로그인 차단, 본인인증 요구, 캡차 등으로 인해 해당 단계에 도달하지 못해 검사하지 못한 상태입니다.",
  },
  {
    badgeClass: "badge-ok",
    label: "관측 없음 (No Signals)",
    definition: "검사한 범위와 시점 내에서 해당 규칙의 위험 조건이 발견되지 않은 상태입니다. (완전 적법 보증은 아님)",
  },
];

export default function Criteria() {
  return (
    <PageShell>
      <PageHead
        eyebrow="Inspection Criteria"
        title={<>무엇을 <em>위험 신호</em>로 보는지 투명하게 공개합니다.</>}
        lede="기준이 불투명한 진단은 신뢰할 수 없습니다. 바로미가 위험 신호로 판단하는 엄격한 조건과, 정상적인 마케팅 요소를 오탐하지 않기 위해 제외하는 예외 기준을 명시합니다."
      />

      <div className="clean-wrap" style={{ paddingBottom: 80 }}>
        {/* 1. 특정 옵션 사전선택 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>특정 옵션 사전선택</h2>
            <p><Tag kind="live">제공 중</Tag></p>
          </div>
          <div className="doc-body">
            <p>
              소비자가 스스로 선택하지 않았음에도, 유료 추가 옵션이나 정기 결제 등이 기본으로 체크되어 있어 총 결제 금액이 상승하는 유형을 점검합니다.
            </p>
            <div className="doc-grid-2">
              <div className="doc-card card-risk">
                <h3>위험 후보 판정 조건</h3>
                <ul>
                  <li>페이지 로드 초기 상태에서 체크박스/라디오가 이미 선택되어 있음</li>
                  <li>기본 상품 외 유료 포장, 보증 연장, 부가서비스 등 별도 구매 항목임</li>
                  <li>0원 초과의 추가 금액이 존재하며, 선택 해제 시 최종 결제액이 감소함</li>
                  <li>해당 실행 세션에서 사용자가 직접 체크한 기록이 없음</li>
                </ul>
              </div>

              <div className="doc-card card-ok">
                <h3>정상 마케팅 자동 제외 조건</h3>
                <ul>
                  <li>“선택해 주세요” 같은 단순 안내용 비선택 드롭다운</li>
                  <li>이전 구매에서 저장된 기본 배송지 및 결제 수단 자동 지정</li>
                  <li>결제 진행에 법적으로 반드시 필요한 필수 약관 동의</li>
                  <li>추가 비용 결제가 전혀 발생하지 않는 무료 사은품 기본 증정</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 2. 순차공개 가격책정 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>순차공개 가격책정 (숨은 비용)</h2>
            <p><Tag kind="live">제공 중</Tag></p>
          </div>
          <div className="doc-body">
            <p>
              상품 목록이나 초기 상세 화면에서는 저렴한 가격을 보여주고, 구매가 진행된 장바구니나 주문서 단계에서 필수 비용(필수 배송비, 취급 수수료 등)이 갑자기 추가되는 유형을 점검합니다.
            </p>
            <div className="doc-grid-2">
              <div className="doc-card card-risk">
                <h3>위험 후보 판정 조건</h3>
                <ul>
                  <li>장바구니 또는 주문서 단계에서 양수(+)의 필수 비용이 새롭게 등장함</li>
                  <li>해당 비용을 지불하지 않고는 정상적인 구매 완료가 불가능함</li>
                  <li>최초 상품 화면에서 필수 비용의 존재나 산정 기준이 고지되지 않음</li>
                </ul>
              </div>

              <div className="doc-card card-ok">
                <h3>예외 및 검토 필요 처리</h3>
                <ul>
                  <li>소비자가 직접 추가한 유료 옵션에 따른 정상적인 가격 차이</li>
                  <li>상세 화면에 사전 명시된 지역별/도서산간 추가 배송비</li>
                  <li>회원 로그인 시 적용되는 명시된 조건부 회원 할인 혜택</li>
                  <li>모든 필수 옵션에 추가금이 붙어 표시가로 구매가 불가능한 경우 ‘검토 필요’로 분류</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 판정의 4가지 상태 체계 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>판정의 4가지 상태</h2>
            <p>Status System</p>
          </div>
          <div className="doc-body">
            <p style={{ marginBottom: 16 }}>
              바로미는 모호한 흑백 논리를 지양하고, 관측의 객관성을 보장하기 위해 4가지 상태로 결과를 분류합니다.
            </p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th style={{ width: 180 }}>상태 구분</th>
                  <th>정의 및 운영자 대응 가이드</th>
                </tr>
              </thead>
              <tbody>
                {statusDefinitions.map(({ badgeClass, label, definition }) => (
                  <tr key={label}>
                    <td>
                      <span className={`doc-badge ${badgeClass}`}>{label}</span>
                    </td>
                    <td style={{ fontSize: 13.5, lineHeight: 1.6 }}>{definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. 향후 확장 예정 유형 */}
        <section className="doc-section">
          <div className="doc-label">
            <h2>확장 예정 유형</h2>
            <p><Tag kind="soon">준비 중</Tag></p>
          </div>
          <div className="doc-body">
            <p>
              취소·탈퇴 방해, 반복 간섭(팝업 강제), 위장 광고 등 정성적 시각 인지가 요구되는 유형은 비전-언어 모델(VLM) 기반의 독립 검증 파이프라인을 거친 후 순차적으로 도입됩니다.
            </p>
            <p style={{ color: "var(--text-sub)", fontSize: 13 }}>
              충분한 합성 및 실증 데이터로 검증되지 않은 유형은 미리 지원 목록에 올리지 않습니다.
            </p>
          </div>
        </section>
      </div>

      <CtaBand />
    </PageShell>
  );
}
