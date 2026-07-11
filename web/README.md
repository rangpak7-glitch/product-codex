# 기도의샘물 Next.js 정적 미리보기

이 디렉터리는 기존 정적 사이트를 중단하지 않고 Next.js App Router로 단계적으로 전환하기 위한 독립 미리보기 앱입니다.

## 실행

```powershell
cd web
npm install
npm run dev
```

정적 산출물은 다음 명령으로 `web/out`에 생성합니다.

```powershell
npm run build
```

`prebuild` 단계에서 루트의 `assets`, `data`, `robots.txt`, `sitemap.xml`, `ads.txt`를 `web/public`으로 복사합니다. 원본 파일의 내용은 변경하지 않습니다.

## 클라이언트와 서버 경계

- Next.js는 `output: "export"`로 HTML/CSS/JavaScript 정적 파일만 생성합니다.
- 로그인과 나눔게시판은 브라우저의 Supabase 클라이언트와 RLS를 사용합니다.
- 주문 생성, 결제 승인, 권한 확인, 보호 다운로드 URL 발급은 기존 Cloudflare Worker에서만 수행합니다.
- Supabase Service Role 키와 결제 비밀키는 브라우저나 `NEXT_PUBLIC_` 환경 변수에 넣지 않습니다.
- 요청 시점 SSR, ISR, Server Actions, 서버 쿠키는 이 단계에서 사용하지 않습니다.

## Cloudflare Pages 미리보기

- Root directory: `web`
- Build command: `npm run build`
- Build output directory: `out`
- Node.js: 22 이상

운영 전환 전에는 별도 Preview 프로젝트에서 기존 `.html` 주소, 로그인, 게시판, 결제, 다운로드 흐름을 검증합니다.
