import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const youtubeChannel = "https://youtube.com/channel/UCFrsilNKJ8xcmn0RUrFz6XQ?si=hM09ebhKwa9m_3W0";

const pageGroups = {
  bible: new Set(["prayers.html", "meditation.html", "archive.html", "prayer-detail.html"]),
  prayer: new Set(["morning-prayer.html", "night-prayer.html"]),
  community: new Set(["community.html", "prayer-request.html"]),
  youtube: new Set(["videos.html"]),
  resources: new Set(["prayer-cards.html", "premium-pdf.html", "prayer-challenge.html", "admin-faith-resources.html"])
};

function activeAttr(page, targets) {
  return targets.includes(page) ? ' class="active" aria-current="page"' : "";
}

function groupClass(page, group) {
  return pageGroups[group].has(page) ? " active" : "";
}

function header(page) {
  return `<header class="site-header" data-site-header>
  <a class="brand" href="index.html" aria-label="기도의샘물 홈으로 이동">
    <img src="assets/logo-sam.png" alt="기도의샘물 로고" width="44" height="44">
    <span><strong>기도의샘물</strong><small>기도와 말씀으로 쉬어가는 곳</small></span>
  </a>
  <div class="site-header-utility" aria-label="보조 메뉴">
    <a${activeAttr(page, ["about.html"])} href="about.html">소개</a>
    <a${activeAttr(page, ["contact.html"])} href="contact.html">문의하기</a>
    <a href="index.html#homeSearchSection" aria-label="통합 검색으로 이동">검색</a>
  </div>
  <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span></span><span></span><span></span><span class="sr-only">전체 메뉴 열기</span></button>
  <nav id="site-nav" class="site-nav" aria-label="주요 메뉴" data-site-nav-v2>
    <div class="site-nav-main">
      <details class="site-nav-section" data-nav-section="bible">
        <summary class="site-nav-summary${groupClass(page, "bible")}">성경말씀<span aria-hidden="true">⌄</span></summary>
        <div class="site-nav-panel">
          <a${activeAttr(page, ["meditation.html"])} href="meditation.html"><strong>오늘의 큐티(QT)</strong><span>성경과 오늘의 삶을 잇는 묵상</span></a>
          <a${activeAttr(page, ["prayers.html"])} href="prayers.html"><strong>말씀 붙들기</strong><span>현실의 상황에서 붙드는 말씀과 기도</span></a>
        </div>
      </details>
      <details class="site-nav-section" data-nav-section="prayer">
        <summary class="site-nav-summary${groupClass(page, "prayer")}">기도<span aria-hidden="true">⌄</span></summary>
        <div class="site-nav-panel">
          <a href="prayers.html?category=감사"><strong>감사기도</strong><span>어떤 상황에서도 감사를 회복하는 기도</span></a>
          <a${activeAttr(page, ["night-prayer.html"])} href="night-prayer.html"><strong>저녁기도</strong><span>하루를 내려놓고 평안을 구하는 기도</span></a>
          <a${activeAttr(page, ["morning-prayer.html"])} href="morning-prayer.html"><strong>아침기도</strong><span>새 하루를 말씀과 감사로 여는 기도</span></a>
        </div>
      </details>
      <a class="site-nav-direct${groupClass(page, "community")}"${activeAttr(page, ["community.html", "prayer-request.html"])} href="community.html">나눔게시판</a>
      <details class="site-nav-section" data-nav-section="youtube">
        <summary class="site-nav-summary${groupClass(page, "youtube")}">유튜브<span aria-hidden="true">⌄</span></summary>
        <div class="site-nav-panel">
          <a${activeAttr(page, ["videos.html"])} href="videos.html?tab=videos"><strong>영상</strong><span>기도와 말씀 영상을 바로 듣기</span></a>
          <a href="videos.html?tab=posts"><strong>채널 소식</strong><span>기도의샘물 채널의 새 이야기</span></a>
        </div>
      </details>
      <details class="site-nav-section" data-nav-section="resources">
        <summary class="site-nav-summary${groupClass(page, "resources")}">신앙자료<span aria-hidden="true">⌄</span></summary>
        <div class="site-nav-panel">
          <a href="prayer-cards.html?type=pdf"><strong>기도문 PDF</strong><span>천천히 읽고 보관하는 기도문</span></a>
          <a href="prayer-cards.html?type=audio"><strong>기도 오디오북</strong><span>이동 중과 잠들기 전에 듣는 기도</span></a>
          <a href="prayer-cards.html?type=card"><strong>기도카드</strong><span>저장하고 나누는 말씀·기도카드</span></a>
        </div>
      </details>
    </div>
    <div class="site-nav-mobile-utility">
      <a${activeAttr(page, ["about.html"])} href="about.html">소개</a>
      <a${activeAttr(page, ["contact.html"])} href="contact.html">문의하기</a>
      <a href="index.html#homeSearchSection">통합 검색</a>
    </div>
  </nav>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="footer-brand"><strong>기도의샘물</strong><p>말씀과 기도로 마음이 잠시 쉬어가는 신앙 콘텐츠 공간입니다.</p><a class="text-link" href="${youtubeChannel}" target="_blank" rel="noopener">유튜브 채널 보기</a></div>
  <div class="footer-group"><strong>말씀과 기도</strong><a href="meditation.html">오늘의 큐티(QT)</a><a href="prayers.html">말씀 붙들기</a><a href="morning-prayer.html">아침기도</a><a href="night-prayer.html">저녁기도</a></div>
  <div class="footer-group"><strong>함께 둘러보기</strong><a href="community.html">나눔게시판</a><a href="videos.html">유튜브</a><a href="prayer-cards.html">신앙자료</a><a href="contact.html">문의하기</a></div>
  <div class="footer-group"><strong>운영과 정책</strong><a href="about.html">소개</a><a href="privacy.html">개인정보처리방침</a><a href="terms.html">이용약관</a><a href="disclaimer.html">콘텐츠 안내</a><a href="sitemap.xml">사이트맵</a></div>
</footer>`;
}

const entries = await readdir(root, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
  const path = resolve(root, entry.name);
  let html = await readFile(path, "utf8");
  if (!html.includes('<header class="site-header">') && !html.includes('data-site-header')) continue;

  html = html.replace(/<header class="site-header"[\s\S]*?<\/header>/, header(entry.name));
  html = html.replace(/<footer class="site-footer"[\s\S]*?<\/footer>/, footer());
  if (!html.includes("editorial-redesign.css")) {
    html = html.replace(/(<link rel="stylesheet" href="assets\/css\/style\.css(?:\?[^\"]*)?">)/, '$1\n  <link rel="stylesheet" href="assets/css/editorial-redesign.css">');
  }
  html = html.replace(/src="data\/(prayers|meditations|prayerCards|prayerChallenge)\.js(?:\?[^\"]*)?"/g, 'src="data/$1.js?v=20260710-ia"');
  html = html.replace(/src="assets\/js\/script\.js(?:\?[^\"]*)?"/g, 'src="assets/js/script.js?v=20260710-ia"');
  html = html.replace(/<body(?![^>]*data-site-page)([^>]*)>/, `<body data-site-page="${basename(entry.name, ".html")}"$1>`);
  await writeFile(path, html, "utf8");
}
