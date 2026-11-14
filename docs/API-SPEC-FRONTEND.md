# Baromi API 명세 v1

프론트는 서버 내부 모듈이나 DB를 직접 사용하지 않고 아래 HTTP API만 호출한다.

## 공통 규칙

- Base URL: 현재 프론트와 같은 origin의 `/api/v1`
- 요청 본문: `Content-Type: application/json`
- 세션: 서버가 `darkpattern-session` HttpOnly 쿠키를 발급한다. 프론트는 쿠키 값을 읽거나 직접 저장하지 않는다.
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
  "currentStage": "product|cart|checkout|null",
  "progress": 67,
  "coverage": { "product": "COVERED", "cart": "PENDING", "checkout": "PENDING" },
  "surfaceCoverage": { "SEARCH": "COVERED", "LOGIN": "DISCOVERED" },
  "summary": { "suspected": 1, "reviewNeeded": 0, "notTested": 0 }
}
```

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

다운로드는 `GET /api/v1/scans/:scanId/report?download=1`.

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

운영자 라벨 저장:

```json
{ "labels": [{ "candidateId": "...", "label": "LIKELY_RISK|NEEDS_REVIEW|LIKELY_BENIGN|INSUFFICIENT_EVIDENCE" }] }
```

## 프론트 구현 주의

1. `401` 대신 리소스가 없을 때 `404`가 반환될 수 있으므로 로그인 세션 만료 시 등록 화면으로 복귀한다.
2. `503`은 저장소/워커 장애, `409`는 검증·상태 충돌, `429`는 호출 제한으로 표시한다.
3. 보고서 화면은 `coverage`, `surfaceCoverage`, `summary.notTested`를 반드시 표시해 미검사와 위험 판정을 구분한다.
4. 결제·주문 확정 버튼을 누르는 API는 제공하지 않는다. 진단 엔진은 탐색·기록만 수행한다.
