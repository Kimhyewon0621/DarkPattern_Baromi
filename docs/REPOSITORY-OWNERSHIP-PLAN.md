# 저장소·역할 분리 계획

이 문서는 현재 모노레포를 역할별 저장소로 나누기 전에 경계를 고정하기 위한 문서다. 아직 파일 이동이나 새 저장소 생성은 하지 않는다.

## 현재 코드의 역할

| 영역 | 현재 위치 | 담당 역할 |
| --- | --- | --- |
| 사용자 화면 | `app/` | 진단 시작, 진행 상태, 결과·보고서 화면, 스타일과 브라우저 UI |
| HTTP 진입점 | `app/api/v1/[...path]/route.ts` | 프론트가 호출하는 API 라우팅·인증·요청 변환 |
| 진단 엔진 | `src/` | Playwright 탐색, 구매 여정, 16개 규칙, 증거·가격 원장, 판정 |
| 비동기 실행 | `scripts/worker.ts`, `src/scan-job.ts` | 작업 큐 소비, 재시도, 타임아웃·복구 |
| 현재 상태 저장 | `prisma/`, `src/db.ts` | 스캔·증거·결과의 임시/전환 저장 |
| 최종 백엔드 | `backend-spring/` | Spring Boot, PostgreSQL, Flyway, 운영 상태 저장소 |
| AI 보강 | `datasets/`, `scripts/ai-*`, `src/ai-*` | 라벨·평가·후속 AI 판정 파이프라인 |
| 운영·검증 | `docker-compose*`, `docs/`, `tests/`, `.github/` | 실행 환경, 계약·체크리스트, 회귀 테스트, CI |

진단 엔진은 프론트 기능이 아니라 백엔드/스캐너 영역이다. 프론트는 엔진 내부 모듈이나 DB를 직접 가져오지 않고 API 계약만 사용해야 한다.

## 제안 저장소

1. `baromi-frontend`: `app/`의 화면·컴포넌트·스타일·API 클라이언트
2. `baromi-scanner`: API 진입점, Playwright 엔진, worker, 16개 규칙, 증거·가격 판정
3. `baromi-backend`: `backend-spring/`, PostgreSQL 스키마·Flyway·운영 API
4. `baromi-contracts` (선택): API 스키마, 상태/라벨 enum, 이벤트·보고서 계약

초기에는 `baromi-contracts`를 별도 패키지로 두고, 계약이 안정된 뒤 독립 저장소로 승격해도 된다.

## 분리 순서

1. 현재 `DarkPatternPrevent`의 테스트·빌드·문서를 기준 상태로 동결한다.
2. 프론트↔스캐너↔Spring 사이의 API 계약과 권한 경계를 문서화한다.
3. 프론트를 먼저 분리해 API 호출만 남기고, UI 저장소에 서버 비밀·Playwright·Prisma를 복사하지 않는다.
4. 스캐너를 분리하고 작업 큐·증거 저장 계약을 고정한다.
5. Spring/PostgreSQL을 운영 최종 저장소로 전환한 뒤, Node의 전환 저장 경로를 단계적으로 제거한다.
6. 각 저장소에 독립 CI, 배포 비밀, CODEOWNERS, 브랜치 보호를 설정한다.

## 권한 원칙

- 프론트 팀: `baromi-frontend` 쓰기 권한, 다른 저장소는 이슈·PR 중심.
- 스캐너/백엔드 팀: `baromi-scanner`, `baromi-backend` 쓰기 권한.
- 운영 DB·배포 비밀: 저장소 기여자에게 직접 공개하지 않고 배포 환경의 secret으로만 주입.
- 병합은 각 저장소의 CODEOWNERS 승인과 CI 통과를 필수로 한다.

## 분리 시 금지 사항

`.env`, 테스트 계정 비밀, `node_modules`, 실제 증거·백업 파일, 운영 DB 덤프는 새 저장소로 복사하지 않는다. 새 저장소 생성과 원격 권한 변경은 조직 소유자 확인 후 별도로 실행한다.
