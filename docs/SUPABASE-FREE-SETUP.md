# 무료 단계 Supabase 설정 계약

## 서비스 구성

- Supabase Auth: 이메일 인증·OAuth와 사용자 세션
- Supabase PostgreSQL: 조직, 멤버십, 상점, 진단 메타데이터
- Supabase Storage: 보고서와 증거 파일
- Vercel: 공개 Next.js 프론트(Cloudflare Pages로 대체 가능)

Spring API에는 Supabase의 `service_role` 키를 노출하지 않는다. 브라우저는 publishable/anon 키만 사용하고, 서버는 비밀 환경변수로 보관한다.

## 환경변수 계약

웹 프론트(브라우저 Supabase Auth와 세션 갱신):

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Spring/워커:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
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

## 현재 Next.js 로그인 구현

- `/login`에서 이메일/비밀번호 로그인과 계정 생성을 제공한다. 이메일 인증을 켠 프로젝트는 확인 메일을 거친 뒤 로그인한다.
- 루트 `proxy.ts`가 보호 화면(`/scan/new`, `/scan/*`, `/report/*`, `/shop/*`)에서 Supabase 세션을 갱신하고, 로그인되지 않은 사용자를 `/login?next=...`로 보낸다.
- API는 Supabase `sub`를 소유자 식별자로 사용한다. `auth.getClaims()`가 서명 키를 통해 토큰을 확인하므로 서버에 Supabase JWT 공유 비밀을 직접 넣지 않는다.
- Supabase 설정이 없으면 기존 로컬 익명 세션 호환 경로가 남아 있다. 따라서 로컬 기본 설정에서 로그인은 자동으로 켜지지 않는다.
- 브라우저에는 publishable/anon key만 설정한다. `service_role` 키는 사용하지 않는다.
- Supabase Dashboard의 Auth URL 설정에서 로컬 `http://localhost:3000/login`과 실제 웹 도메인의 `/login`을 redirect allowlist에 추가한다. Email provider와 이메일 확인 여부는 프로젝트 정책에 맞춰 설정한다.

## 무료 단계의 한계

Cloudflare Pages와 Supabase만으로는 Playwright 브라우저 워커와 장시간 Spring 프로세스를 안정적으로 실행할 수 없다. 따라서 API·워커 실행 환경은 별도로 두고, 무료 한도와 sleep/cold-start를 승인 테스트로 측정한 뒤 유료 컨테이너로 전환한다.
