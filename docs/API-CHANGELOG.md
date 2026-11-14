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
