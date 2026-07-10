# 기도의샘물

## 일일 콘텐츠 자동화

GitHub Actions 워크플로는 매일 한국 시간 오전 6시(UTC 21:00)에 `data/dailyContents.js`에 말씀 붙들기, 저녁기도, 아침기도, 큐티(QT) 콘텐츠를 생성합니다. `main`에 변경을 푸시하면 Cloudflare Pages가 기존 Git 연동을 통해 배포합니다.

### GitHub 설정

저장소의 **Settings → Secrets and variables → Actions**에서 다음 값을 등록합니다.

- Secret `OPENAI_API_KEY`: OpenAI API 키. 저장소, 코드, 로그에 키를 넣지 않습니다.
- Variable `OPENAI_MODEL`: `gpt-5.5`

워크플로는 **Actions → Generate daily content → Run workflow**에서 수동 실행할 수 있습니다. 같은 한국 날짜의 4개 항목이 이미 모두 있으면 콘텐츠를 다시 만들거나 커밋하지 않습니다.

생성·검증 중 오류가 나면 워크플로가 실패하고 기존 공개 콘텐츠는 유지됩니다. GitHub의 예약 실행은 지정 시각에 시작되도록 요청되지만, GitHub Actions의 스케줄 처리 지연 가능성은 있습니다.

## 신앙자료 개별 구매 운영

신앙자료는 월 구독이나 자동 갱신 없이 자료별 단건 구매를 기준으로 설계되어 있습니다. 현재 가격이 확정되지 않은 자료는 `inquiry` 상태와 공개 미리보기만 제공하며, 화면에는 가격이나 비활성 결제 버튼 대신 `자료 문의하기`가 표시됩니다.

상품 계약은 `faith_products`에서 관리합니다. 상품 ID, 실제 자료 UUID, 형식, 공개 미리보기, 판매 상태, 가격, 결제 가능 여부를 한 행에 둡니다. 결제 완료 후의 접근 권한은 `profiles`의 구독 상태가 아니라 `faith_orders.status = 'paid'`인 해당 자료 주문으로 확인합니다.

### 배포 순서

1. Supabase에 [자료 기준 스키마](supabase/migrations/20260710035000_faith_resources_baseline.sql)와 [주문형 마이그레이션](supabase/migrations/20260710035118_membership_community_billing.sql)을 파일명 순서대로 적용합니다.
2. [Worker 운영 문서](workers/billing/README.md)에 따라 Worker Secret을 등록하고 `workers/billing`을 배포합니다.
3. 실제 Worker의 공개 URL을 [assets/js/supabase-config.js](assets/js/supabase-config.js)에 `FAITH_ORDER_API_URL`로 설정합니다. 이 주소는 공개해도 되는 API 주소이며, Supabase Service Role 키와 토스 비밀키는 Worker Secret으로만 관리합니다.
4. 관리자 자료 등록 화면에서 실제 자료 UUID에 연결된 상품을 생성합니다. 가격을 확정한 자료만 `available`, 양의 가격, `purchasable=true`로 발행합니다.
5. `main`으로 푸시하면 Cloudflare Pages의 Git 연동 배포가 실행됩니다.

브라우저는 로그인, 공개 미리보기, 주문 시작, 결제 완료 화면, 내 자료실만 담당합니다. 결제 승인, 토스 금액 재검증, 주문 기록, 구매 권한 확인, 다운로드 서명 URL 발급은 Worker에서 처리합니다.

### 출시 전 확인

- 비회원: 공개 미리보기와 문의만 가능하고 보호 파일은 열리지 않는지
- 회원: 자기 주문만 내 자료실과 결제 내역에서 보이는지
- 가격 미확정 상품: `/orders/start`가 문의 흐름으로 끝나는지
- 가격 확정 상품: 결제 성공·실패, 재시도, 결제 완료 뒤 다운로드가 정상인지
- 모바일과 키보드: 필터, 자료 CTA, 메뉴, 포커스 표시가 겹치지 않는지
