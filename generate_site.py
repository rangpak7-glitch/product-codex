from pathlib import Path

ROOT = Path(__file__).parent
SITE = "https://rangpak7-glitch.github.io/product-codex"
ADS_META = '<meta name="google-adsense-account" content="ca-pub-9363769983329867">'
ADS_SCRIPT = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9363769983329867" crossorigin="anonymous"></script>'

NAV = [
    ("about.html", "기도의 샘물 소개"),
    ("prayers.html", "말씀 붙들기"),
    ("night-prayer.html", "수면기도"),
    ("morning-prayer.html", "아침기도"),
    ("meditation.html", "영상묵상"),
    ("prayer-cards.html", "신앙자료"),
    ("prayer-request.html", "기도제목"),
    ("contact.html", "문의하기"),
]


def w(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text.strip() + "\n", encoding="utf-8")


def head(title, desc, path=""):
    url = f"{SITE}/{path}" if path else f"{SITE}/"
    return f"""<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{desc}">
  {ADS_META}
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}/assets/logo-sam.png">
  <title>{title}</title>
  {ADS_SCRIPT}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700;800;900&family=Noto+Serif+KR:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
</head>"""


def header(active=""):
    links = "\n".join(
        f'<a{" class=\"active\"" if href == active else ""} href="{href}">{label}</a>'
        for href, label in NAV
    )
    return f"""<header class="site-header">
  <a class="brand" href="index.html" aria-label="기도의 샘물 홈으로 이동">
    <img src="assets/logo-sam.png" alt="기도의 샘물 로고">
    <span><strong>기도의 샘물</strong><small>기도와 말씀으로 쉬어가는 곳</small></span>
  </a>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span><span class="sr-only">메뉴 열기</span></button>
  <nav id="site-nav" class="site-nav" aria-label="주요 메뉴">{links}</nav>
</header>"""


def footer():
    return """<footer class="site-footer">
  <div><strong>기도의 샘물</strong><p>기도문과 말씀 묵상을 정성스럽게 모아 전하는 기독교 콘텐츠 공간입니다.</p></div>
  <div class="footer-links"><a href="privacy.html">개인정보처리방침</a><a href="terms.html">이용약관</a><a href="disclaimer.html">콘텐츠 안내</a><a href="sitemap.xml">사이트맵</a></div>
</footer>
<script src="data/prayers.js"></script>
<script src="data/meditations.js"></script>
<script src="data/videos.js"></script>
<script src="data/prayerCards.js"></script>
<script src="data/prayerChallenge.js"></script>
<script src="assets/js/script.js"></script>"""


def page(file, title, desc, active, body):
    w(file, f"""<!DOCTYPE html>
<html lang="ko">
{head(title, desc, file)}
<body>
{header(active)}
<main>{body}</main>
{footer()}
</body>
</html>""")


home = """
<section class="hero soft-light"><div class="hero-content"><p class="eyebrow">Christian Prayer & Meditation</p><h1>지친 마음이 쉬어가는 말씀과 기도의 자리</h1><p class="hero-name">기도의 샘물</p><p class="hero-copy">하루 중 마음이 무너지는 순간에도 말씀과 기도로 다시 평안을 찾을 수 있도록, 큰 글씨의 기도문과 차분한 묵상 자료를 정성스럽게 전합니다.</p><div class="hero-actions"><a class="button primary" href="prayers.html">오늘의 기도문 읽기</a><a class="button secondary" href="https://youtube.com/channel/UCFrsilNKJ8xcmn0RUrFz6XQ?si=djJ2EIDNC_PMbJbj" target="_blank" rel="noopener">유튜브 채널 보기</a></div></div></section>
<section class="section"><p class="eyebrow">Content Hub</p><h2>필요한 기도와 말씀으로 바로 이동하세요</h2><div class="hub-grid"><a class="hub-card" href="prayers.html"><span>✦</span><strong>오늘의 기도문</strong><p>마음의 형편에 맞는 기도문을 찾아 읽습니다.</p></a><a class="hub-card" href="night-prayer.html"><span>☾</span><strong>잠잘 때 듣는 밤기도</strong><p>하루의 긴장을 내려놓고 말씀 안에서 평안을 구합니다.</p></a><a class="hub-card" href="morning-prayer.html"><span>☀</span><strong>아침기도</strong><p>말과 생각, 일정과 만남을 주님께 맡깁니다.</p></a><a class="hub-card" href="meditation.html"><span>▣</span><strong>말씀 묵상</strong><p>말씀 요약과 삶에 적용할 문장을 제공합니다.</p></a><a class="hub-card" href="videos.html"><span>▶</span><strong>유튜브 영상 묵상</strong><p>롱폼 영상과 관련 기도 주제를 연결합니다.</p></a><a class="hub-card" href="prayer-cards.html"><span>◇</span><strong>말씀·기도 카드</strong><p>가족과 소그룹에 나눌 수 있는 자료입니다.</p></a><a class="hub-card" href="prayer-challenge.html"><span>30</span><strong>30일 기도 챌린지</strong><p>매일 한 편의 말씀과 기도로 마음을 회복합니다.</p></a><a class="hub-card" href="prayer-request.html"><span>♡</span><strong>기도 제목</strong><p>함께 기도할 제목을 조심스럽게 나눕니다.</p></a></div></section>
<section class="section split devotion-highlight"><div><p class="eyebrow">Today's Word</p><h2>오늘 붙드는 말씀</h2><blockquote>“평안을 너희에게 끼치노니 곧 나의 평안을 너희에게 주노라.”<cite>요한복음 14장 27절</cite></blockquote></div><div><h3>묵상과 기도</h3><p>주님이 주시는 평안은 상황이 모두 정리된 뒤에야 찾아오는 감정이 아니라, 흔들리는 마음 한가운데에서 주님의 임재를 붙드는 믿음입니다. 오늘 해야 할 일과 걱정되는 관계를 조용히 주님께 맡기며 마음의 중심이 말씀 위에 놓이도록 기도해보세요.</p><a class="text-link" href="meditation.html">자세히 읽기</a></div></section>
<!-- AdSense 광고 코드 삽입 위치: 본문 중간 광고 -->
<section class="section"><p class="eyebrow">Prayer Topics</p><h2>기도가 필요한 시간</h2><div class="topic-grid"><a href="prayers.html?q=불안">불안한 밤</a><a href="prayers.html?q=자녀">자녀를 위한 기도</a><a href="prayers.html?q=건강">건강 회복</a><a href="prayers.html?q=관계">관계의 상처</a><a href="prayers.html?q=재정">재정과 미래</a><a href="prayers.html?q=감사">감사의 기도</a><a href="prayers.html?q=용서">용서와 회복</a><a href="prayers.html?q=평안">잠들기 전 평안</a></div></section>
<section class="section"><p class="eyebrow">Featured Resources</p><h2>말씀·기도 자료 아카이브</h2><div class="feature-grid"><article><h3>말씀·기도 카드 이미지</h3><p>카카오톡, 가족 예배, 소그룹 나눔에 사용할 수 있는 카드형 자료의 방향과 구성 예시를 정리했습니다.</p><a class="text-link" href="prayer-cards.html">카드 자료 보기</a></article><article><h3>30일 기도 챌린지</h3><p>매일 한 편의 말씀과 기도문을 따라가며 불안, 감사, 관계, 수면, 회복의 주제를 차분히 다룹니다.</p><a class="text-link" href="prayer-challenge.html">30일 여정 보기</a></article><article><h3>프리미엄 기도문 PDF</h3><p>큰 글씨 인쇄용 PDF, 가정예배용 나눔 질문, 광고 없는 묵상 자료로 확장될 자료 안내입니다.</p><a class="text-link" href="premium-pdf.html">자료 안내 보기</a></article></div></section>
<section class="section search-panel"><p class="eyebrow">Prayer Search</p><h2>지금 마음에 필요한 기도문을 찾아보세요</h2><div class="search-box"><input id="homeSearch" type="search" placeholder="예: 불안, 자녀, 건강, 감사, 용서" aria-label="기도문 검색"><button class="button primary" type="button" data-search-go>검색하기</button></div></section>
<section class="section"><p class="eyebrow">YouTube Meditation</p><h2>영상으로 함께 듣는 기도</h2><div id="homeVideos" class="video-grid"></div></section>
"""

page("index.html", "기도의 샘물 | 기독교 기도문과 말씀 묵상", "기도의 샘물은 오늘의 기도문, 밤기도, 아침기도, 말씀 묵상, 신앙 자료를 제공하는 기독교 콘텐츠 사이트입니다.", "", home)

simple_pages = {
    "about.html": ("기도의 샘물 소개 | 기도의 샘물", "기도의 샘물 운영 목적, 콘텐츠 원칙, 유튜브 채널과 웹사이트의 연결 방향을 소개합니다.", "about.html", '<section class="page-hero"><p class="eyebrow">About</p><h1>기도의 샘물 소개</h1><p>기도와 말씀으로 지친 마음이 잠시 쉬어가도록 돕는 기독교 묵상 콘텐츠 공간입니다.</p></section><section class="article"><h2>왜 이 사이트를 만들었나요?</h2><p>기도의 샘물은 영상으로 듣는 기도와 함께, 글로 천천히 읽고 붙들 수 있는 기도문과 말씀 묵상 자료를 한곳에 모으기 위해 만들어졌습니다. 마음이 복잡한 밤, 하루를 시작하는 아침, 가족을 위해 기도하고 싶은 시간에 누구나 쉽게 찾아와 읽을 수 있는 신앙 자료실을 지향합니다.</p><h2>누구에게 도움이 되나요?</h2><p>큰 글씨와 명확한 구조가 필요한 40~70대 성도, 바쁜 하루 중 짧은 말씀을 붙들고 싶은 직장인, 가족과 함께 나눌 기도문을 찾는 분, 잠들기 전 조용한 기도 콘텐츠가 필요한 분을 위해 구성했습니다.</p><h2>운영 원칙</h2><p>기도문과 묵상은 과장된 약속이 아니라 말씀을 붙들고 주님께 마음을 드리는 방향으로 작성합니다. 광고와 수익화는 콘텐츠를 방해하지 않는 선에서 운영하며, 자료 판매가 연결되더라도 신앙생활에 실제로 도움이 되는 PDF와 카드 자료를 중심으로 확장합니다.</p></section>'),
    "prayers.html": ("오늘의 기도문 목록 | 기도의 샘물", "불안, 자녀, 건강, 관계, 감사, 용서 등 상황별 기독교 기도문을 큰 글씨로 읽을 수 있습니다.", "prayers.html", '<section class="page-hero"><p class="eyebrow">Prayer Archive</p><h1>오늘의 기도문 목록</h1><p>불안, 자녀, 건강, 관계, 감사, 용서처럼 마음의 형편에 맞는 기도문을 검색해 읽어보세요.</p></section><section class="section search-panel"><div class="search-box"><input id="prayerSearch" type="search" placeholder="예: 불안, 자녀, 건강, 감사, 용서" aria-label="기도문 검색"><button class="button primary" type="button" data-prayer-search>검색</button></div><p id="searchHelp" class="muted">검색어를 입력하면 제목, 태그, 관련 말씀을 기준으로 기도문을 찾아드립니다.</p></section><section class="section"><div id="prayerResults" class="content-grid"></div></section>'),
    "night-prayer.html": ("잠잘 때 듣는 밤기도 | 기도의 샘물", "하루의 염려를 내려놓고 평안한 쉼을 구하는 잠잘 때 듣는 밤기도 모음입니다.", "night-prayer.html", '<section class="page-hero"><p class="eyebrow">Night Prayer</p><h1>잠잘 때 듣는 밤기도</h1><p>하루를 주님께 맡기며 조용히 마음을 정돈하는 밤기도입니다.</p></section><section class="section"><div id="nightList" class="content-grid"></div></section><!-- AdSense 광고 코드 삽입 위치: 글 하단 광고 -->'),
    "morning-prayer.html": ("아침기도 | 기도의 샘물", "말과 생각, 일정과 만남을 주님께 맡기며 하루를 시작하는 아침기도 모음입니다.", "morning-prayer.html", '<section class="page-hero"><p class="eyebrow">Morning Prayer</p><h1>하루를 여는 아침기도</h1><p>새 하루를 감사와 믿음으로 시작하도록 돕는 아침기도입니다.</p></section><section class="section"><div id="morningList" class="content-grid"></div></section>'),
    "meditation.html": ("성경 말씀 묵상 | 기도의 샘물", "시편, 복음서, 서신서 말씀을 바탕으로 하루에 적용할 묵상과 기도 문장을 제공합니다.", "meditation.html", '<section class="page-hero"><p class="eyebrow">Bible Meditation</p><h1>성경 말씀 묵상</h1><p>오늘 붙들 말씀과 삶에 적용할 묵상 문장을 차분히 정리했습니다.</p></section><section class="section"><div id="meditationList" class="content-grid"></div></section>'),
    "videos.html": ("유튜브 영상 묵상 | 기도의 샘물", "기도의 샘물 유튜브 롱폼 영상과 관련 말씀, 상황별 추천 설명을 제공합니다.", "meditation.html", '<section class="page-hero"><p class="eyebrow">YouTube Meditation</p><h1>유튜브 영상 모음</h1><p>기도의 샘물 롱폼 영상과 관련 말씀, 듣기 좋은 상황을 함께 정리했습니다.</p></section><section class="section"><div id="videoList" class="video-grid"></div></section>'),
    "prayer-request.html": ("기도 제목 남기기 | 기도의 샘물", "기도의 샘물에서 함께 기도받고 싶은 제목을 남길 수 있는 공간입니다.", "prayer-request.html", '<section class="page-hero"><p class="eyebrow">Prayer Request</p><h1>기도 제목 남기기</h1><p>함께 기도받고 싶은 제목을 남겨주세요. 자세한 개인정보보다 기도 제목 중심으로 적어주세요.</p></section><section class="section narrow"><form id="prayerRequestForm" class="form-panel"><label>이름 또는 별칭<input name="name" required placeholder="예: 익명, 김집사"></label><label>기도 제목<textarea name="request" required rows="7" placeholder="함께 기도할 내용을 적어주세요."></textarea></label><label class="checkbox-label"><input type="checkbox" required><span>민감한 개인정보를 자세히 적지 않고, 함께 기도할 수 있는 내용만 남기겠습니다.</span></label><button class="button primary" type="submit">기도 제목 남기기</button><p class="form-message" role="status"></p></form></section>'),
    "contact.html": ("문의하기 | 기도의 샘물", "기도의 샘물 제휴, 자료, 콘텐츠 문의를 남길 수 있는 페이지입니다.", "contact.html", '<section class="page-hero"><p class="eyebrow">Contact</p><h1>문의하기</h1><p>제휴, 자료 문의, 콘텐츠 제안을 남겨주세요.</p></section><section class="section narrow"><form class="form-panel" action="https://formspree.io/f/xvzjywjr" method="POST"><input type="hidden" name="_subject" value="기도의 샘물 문의"><label>이름 또는 단체명<input name="name" required placeholder="이름 또는 단체명"></label><label>회신 이메일<input type="email" name="email" required placeholder="example@email.com"></label><label>문의 내용<textarea name="message" required rows="7" placeholder="문의 내용을 적어주세요."></textarea></label><button class="button primary" type="submit">문의 보내기</button><p class="muted">Formspree를 통해 전송됩니다. 민감한 개인정보는 입력하지 마세요.</p></form></section>'),
}

for file, (title, desc, active, body) in simple_pages.items():
    page(file, title, desc, active, body)

cards = '<section class="page-hero"><p class="eyebrow">Prayer Cards</p><h1>마음에 남는 말씀을 한 장의 카드로</h1><p>매일의 기도와 묵상을 이미지에 담아 가족과 소그룹에 나눌 수 있는 말씀·기도 카드 자료를 소개합니다.</p><div class="hero-actions"><a class="button primary" href="#cardPreview">카드 구성 보기</a><a class="button secondary" href="contact.html">자료 소식 받기</a></div></section><section class="section"><p class="eyebrow">Use Cases</p><h2>어디에 사용할 수 있나요?</h2><div id="prayerCardList" class="content-grid"></div></section><section id="cardPreview" class="section"><p class="eyebrow">Preview</p><h2>카드 디자인 미리보기</h2><div class="card-preview-grid"><div class="share-card navy"><span>평안</span><strong>주님께 마음을 맡깁니다</strong><p>염려가 나를 끌고 가지 않도록 오늘의 생각을 말씀 앞에 내려놓습니다.</p></div><div class="share-card ivory"><span>감사</span><strong>작은 은혜를 다시 봅니다</strong><p>평범한 하루 속에 숨은 주님의 손길을 기억하며 마음을 새롭게 합니다.</p></div><div class="share-card sage"><span>회복</span><strong>상처 위에 은혜를 구합니다</strong><p>관계의 아픔을 주님께 맡기고 지혜로운 말과 침묵을 배우게 하소서.</p></div></div></section><!-- 향후 결제 완료 후 이미지 다운로드 버튼 삽입 위치 -->'
page("prayer-cards.html", "말씀·기도 카드 이미지 | 기도의 샘물", "기도의 샘물 말씀 카드, 기도 카드, 자녀 축복 카드, 수면기도 카드 자료를 소개합니다.", "prayer-cards.html", cards)

challenge = '<section class="page-hero"><p class="eyebrow">30 Day Prayer Challenge</p><h1>30일 동안 말씀과 기도로 마음을 다시 세우는 시간</h1><p>하루 한 편의 말씀 묵상과 기도문을 따라가며 불안한 마음을 내려놓고 하나님 앞에서 평안을 회복하도록 돕는 기도 여정입니다.</p><div class="hero-actions"><a class="button primary" href="#dayGrid">1일차 기도문 읽기</a><a class="button secondary" href="#challengeTypes">전체 구성 살펴보기</a></div></section><section id="challengeTypes" class="section"><p class="eyebrow">Programs</p><h2>기도 챌린지 유형</h2><div class="feature-grid"><article><h3>30일 평안 회복</h3><p>불안과 염려가 많은 마음을 말씀으로 천천히 정돈합니다.</p></article><article><h3>30일 자녀 축복</h3><p>자녀의 믿음, 관계, 선택, 미래를 주님께 맡기는 기도입니다.</p></article><article><h3>30일 감사 회복</h3><p>작은 은혜를 다시 발견하며 하루의 시선을 바꾸는 여정입니다.</p></article></div></section><section id="dayGrid" class="section"><p class="eyebrow">Daily Plan</p><h2>30일 기도 일정</h2><div id="challengeList" class="day-grid"></div></section><!-- 향후 토스페이먼츠/포트원 결제 버튼 삽입 위치 -->'
page("prayer-challenge.html", "30일 기도 챌린지 | 기도의 샘물", "기도의 샘물 30일 기도 챌린지는 매일 말씀 묵상과 기도문을 통해 불안, 자녀, 감사, 관계, 수면, 회복을 위해 기도하도록 돕는 기독교 묵상 프로그램입니다.", "prayer-cards.html", challenge)

premium = '<section class="page-hero"><p class="eyebrow">Premium PDF</p><h1>프리미엄 기도문 PDF 안내</h1><p>큰 글씨로 읽기 편한 월별 기도문, 말씀 묵상, 가정예배 나눔 질문을 정리한 자료 안내입니다.</p></section><section class="section product-panel"><div><h2>월별 기도문 PDF 패키지</h2><p>아침기도, 밤기도, 자녀를 위한 기도, 건강 회복, 관계 회복, 감사 묵상을 주제별로 정리합니다. 인쇄해서 가족과 함께 읽거나 개인 묵상 노트처럼 사용할 수 있습니다.</p><ul class="check-list"><li>큰 글씨와 넉넉한 줄간격</li><li>A4 인쇄에 맞춘 구성</li><li>성경구절 기반 묵상 질문</li><li>가정예배와 소그룹 나눔 활용</li></ul></div><div class="price-card"><strong>자료 안내 받기</strong><p>자료 구성과 배포 소식을 이메일로 안내받을 수 있습니다.</p><a class="button primary" href="contact.html">자료 소식 받기</a></div></section><!-- 향후 토스페이먼츠/포트원 결제 버튼 삽입 위치 -->'
page("premium-pdf.html", "프리미엄 기도문 PDF | 기도의 샘물", "기도의 샘물 프리미엄 기도문 PDF는 큰 글씨 인쇄용 기도문과 말씀 묵상 자료를 안내합니다.", "prayer-cards.html", premium)

legal = {
    "privacy.html": ("개인정보처리방침 | 기도의 샘물", "기도의 샘물 개인정보 수집 항목, 쿠키와 광고, 외부 링크, 이용자 권리를 안내합니다.", "privacy.html", "개인정보처리방침", "문의하기와 기도 제목 양식을 사용할 때 이름 또는 별칭, 이메일, 문의 내용이 제출될 수 있습니다. 본 사이트는 Google AdSense 등 광고 서비스를 사용할 수 있으며, 외부 서비스의 정책은 각 서비스 기준을 따릅니다."),
    "terms.html": ("이용약관 | 기도의 샘물", "기도의 샘물 사이트 이용 목적, 저작권, 외부 링크, 광고와 제휴 기준을 안내합니다.", "terms.html", "이용약관", "본 사이트는 기독교 기도문, 말씀 묵상, 영상 안내, 신앙 자료 정보를 제공하기 위한 공간입니다. 사이트의 글, 구성, 디자인 요소는 무단 복제와 재배포를 허용하지 않습니다."),
    "disclaimer.html": ("콘텐츠 안내 및 면책 고지 | 기도의 샘물", "기도의 샘물 기도문과 말씀 묵상 콘텐츠의 신앙적 목적과 면책 기준을 안내합니다.", "disclaimer.html", "콘텐츠 안내 및 면책 고지", "본 사이트의 기도문과 묵상문은 신앙적 위로와 묵상을 돕기 위한 콘텐츠입니다. 의료, 법률, 재정, 심리 상담을 대체하지 않으며 위기 상황에서는 가까운 목회자, 가족, 전문 기관의 도움을 함께 받으시기 바랍니다."),
}
for file, (title, desc, active, h1, text) in legal.items():
    page(file, title, desc, active, f'<section class="page-hero"><p class="eyebrow">Guide</p><h1>{h1}</h1><p>{desc}</p></section><section class="article"><p>{text}</p><h2>문의</h2><p>관련 문의는 문의하기 페이지를 통해 남겨주세요.</p></section>')

page("prayer-detail.html", "기도문 상세 | 기도의 샘물", "기도문을 읽고 묵상하는 방법과 기도문 목록으로 이동하는 안내입니다.", "prayers.html", '<section class="page-hero"><p class="eyebrow">Prayer Detail</p><h1>기도문 상세 안내</h1><p>기도문 목록에서 마음에 맞는 제목을 선택해 관련 말씀과 기도문을 읽어보세요.</p></section><section class="article"><h2>기도문을 읽는 방법</h2><p>기도문은 정답처럼 외우는 문장이 아니라, 마음을 주님께 향하게 돕는 길잡이입니다. 한 문장씩 천천히 읽고, 내 상황에 맞게 말을 바꾸어 기도해도 좋습니다.</p><a class="button primary" href="prayers.html">기도문 목록으로 이동</a></section>')
page("adsense-checklist.html", "애드센스 사전 점검표 | 기도의 샘물", "기도의 샘물 사이트의 애드센스 정책 친화성, 콘텐츠 품질, 링크, 광고 배치를 점검하는 페이지입니다.", "", '<section class="page-hero"><p class="eyebrow">AdSense Review</p><h1>애드센스 사전 점검표</h1><p>정책 친화적인 콘텐츠 사이트 운영을 위한 자체 점검 항목입니다.</p></section><section class="article"><ul class="check-list"><li>모든 주요 메뉴가 정상 작동한다.</li><li>비어 있는 페이지와 미완성 표현을 화면에 노출하지 않는다.</li><li>기도문, 묵상, 영상 소개, 신앙 자료 페이지에 충분한 본문이 있다.</li><li>개인정보처리방침, 이용약관, 문의하기, 소개 페이지가 있다.</li><li>광고 위치가 콘텐츠 읽기를 방해하지 않는다.</li><li>광고 클릭을 유도하는 문구가 없다.</li><li>모바일에서 글자와 버튼이 읽기 쉽다.</li><li>sitemap.xml, robots.txt, 404.html, ads.txt가 있다.</li></ul></section>')
page("404.html", "페이지를 찾을 수 없습니다 | 기도의 샘물", "기도의 샘물 404 안내 페이지입니다.", "", '<section class="page-hero"><p class="eyebrow">404</p><h1>페이지를 찾을 수 없습니다</h1><p>주소가 변경되었거나 존재하지 않는 페이지입니다.</p><div class="hero-actions"><a class="button primary" href="index.html">홈으로 이동</a><a class="button secondary" href="prayers.html">기도문 보기</a></div></section>')

urls = ["", "about.html", "prayers.html", "prayer-detail.html", "night-prayer.html", "morning-prayer.html", "meditation.html", "videos.html", "prayer-cards.html", "prayer-challenge.html", "prayer-request.html", "premium-pdf.html", "contact.html", "privacy.html", "terms.html", "disclaimer.html", "adsense-checklist.html"]
w("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(f"  <url><loc>{SITE + '/' + u if u else SITE + '/'}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>" for u in urls) + "\n</urlset>")
w("robots.txt", f"User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml")
w("ads.txt", "google.com, pub-9363769983329867, DIRECT, f08c47fec0942fa0")
