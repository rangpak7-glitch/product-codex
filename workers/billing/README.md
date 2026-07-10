# 기도의샘물 결제 Worker

이 Worker는 토스페이먼츠 빌링키를 브라우저가 아닌 서버에서만 발급·암호화·갱신합니다. `workers.dev` 주소를 배포한 뒤, 그 주소를 `assets/js/faith-member.js`의 `FAITH_BILLING_API_URL`에 설정합니다.

## 배포 전 설정

1. `wrangler login`
2. `wrangler secret put SUPABASE_URL`
3. `wrangler secret put SUPABASE_ANON_KEY`
4. `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
5. `wrangler secret put TOSS_CLIENT_KEY`
6. `wrangler secret put TOSS_SECRET_KEY`
7. `wrangler secret put BILLING_KEY_ENCRYPTION_KEY`
   - 32바이트 난수의 Base64 값으로 설정합니다.
8. 토스 웹훅 계약을 설정한 경우 `wrangler secret put TOSS_WEBHOOK_SECRET`
9. `wrangler deploy`

`SUPABASE_SERVICE_ROLE_KEY`, 토스 비밀키, 빌링키는 브라우저 코드·Git·Cloudflare Pages 환경 변수에 넣지 않습니다. Worker Secret으로만 관리합니다.

## 테스트 순서

1. Supabase 마이그레이션을 적용합니다.
2. 토스 테스트 키로 카드 빌링 인증과 최초 결제를 확인합니다.
3. Worker의 `/toss/webhook` URL을 토스 대시보드에 등록합니다.
4. 결제, 해지, 7일 이내 다운로드 전 환불, 다운로드 후 환불 제한을 확인합니다.
