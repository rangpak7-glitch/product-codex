# 기도의샘물

## 일일 콘텐츠 자동화

GitHub Actions 워크플로는 매일 한국 시간 오전 6시(UTC 21:00)에 `data/dailyContents.js`에 말씀 붙들기, 저녁기도, 아침기도, 큐티(QT) 콘텐츠를 생성합니다. `main`에 변경을 푸시하면 Cloudflare Pages가 기존 Git 연동을 통해 배포합니다.

### GitHub 설정

저장소의 **Settings → Secrets and variables → Actions**에서 다음 값을 등록합니다.

- Secret `OPENAI_API_KEY`: OpenAI API 키. 저장소, 코드, 로그에 키를 넣지 않습니다.
- Variable `OPENAI_MODEL`: `gpt5.6 luna`

워크플로는 **Actions → Generate daily content → Run workflow**에서 수동 실행할 수 있습니다. 같은 한국 날짜의 4개 항목이 이미 모두 있으면 콘텐츠를 다시 만들거나 커밋하지 않습니다.

생성·검증 중 오류가 나면 워크플로가 실패하고 기존 공개 콘텐츠는 유지됩니다. GitHub의 예약 실행은 지정 시각에 시작되도록 요청되지만, GitHub Actions의 스케줄 처리 지연 가능성은 있습니다.
