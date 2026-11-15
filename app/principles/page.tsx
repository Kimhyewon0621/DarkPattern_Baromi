import type { Metadata } from "next";
import { CtaBand, PageHead, PageShell } from "../components/site";

export const metadata: Metadata = {
  title: "안전과 원칙 | 바로미",
  description: "바로미가 쇼핑몰 데이터와 고객 정보를 다루는 안전 원칙과 한계점을 솔직하게 공개합니다.",
};

const principles = [
  {
    title: "실제 주문 및 결제는 절대 실행하지 않습니다",
    body: "바로미의 자동화 브라우저는 최종 주문 완료, 결제 승인, 회원 탈퇴 등의 확정 동작을 감지하여 실행 전에 즉시 차단합니다. 테스트 과정에서 사장님의 실제 매출이나 재고 변동, 불필요한 결제 수수료가 발생하지 않습니다.",
  },
  {
    title: "규칙 우선(Code-First), AI는 엄격한 보조 역할에 머뭅니다",
    body: "옵션 선택 여부, 금액 차이, 버튼 좌표처럼 프로그램 코드로 측정 가능한 객관적 사실은 결정론적 알고리즘으로 판정합니다. AI는 문맥이 극도로 모호한 소수 문구의 의미 분류에만 보조로 사용되며, 검측 증거 없는 모델의 환각(Hallucination) 출력은 즉각 폐기합니다.",
  },
  {
    title: "미검사(Skipped) 상태를 정상으로 포장하지 않습니다",
    body: "로그인 필요, 본인인증 요구, 캡차(CAPTCHA), 복합 분기 등으로 인해 검사 엔진이 도달하지 못한 단계는 '정상'으로 덮지 않고 '미검사'로 투명하게 기록합니다. 검사 실패와 위험 미발견은 결코 같은 상태가 아닙니다.",
  },
  {
    title: "법률 자문이 아닌 공정위 심사지침 기준의 위험 신호입니다",
    body: "바로미의 진단 리포트는 전자상거래법 및 공정거래위원회 다크패턴 자율관리 가이드라인에 따른 사전 예방용 '위험 신호'를 제공하는 도구입니다. 리포트의 '완료' 판정이 법률적 적법성을 최종 보증하지 않으며 법적 분쟁 시 전문가 상담이 필요합니다.",
  },
  {
    title: "권한을 확인한 쇼핑몰에 한하여 동적 검사를 수행합니다",
    body: "심층 장바구니-주문서 동적 탐색은 쇼핑몰 관리자 권한(메타 태그 인증 등)을 확인한 쇼핑몰을 대상으로만 수행합니다. 사설 IP, 내부 로컬망, 승인되지 않은 비공개 주소는 보안을 위해 원천 차단됩니다.",
  },
  {
    title: "데이터 수집은 최소화하며 진단 후 즉시 파기합니다",
    body: "진단 수행 중 생성된 임시 쿠키와 브라우저 세션 데이터는 진단 완료 즉시 폐기됩니다. 화면 증거 스크린샷은 사장님이 리포트를 확인하고 조치할 수 있는 보관 기한 경과 시 안전하게 영구 삭제됩니다.",
  },
  {
    title: "성능과 탐지 범위는 실제로 측정한 만큼만 정직하게 밝힙니다",
    body: "합성 환경에서의 테스트 통과 결과를 실제 운영 쇼핑몰의 100% 탐지율인 것처럼 과장하여 홍보하지 않습니다. 지속적인 실증 평가를 통해 측정된 신뢰구간과 오탐률을 정직하게 공개합니다.",
  },
];

export default function Principles() {
  return (
    <PageShell>
      <PageHead
        eyebrow="Safety & Principles"
        title={<>신뢰받기 위해, <em>원칙과 한계</em>부터 투명하게 밝힙니다.</>}
        lede="바로미가 쇼핑몰의 사이트와 데이터를 어떻게 안전하게 다루는지, 그리고 진단 결과를 어디까지 신뢰해야 하는지에 대한 바로미의 7대 불변 원칙입니다."
      />

      <div className="clean-wrap" style={{ paddingBottom: 80 }}>
        <div className="principles-flow">
          {principles.map(({ title, body }, index) => {
            const no = String(index + 1).padStart(2, "0");
            return (
              <div key={title} className="principle-item">
                <div className="principle-no tabular">{no}</div>
                <div className="principle-content">
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CtaBand />
    </PageShell>
  );
}
