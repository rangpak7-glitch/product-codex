# 기도의샘물 개별 결제 Worker

이 Worker는 신앙자료 한 건의 주문 생성, 토스페이먼츠 결제 승인, 구매 권한 확인, 보호된 다운로드 URL 발급을 서버에서 처리합니다. 정기 구독, 빌링키 저장, 자동 갱신, 구독 해지 API는 사용하지 않습니다.

## 상품·주문 계약

Supabase 마이그레이션은 다음 서버 중심 테이블을 만듭니다.

- `faith_products`: 상품 ID, 연결 자료 ID, 형식, 공개 미리보기, 판매 상태, 확정 가격, 결제 가능 여부
- `faith_orders`: 회원별 상품 주문, 토스 주문번호, 결제 상태, 결제 완료 시각, 결제 요청 만료 시각
- `faith_payment_events`: 원본 웹훅 payload 없이 검증된 결제 식별자와 처리 상태만 저장하는 서버 전용 감사 기록
- `resource_downloads`: 구매 권한으로 발급한 다운로드 기록

`faith_products.resource_id`는 실제 `faith_resources.id` UUID를 참조하며, 다운로드 파일이 없는 기도 여정 상품은 `null`일 수 있습니다. 상품 ID는 사람이 읽기 쉬운 식별자로 관리하고, 보호 파일 권한에는 DB 자료 UUID만 사용합니다.

가격이 정해지지 않은 자료는 반드시 아래 상태로 둡니다.

- `sale_status = 'inquiry'`
- `purchasable = false`
- `price_amount = null`

Worker는 `available`, `purchasable = true`, 양의 `price_amount`, `KRW`가 모두 충족된 상품만 주문을 만들고, 그 외 상품에는 `409 inquiry_only`를 반환합니다. 기도문 PDF의 인쇄 추가금은 `base_print_copies`, `print_pack_size`, `print_pack_price`로 계산하며 브라우저가 보낸 금액은 사용하지 않습니다. 가격을 코드나 Worker 환경 변수에 넣지 않습니다. 주문은 기본 30분 뒤 만료되고, 승인 직전에 현재 판매 상태·가격·통화를 다시 확인합니다. 같은 회원의 같은 상품에는 `ready` 또는 `paid` 주문을 DB에서 하나만 허용합니다.

관리자 역할만 `faith_products`를 직접 생성·수정·삭제할 수 있습니다. 자료 등록 화면은 `faith_resources`를 만든 뒤 실제 UUID를 `resource_id`로 사용해 기본 `inquiry` 상품 행을 함께 만들고, 가격과 판매 여부가 확정된 뒤에만 `available`/`purchasable`로 전환해야 합니다.

## API

모든 회원·주문·다운로드 API에는 Supabase 로그인 세션의 `Authorization: Bearer <access token>`이 필요합니다.

| API | 설명 |
| --- | --- |
| `POST /orders/start` | 본문 `{ "productId": "...", "printCopies": 30 }`로 주문을 만듭니다. PDF는 기본 20부까지 포함하고 초과분을 10부 단위, 묶음당 3,000원으로 서버에서 다시 계산해 총액과 허용 인쇄 부수를 반환합니다. |
| `POST /orders/approve` | 본문 `{ "paymentKey": "...", "orderId": "..." }`로 토스 결제를 승인합니다. Worker가 저장된 주문 금액으로 재검증하며, 클라이언트 금액은 신뢰하지 않습니다. |
| `POST /orders/fail` | 실패 URL에서 본문 `{ "orderId": "..." }`로 준비 중인 주문을 `failed`로 기록합니다. |
| `POST /resources/:resourceId/download` | 관리자 또는 동일 `resource_id`의 `paid` 주문이 있는 회원에게만 5분짜리 서명 다운로드 URL 목록을 반환합니다. 카드 컬렉션처럼 여러 파일이 있는 자료도 모두 포함합니다. |
| `POST /toss/webhook` | 웹훅의 `paymentKey`를 토스 API에서 다시 조회한 뒤, 알려진 주문의 결제/취소 상태만 반영합니다. |
| `GET /admin/community/reports` | 기존 소통게시판 관리자 신고 목록 API입니다. |
| `POST /admin/community/moderate` | 기존 소통게시판 관리자 운영 처리 API입니다. |

계정 화면은 RLS가 적용된 `faith_orders`를 본인 주문으로만 조회할 수 있습니다. 예시 선택 필드는 `id,order_id,product_id,resource_id,amount,currency,status,paid_at,created_at,product:faith_products(id,title,type)`입니다.

## 배포 전 설정

1. Supabase 마이그레이션을 적용합니다.
2. `wrangler login`
3. `wrangler secret put SUPABASE_URL`
4. `wrangler secret put SUPABASE_ANON_KEY`
5. `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
6. `wrangler secret put TOSS_CLIENT_KEY`
7. `wrangler secret put TOSS_SECRET_KEY`
8. `wrangler deploy`

`TOSS_CLIENT_KEY`와 `TOSS_SECRET_KEY`는 반드시 같은 결제위젯 연동 키 쌍이어야 합니다.

- 테스트: `test_gck_...` 클라이언트 키 + `test_gsk_...` 시크릿 키
- 라이브: `live_gck_...` 클라이언트 키 + `live_gsk_...` 시크릿 키

`test_ck_...` 또는 `live_ck_...`로 시작하는 API 개별 연동 클라이언트 키는 결제위젯 SDK에 사용할 수 없습니다. 테스트 키로 연동하면 결제 화면과 승인·취소 흐름은 검증할 수 있지만 실제 금액은 청구되지 않습니다. 라이브 전환 시에는 토스페이먼츠 개발자센터에서 같은 상점아이디의 라이브 결제위젯 키 쌍을 확인한 뒤 두 Worker Secret을 함께 교체하고 다시 배포합니다.

`SUPABASE_SERVICE_ROLE_KEY`와 토스 비밀키는 브라우저 코드, Git, Cloudflare Pages 환경 변수에 넣지 않습니다. Worker Secret으로만 관리합니다.

토스 일반 결제 웹훅은 Worker가 받은 원본 payload를 신뢰하지 않고 `paymentKey`로 토스 결제 조회 API를 호출해 검증합니다. 카드·구매자 정보가 포함될 수 있는 원본 payload는 DB에 저장하지 않습니다.

`wrangler.toml`의 `PAGES_PREVIEW_HOST_SUFFIX`는 이 Pages 프로젝트의 미리보기 하위 도메인만 CORS와 결제 성공/실패 URL로 허용합니다. 외부 스테이징 주소는 `ALLOWED_ORIGINS`에 정확한 origin만 쉼표로 추가합니다. `ORDER_TTL_SECONDS`는 60~7,200초 범위에서만 적용됩니다.

## 검증 순서

1. RLS가 켜진 뒤 비회원은 `faith_orders`와 `faith_payment_events`를 읽을 수 없고, 회원은 자기 주문만 볼 수 있는지 확인합니다.
2. 가격 미확정 상품의 `/orders/start`가 `409 inquiry_only`인지 확인합니다.
3. 가격과 판매 상태를 확정한 테스트 상품으로 토스 테스트 결제를 진행합니다.
4. 동일 상품을 두 탭에서 시작해도 하나의 `ready` 주문만 재사용되는지, 만료·가격 변경 주문은 승인되지 않는지 확인합니다.
5. 성공 URL의 `paymentKey`, `orderId`로 `/orders/approve`를 호출하고, Worker가 저장된 금액과 토스 응답을 일치시키는지 확인합니다. 실패 URL은 `/orders/fail` 뒤 결제 내역에 `결제 실패`로 남아야 합니다.
6. 결제 완료 회원만 해당 자료의 모든 다운로드 URL을 받고, 다른 회원·미결제 주문·다른 자료 ID는 `403`인지 확인합니다.
7. 같은 승인/웹훅 요청을 다시 보내도 결제 이벤트가 중복 기록되지 않고, 소통게시판 관리자 API가 계속 동작하는지 확인합니다.
## 고객·문의 관리와 Resend 알림

문의 접수와 고객 현황은 결제 API와 같은 Worker에서 서버 전용 Supabase 권한으로 처리합니다. 이메일과 문의 본문은 브라우저에서 Supabase 테이블을 직접 조회할 수 없으며 관리자 역할만 Worker API를 통해 확인합니다.

| API | 설명 |
| --- | --- |
| `POST /contact/inquiries` | 비회원과 회원의 웹 문의를 저장하고 Resend 관리자 알림을 시도합니다. 허용된 사이트 Origin만 접수합니다. |
| `GET /admin/customers` | 관리자 역할에게 회원·문의 고객·구매 고객 현황과 문의 목록을 반환합니다. |
| `POST /admin/inquiries/status` | 관리자 역할이 문의 처리 상태와 내부 메모를 저장합니다. |

Resend 설정값은 Git이나 `wrangler.toml`에 실제 값을 넣지 않고 모두 Worker Secret으로 등록합니다.

```text
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM_EMAIL
wrangler secret put CONTACT_NOTIFICATION_EMAIL
```

`RESEND_FROM_EMAIL`은 Resend에서 인증한 발신 도메인의 주소를 사용해야 합니다. 메일 전송 설정이 없거나 일시적으로 실패해도 문의 원문은 Supabase에 먼저 저장되고, 관리자 화면의 알림 상태가 `skipped` 또는 `failed`로 남습니다.
