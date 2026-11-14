# 인증·배포 아키텍처 결정 기록

## 현재 상태

현재 웹 API는 `darkpattern-session` HttpOnly 쿠키로 임시 소유권을 구분한다. 이 방식은 개발·승인 테스트몰 검증용이며, 이메일 로그인이나 조직 권한을 제공하지 않는다.

## 상용 인증 목표

- Spring/PostgreSQL을 계정·조직·역할·세션의 최종 저장소로 사용한다.
- 이메일 인증 로그인과 OAuth 로그인을 지원한다.
- 조직 역할은 `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`로 분리한다.
- 세션은 서버 측 폐기 목록 또는 회전 가능한 refresh token으로 즉시 철회할 수 있어야 한다.
- 쇼핑몰·진단·AI 검토 접근은 조직 멤버십과 플랜 권한으로 확인한다.
- 기존 임시 소유 쿠키는 마이그레이션 기간에만 호환하고, 상용 전환 후 제거한다.

## 무료 1단계 배포 결정

- 프론트: Cloudflare Pages
- 인증: Supabase Auth
- 상태 저장소: Supabase PostgreSQL
- 증거·보고서: Supabase Storage
- Spring API: 무료 컨테이너 호스팅 또는 개발 단계 실행 환경
- 탐색/AI 워커: 별도 실행 환경(브라우저 런타임을 지원하는 무료 VM/컨테이너 우선)

Cloudflare Pages에는 장시간 브라우저 탐색 워커나 PostgreSQL을 배치하지 않는다. API, 워커, 데이터베이스, 오브젝트 스토리지는 각각 독립적으로 백업·스케일·장애 복구해야 한다.

## 유료 운영 전환

트래픽·워커 실행시간·저장량이 무료 한도를 넘으면 Spring API와 워커를 Render/Railway 또는 AWS 컨테이너로 이전한다. Supabase의 PostgreSQL·Auth·Storage 계약은 유지해 이전 비용을 줄인다.

## 출시 전 게이트

1. 계정·조직·역할 API와 세션 폐기 테스트가 통과한다.
2. Supabase Auth 사용자와 Spring/PostgreSQL 상점·진단·AI 권한 조회가 단일 사용자 식별자로 연결된다.
3. 워커 재시작·중복 실행·보관 삭제·복구를 운영 환경에서 리허설한다.
4. Pages → API → 워커 → PostgreSQL → 오브젝트 스토리지의 TLS·비밀값·로그 마스킹을 검증한다.
