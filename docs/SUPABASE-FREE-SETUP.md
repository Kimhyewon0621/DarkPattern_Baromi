# 무료 단계 Supabase 설정 계약

## 서비스 구성

- Supabase Auth: 이메일 인증·OAuth와 사용자 세션
- Supabase PostgreSQL: 조직, 멤버십, 상점, 진단 메타데이터
- Supabase Storage: 보고서와 증거 파일
- Vercel: 공개 Next.js 프론트(Cloudflare Pages로 대체 가능)

Spring API에는 Supabase의 `service_role` 키를 노출하지 않는다. 브라우저는 publishable/anon 키만 사용하고, 서버는 비밀 환경변수로 보관한다.

## 환경변수 계약

프론트:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_ORIGIN=
```

Spring/워커:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_ISSUER=
SUPABASE_JWT_AUDIENCE=authenticated
DATABASE_URL=postgresql://...
SUPABASE_STORAGE_BUCKET=baromi-evidence
```

실제 값은 저장소·Cloudflare·컨테이너 로그에 기록하지 않는다.

## 권한 원칙

1. 브라우저가 보낸 사용자 JWT는 Spring에서 issuer, audience, 서명을 검증한다.
2. 조직 멤버십과 역할은 서버에서 다시 조회한다.
3. 상점·진단·보고서·AI 검토 조회는 조직 ID 조건을 항상 포함한다.
4. Storage 객체 경로는 조직/상점/진단 ID로 제한하고, 공개 URL을 만들지 않는다.
5. AI 검토 요청은 조직 플랜과 후보 소유권을 서버에서 확인한다.

## 무료 단계의 한계

Cloudflare Pages와 Supabase만으로는 Playwright 브라우저 워커와 장시간 Spring 프로세스를 안정적으로 실행할 수 없다. 따라서 API·워커 실행 환경은 별도로 두고, 무료 한도와 sleep/cold-start를 승인 테스트로 측정한 뒤 유료 컨테이너로 전환한다.
