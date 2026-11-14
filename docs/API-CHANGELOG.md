# 프론트 팀 API 변경 로그

백엔드 기능이나 API 계약이 바뀔 때마다 이 파일을 먼저 갱신하고, 프론트 팀에 변경 브랜치·커밋·영향받는 endpoint를 공유한다.

## 2026-11-15

- 기준 문서: [`API-SPEC-FRONTEND.md`](./API-SPEC-FRONTEND.md)
- 백엔드 작업 기준 브랜치: `backend`
- API 명세 기준 브랜치: `api-spec`
- 현재 변경: 백엔드 기능 작업 브랜치와 프론트 연동 명세 브랜치를 분리
- 영향 endpoint: 없음

### Spring 상태 응답 정규화

- 변경: `GET /api/v1/scans/:scanId`와 `/report`가 Spring의 소문자 상태(`queued`, `running`, `succeeded` 등)를 프론트 계약의 대문자 상태로 정규화한다.
- 매핑: `succeeded → COMPLETED`, `queued → QUEUED`, `running → RUNNING`, `partial → PARTIAL`, `failed → FAILED`, `cancelled → CANCELLED`
- 프론트 영향: 상태 비교를 별도 분기하지 않아도 기존 `ScanState` 계약을 그대로 사용한다.
- 관련 브랜치: `backend`

### 쇼핑몰 목록 조회 추가

- 변경: `GET /api/v1/shops?limit=50` 공개 API를 구현했다.
- 응답: `{ limit, shops: [{ shopId, url, consentAt, verifiedAt }] }`
- 프론트 영향: 쇼핑몰 관리 화면에서 현재 세션의 등록 쇼핑몰 목록을 직접 조회할 수 있다.
- 관련 커밋: 현재 백엔드 작업 중

### 진단 stale 회복 기준 통합

- 변경: 워커와 health API가 공통 `BAROMI_SCAN_STALE_MS`를 사용한다.
- 기본값: `300000`ms(5분), 허용 범위 `60000`~`600000`ms.
- 프론트 영향: 오래 멈춘 진단이 6분 기준으로 남지 않고 같은 회복 기준으로 `FAILED`/복구 상태가 표시된다.
- 환경변수: `.env`에 `BAROMI_SCAN_STALE_MS`를 설정할 수 있다.

### AI 라벨링 지침 추가

- 변경: 유료 AI 검토 후보의 네 가지 라벨, 증거 우선 판정 순서, 2인 라벨링·불일치 합의 규칙을 문서화했다.
- 프론트 영향: AI 검토 화면은 라벨 선택 시 후보 ID와 근거 증거 ID를 함께 보존해야 한다.
- 관련 문서: `docs/AI-LABELING-GUIDE.md`

### AI·오프라인 데이터셋 라벨 매핑 명시

- 변경: 온라인 AI 검토 라벨과 오프라인 평가 데이터셋 상태의 대응 관계를 `datasets/README.md`에 추가했다.
- 프론트 영향: AI 검토 화면은 온라인 라벨(`LIKELY_RISK` 등)을 사용하고, 오프라인 학습 파이프라인의 축약 상태(`RISK` 등)를 직접 노출하지 않는다.

### 데이터셋 라벨 검증 강화

- 변경: `validate-dataset`가 각 라벨의 `type`, 허용된 `status`, `adjudication(PENDING|AGREED)`를 모두 검증한다.
- 영향: 합의 상태가 없거나 잘못된 라벨 레코드는 평가셋에 들어가기 전에 실패한다.

### 상점 그룹 단위 평가 리포트 추가

- 변경: `npm run dataset:groups`가 동일 `shopGroupId`의 합의 라벨·미검사율·위험/검토 분포를 그룹별로 출력한다.
- 영향: 동일 쇼핑몰의 반복 실행을 섞어 평균내지 않고, 데이터 누수와 그룹별 미검사 범위를 릴리스 전에 확인할 수 있다.

### 경량 후보 분류기 회귀 평가 추가

- 변경: `npm run classifier:evaluate`가 AI 전처리용 결정적 분류기의 기준선 정확도와 `UNRESOLVED` 전달률을 출력한다.
- 영향: 규칙으로 분류 가능한 후보를 저비용으로 먼저 걸러내고, 불확실한 후보만 유료 AI 검토 대상으로 남긴다.

### DL 필요성 재평가 기록

- 변경: 현재 규칙·경량 분류기·유료 AI 검토를 우선하고 DL은 shadow-mode 실험 조건을 충족할 때만 재검토하도록 결정 기록을 추가했다.
- 영향: 실제 운영 라벨과 시각 증거가 부족한 상태에서 비용·지연이 큰 모델을 제품 경로에 조기 편입하지 않는다.

### AI 평가 합의 상태 반영

- 변경: `ai:evaluate`가 `operatorAdjudication=PENDING` 라벨을 정확도·정밀도·재현율에서 제외하고 `pendingLabels`로 별도 출력한다.
- 영향: 합의되지 않은 운영자 판단이 모델 선택 지표를 왜곡하지 않는다.

### AI 데이터셋 내보내기 합의 상태 보존

- 변경: `ai:dataset`이 운영자 라벨의 `operatorAdjudication`을 `PENDING/AGREED` 그대로 내보낸다.
- 영향: 라벨 저장부터 평가까지 합의 상태가 유지되어 보류 라벨을 자동으로 지표에서 제외할 수 있다.

### AI 라벨 저장 계약에 합의 상태 추가

- 변경: AI 라벨 저장 API가 선택적 `adjudication`을 받고, 생략 시 `PENDING`으로 정규화한다.
- 영향: 프론트 라벨링 화면이 합의 상태를 명시적으로 전달할 수 있고, 기존 요청은 안전한 보류 상태로 유지된다.

### AI 라벨 후보 무결성 검증

- 변경: 라벨 저장 API가 보고서에 없는 후보 ID와 중복 후보 라벨을 거부한다.
- 영향: 존재하지 않는 증거를 AI 평가 데이터에 섞거나 한 후보를 여러 번 집계하는 문제를 방지한다.

### 세션 폐기 API 추가

- 변경: `DELETE /api/v1/session`이 현재 HttpOnly 소유 세션 쿠키를 즉시 만료시킨다.
- 영향: 브라우저에서 진단 소유 세션을 명시적으로 폐기할 수 있다.
- 보안: 폐기 쿠키도 발급 쿠키와 동일한 `HttpOnly`, `SameSite=Strict`, HTTPS 환경의 `Secure` 속성을 사용한다.

### 인증·배포 아키텍처 결정 기록

- 변경: 임시 소유 세션과 상용 계정·조직 권한의 차이, Cloudflare Pages·컨테이너 API/워커·관리형 PostgreSQL·오브젝트 스토리지 배포 경계를 문서화했다.
- 영향: 로그인 구현과 운영 배포를 임시 쿠키나 Pages 런타임에 억지로 결합하지 않고, Spring/PostgreSQL 전환 게이트를 기준으로 진행한다.

## 변경 기록 규칙

각 항목에 다음 정보를 포함한다.

- 변경일
- 기능 요약
- 추가·변경·삭제된 endpoint
- 요청/응답 변경
- 프론트 화면 영향
- 마이그레이션 또는 환경변수 필요 여부
- 관련 커밋 또는 PR

기능 구현 커밋과 API 명세 커밋은 가능하면 같은 PR에 포함한다. 긴급한 서버 내부 변경으로 명세 영향이 없더라도 `영향 endpoint: 없음`을 기록한다.
