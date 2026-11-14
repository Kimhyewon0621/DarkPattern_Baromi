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
