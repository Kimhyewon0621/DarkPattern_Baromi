# Baromi API 명세 v1

프론트는 서버 내부 모듈이나 DB를 직접 사용하지 않고 아래 HTTP API만 호출한다.

## 공통 규칙

- Base URL: 현재 프론트와 같은 origin의 `/api/v1`
- 요청 본문: `Content-Type: application/json`
- 세션: 서버가 `darkpattern-session` HttpOnly 쿠키를 발급한다. 프론트는 쿠키 값을 읽거나 직접 저장하지 않는다.
- 세션 폐기: `DELETE /api/v1/session`이 HttpOnly 세션 쿠키를 즉시 만료시킨다.
- 오류 형식: `{ "error": "사용자에게 표시할 메시지" }`
- 주요 상태: `QUEUED`, `RUNNING`, `COMPLETED`, `PARTIAL`, `CANCELLED`, `FAILED`
- 화면 단계: `product`, `cart`, `checkout`
- 표면 상태: `COVERED`, `DISCOVERED`, `PENDING`, `BLOCKED`, `NOT_FOUND`, `SKIPPED`

## 1. 서버 상태

### `GET /api/v1/health`

응답 `200`이면 정상, `503`이면 점검 필요.

```json
{
  "status": "ok",
  "service": "baromi",
  "version": "0.1.0",
  "storage": { "mode": "SPRING_POSTGRES", "spring": "ready" },
  "worker": { "queued": 0, "running": 0, "stale": 0 }
}
```

## 2. 쇼핑몰 등록·확인

### `GET /api/v1/shops?limit=50`

현재 세션에 속한 쇼핑몰 목록을 반환한다. `limit`은 1~100으로 제한된다.

```json
{ "limit": 50, "shops": [{ "shopId": "uuid", "url": "https://shop.example.com" }] }
```

### `POST /api/v1/shops`

```json
{ "url": "https://shop.example.com", "consent": true }
```

응답 `201`:

```json
{
  "shopId": "uuid",
  "url": "https://shop.example.com",
  "verification": {
    "name": "baromi-site-verification",
    "token": "...",
    "metaTag": "<meta name=\"baromi-site-verification\" content=\"...\">",
    "filePath": "/baromi-site-verification.txt",
    "dnsRecord": "_baromi-verification.example.com TXT ..."
  }
}
```

데모 주소는 `verification: null`일 수 있다.

### `GET /api/v1/shops/:shopId`

```json
{ "id": "uuid", "url": "https://...", "consentAt": "ISO-8601", "verifiedAt": "ISO-8601|null" }
```

### `POST /api/v1/shops/:shopId/verify`

응답:

```json
{ "verified": true, "verifiedAt": "ISO-8601", "method": "meta|file|dns" }
```

## 3. 진단 시작

### `POST /api/v1/scans`

현재 한 번에 상품 1개 구매 흐름만 진단한다.

```json
{
  "shopId": "uuid",
  "profile": "CONTEST|DYNAMIC",
  "viewport": "DESKTOP|MOBILE",
  "purchasePath": "CART|DIRECT",
  "flows": ["PURCHASE"],
  "productLimit": 1,
  "credentials": { "username": "test@example.com", "password": "..." },
  "baselineScanId": "uuid|null"
}
```

`credentials`는 `DYNAMIC`에서만 보내며 서버가 암호화해 저장한다. 응답 `202`:

```json
{ "scanId": "uuid", "status": "QUEUED", "createdAt": "ISO-8601" }
```

이미 같은 진단이 실행 중이면 `deduplicated: true`가 추가된다.

## 4. 진단 진행 상태

### `GET /api/v1/scans/:scanId`

```json
{
  "scanId": "uuid",
  "shopId": "uuid",
  "executionMode": "STATIC|DYNAMIC",
  "viewport": "DESKTOP|MOBILE",
  "purchasePath": "CART|DIRECT",
  "status": "QUEUED|RUNNING|COMPLETED|PARTIAL|CANCELLED|FAILED",
  "currentStage": "product|cart|checkout|surface:<영역>|site-crawl|null",
  "progress": 67,
  "phaseResults": { "product": { "status": "COVERED", "startedAt": "ISO-8601", "finishedAt": "ISO-8601", "durationMs": 1200, "reason": null, "evidenceIds": ["evidence-id"] } },
  "coverage": { "product": "COVERED", "cart": "PENDING", "checkout": "PENDING" },
  "surfaceCoverage": { "SEARCH": "COVERED", "LOGIN": "DISCOVERED" },
  "summary": { "suspected": 1, "reviewNeeded": 0, "notTested": 0 }
}
```

`phaseResults`에는 구매 단계, 별도 탐색 영역, 전체 크롤링 단계의 실제 상태·시간·근거 ID·미완료 사유가 포함된다. 프론트는 이 값을 기준으로 실행 중과 미검사를 구분한다.

프론트는 `QUEUED`/`RUNNING` 동안 1~2초 간격으로 조회하고, `COMPLETED`/`PARTIAL`/`CANCELLED`/`FAILED`에서 중지한다.

### `POST /api/v1/scans/:scanId/cancel`

응답 `202`: `{ "status": "RUNNING", "cancelRequested": true }`  
대기 중 취소 응답: `{ "status": "CANCELLED" }`

## 5. 결과·보고서

### `GET /api/v1/scans/:scanId/findings`

진단 항목 배열. 각 항목은 `id`, `type`, `stage`, `status`, `reason`, `ruleVersion`를 포함한다.

### `GET /api/v1/scans/:scanId/report`

전체 보고서 JSON. 주요 필드:

```json
{
  "scanId": "uuid",
  "findings": [],
  "snapshots": [],
  "coverage": {},
  "surfaceCoverage": {},
  "summary": { "suspected": 0, "reviewNeeded": 0, "notTested": 0 },
  "comparison": null,
  "aiEligible": false,
  "aiReview": null
}
```

다운로드는 `GET /api/v1/scans/:scanId/report?download=1`이며 `Content-Disposition: attachment` 응답을 반환한다. SQLite·Spring/PostgreSQL 저장소에서 같은 JSON 보고서를 받는다.

### `GET /api/v1/findings/:findingId`

특정 발견 항목의 상세 정보와 연결된 증거 정보를 반환한다.

### `GET /api/v1/evidences/:scanId-:stage`

증거 PNG를 반환한다. `Content-Type: image/png`.

## 6. 쇼핑몰 이력·삭제

### `GET /api/v1/shops/:shopId/scans`

최근 진단 목록(최대 50개)을 반환한다. 각 항목에 `scanId`, `status`, `executionMode`, `viewport`, `purchasePath`, `createdAt`, `durationMs`, `summary`가 있다.

### `DELETE /api/v1/scans/:scanId`

완료된 진단과 증거를 삭제한다. 진행 중이면 `409`.

### `DELETE /api/v1/shops/:shopId`

진단이 진행 중이지 않을 때 쇼핑몰과 관련 이력을 삭제한다.

## 7. 유료 AI 검토

### `POST /api/v1/scans/:scanId/ai-review`

유료 플랜에서 사용자가 명시적으로 요청한다. 응답 `202`:

```json
{ "id": "uuid", "status": "QUEUED" }
```

### `POST /api/v1/scans/:scanId/ai-review-labels`

각 라벨은 해당 진단 보고서의 `reviewCandidates[].id`에 존재하는 `candidateId`, `label`과 선택적 `adjudication`(`PENDING|AGREED`)을 받는다. 같은 후보를 중복 제출할 수 없으며, 생략하면 서버가 `PENDING`으로 저장한다. 합의되지 않은 라벨은 오프라인 모델 평가 지표에 포함되지 않는다.

운영자 라벨 저장:

```json
{ "labels": [{ "candidateId": "...", "label": "LIKELY_RISK|NEEDS_REVIEW|LIKELY_BENIGN|INSUFFICIENT_EVIDENCE" }] }
```

## 8. Spring/PostgreSQL 내부 API

아래 API는 브라우저가 직접 호출하지 않는다. Node API와 worker가 `X-Baromi-Owner` 또는 `X-Baromi-Worker` 헤더를 사용해 호출한다.

### `GET /api/v1/health/readiness`

PostgreSQL 연결 확인. 정상 응답:

```json
{ "status": "ready", "database": "ok" }
```

### `POST /api/v1/shops` (Spring)

헤더 `X-Baromi-Owner` 필수. 본문은 `{ "id": "uuid|null", "url": "https://...", "consent": true }`이며, Node에서 미러링할 때 사용한다.

### `GET /api/v1/shops/:shopId` (Spring)

헤더 `X-Baromi-Owner` 필수. 응답은 `{ "shopId": "uuid", "url": "https://..." }`.

### `GET /api/v1/shops` (Spring)

헤더 `X-Baromi-Owner` 필수. 응답은 Node 목록 API와 같은 `{ "limit": 50, "shops": [] }` 형식이다.

### `POST /api/v1/scans` (Spring)

헤더 `X-Baromi-Owner` 필수. 본문:

```json
{
  "id": "uuid|null",
  "shopId": "uuid",
  "targetUrl": "https://shop.example.com",
  "executionMode": "STATIC|DYNAMIC",
  "viewport": "DESKTOP|MOBILE",
  "purchasePath": "CART|DIRECT"
}
```

응답 `202`: `{ "scanId": "uuid", "status": "queued" }`.

### `GET /api/v1/scans/:scanId` (Spring)

헤더 `X-Baromi-Owner` 필수. 상태는 소문자 `queued|running|partial|succeeded|failed|cancelled`로 반환될 수 있다. 프론트 공개 API는 이를 대문자 상태로 정규화한다.

### `GET /api/v1/scans/:scanId/report` (Spring)

헤더 `X-Baromi-Owner` 필수. PostgreSQL에 저장된 원본 보고서 JSON을 반환한다.

### `GET /api/v1/scans/shop/:shopId` (Spring)

헤더 `X-Baromi-Owner` 필수. `limit`은 1~100이다.

### `POST /api/v1/scans/claim` (worker 전용)

헤더 `X-Baromi-Worker` 필수. 큐에서 가장 오래된 `queued` 작업을 원자적으로 가져와 `running`으로 바꾼다. 작업이 없으면 `204`.

### `PATCH /api/v1/scans/:scanId/status` (worker 전용)

헤더 `X-Baromi-Worker` 필수. 본문:

```json
{ "status": "queued|running|partial|succeeded|failed|cancelled", "stage": "product|cart|checkout|surface:AUTH|site-crawl|null", "phaseResults": { "product": { "status": "COVERED", "durationMs": 1200, "evidenceIds": ["evidence-id"] } }, "reportJson": "..." }
```

허용되지 않는 상태 전이는 `409`다. 단계 결과는 최대 256KiB이며 보고서 JSON은 최대 4MB다. 상태 조회는 저장된 `phaseResults`를 반환한다. 보관 기간은 서버 정책을 따른다.

### `POST /api/v1/scans/recover` (worker/운영 전용)

헤더 `X-Baromi-Worker` 필수. 본문 `{ "staleBefore": "ISO-8601" }`. 오래 멈춘 `running` 작업을 `failed`로 전환하고 `{ "recovered": 0, "staleBefore": "..." }`를 반환한다.

## 9. 프론트가 사용할 공개 API와 내부 API 구분

프론트 팀은 `POST /shops`, `GET /shops`, `GET /shops/:id`, `POST /shops/:id/verify`, `POST /scans`, `GET /scans/:id`, `GET /scans/:id/findings`, `GET /scans/:id/report`, `GET /shops/:id/scans`, `POST /scans/:id/cancel`, AI 검토 API만 사용한다. `X-Baromi-Owner`, `X-Baromi-Worker`, Spring 직접 호출은 프론트 코드에 넣지 않는다.

## 프론트 구현 주의

1. `401` 대신 리소스가 없을 때 `404`가 반환될 수 있으므로 로그인 세션 만료 시 등록 화면으로 복귀한다.
2. `503`은 저장소/워커 장애, `409`는 검증·상태 충돌, `429`는 호출 제한으로 표시한다.
3. 보고서 화면은 `coverage`, `surfaceCoverage`, `summary.notTested`를 반드시 표시해 미검사와 위험 판정을 구분한다.
4. 결제·주문 확정 버튼을 누르는 API는 제공하지 않는다. 진단 엔진은 탐색·기록만 수행한다.
