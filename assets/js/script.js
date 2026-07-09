const $ = (selector) => document.querySelector(selector);

const toggle = $(".menu-toggle");
const nav = $("#site-nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function prayerCard(item) {
  return `<article class="stack-card prayer-stack-card">
    <p class="eyebrow">${escapeHtml(item.category || "Prayer")}</p>
    <h3>${escapeHtml(item.title)}</h3>
    <p class="stack-summary">${escapeHtml(item.summary || "")}</p>
    ${item.scripture ? `<blockquote>${escapeHtml(item.scripture)}</blockquote>` : ""}
    ${item.body ? `<p class="stack-body">${escapeHtml(item.body)}</p>` : ""}
  </article>`;
}

function meditationCard(item) {
  return `<article class="stack-card meditation-stack-card">
    <p class="eyebrow">${escapeHtml(item.scripture || "Bible Meditation")}</p>
    <h3>${escapeHtml(item.title)}</h3>
    <p class="stack-summary">${escapeHtml(item.summary || "")}</p>
    ${item.scripture ? `<blockquote>${escapeHtml(item.scripture)}</blockquote>` : ""}
    ${item.body ? `<p class="stack-body">${escapeHtml(item.body)}</p>` : ""}
  </article>`;
}

function prayerImageCard(item) {
  return `<article class="stack-card visual-stack-card">
    <span class="visual-label">${escapeHtml(item.label || item.category)}</span>
    <h3>${escapeHtml(item.title)}</h3>
    <blockquote>${escapeHtml(item.scripture)}</blockquote>
    <p>${escapeHtml(item.description)}</p>
    <small>${escapeHtml(item.useCase)}</small>
  </article>`;
}

function renderCarousel(root, items, renderer, label) {
  if (!root) return;
  root.className = "card-carousel";
  root.setAttribute("data-carousel", "");
  root.setAttribute("tabindex", "0");
  root.setAttribute("aria-label", `${label} 좌우 카드`);
  root.innerHTML = `<button class="carousel-control prev" type="button" aria-label="이전 ${label}">‹</button>
    <div class="card-stack" aria-live="polite">${items.map(renderer).join("")}</div>
    <button class="carousel-control next" type="button" aria-label="다음 ${label}">›</button>
    <p class="carousel-status" aria-hidden="true"><span data-current>1</span> / ${items.length}</p>`;
  initCarousel(root);
}

function initCarousel(root) {
  const cards = [...root.querySelectorAll(".stack-card")];
  if (!cards.length) return;
  const current = root.querySelector("[data-current]");
  let index = 0;
  let startX = 0;

  function paint() {
    cards.forEach((card, i) => {
      const offset = (i - index + cards.length) % cards.length;
      card.classList.remove("is-active", "is-prev", "is-next", "is-hidden");
      card.setAttribute("aria-hidden", "true");
      if (i === index) {
        card.classList.add("is-active");
        card.removeAttribute("aria-hidden");
      } else if (offset === 1) {
        card.classList.add("is-next");
      } else if (offset === cards.length - 1) {
        card.classList.add("is-prev");
      } else {
        card.classList.add("is-hidden");
      }
    });
    if (current) current.textContent = String(index + 1);
  }

  function move(delta) {
    index = (index + delta + cards.length) % cards.length;
    paint();
  }

  root.querySelector(".prev")?.addEventListener("click", () => move(-1));
  root.querySelector(".next")?.addEventListener("click", () => move(1));
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });
  root.addEventListener("touchstart", (event) => {
    startX = event.touches[0].clientX;
  }, { passive: true });
  root.addEventListener("touchend", (event) => {
    const deltaX = event.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) > 44) move(deltaX > 0 ? -1 : 1);
  }, { passive: true });

  paint();
}

function renderPrayers(list = PRAYERS) {
  const root = $("#prayerResults");
  if (!root) return;
  renderCarousel(root, list, prayerCard, "기도문");
}

function searchPrayers() {
  const input = $("#prayerSearch");
  if (!input) return;
  const q = input.value.trim().toLowerCase();
  const list = q
    ? PRAYERS.filter((p) => [p.title, p.category, p.scripture, ...(p.tags || [])].join(" ").toLowerCase().includes(q))
    : PRAYERS;
  renderPrayers(list);
  const help = $("#searchHelp");
  if (help) help.textContent = list.length ? `${list.length}개의 기도문을 찾았습니다. 좌우 버튼으로 넘겨 읽어보세요.` : "가까운 주제의 기도문을 다시 검색해 주세요.";
}

if ($("#prayerResults")) {
  const params = new URLSearchParams(location.search);
  const q = params.get("q");
  if (q && $("#prayerSearch")) $("#prayerSearch").value = q;
  searchPrayers();
}

$("[data-prayer-search]")?.addEventListener("click", searchPrayers);
$("#prayerSearch")?.addEventListener("input", searchPrayers);
$("[data-search-go]")?.addEventListener("click", () => {
  const q = $("#homeSearch")?.value.trim();
  location.href = q ? `prayers.html?q=${encodeURIComponent(q)}` : "prayers.html";
});

function renderList(id, list) {
  const root = document.getElementById(id);
  if (root) renderCarousel(root, list, prayerCard, "기도문");
}

renderList("nightList", PRAYERS.filter((p) => p.tags?.includes("밤") || p.tags?.includes("수면") || p.category === "수면").concat(PRAYERS.slice(0, 3)));
renderList("morningList", PRAYERS.filter((p) => p.category === "아침").concat(PRAYERS.slice(0, 3)));

if ($("#meditationList")) {
  renderCarousel($("#meditationList"), MEDITATIONS, meditationCard, "말씀 묵상");
}

function videoCard(v) {
  return `<article class="video-card">
    <a class="video-thumb" href="${v.url}" target="_blank" rel="noopener" aria-label="${escapeHtml(v.title)} 영상 보기">
      <img src="${v.thumbnail}" alt="${escapeHtml(v.title)} 썸네일" loading="lazy">
      <span class="play-mark" aria-hidden="true">▶</span>
    </a>
    <p class="eyebrow">${escapeHtml(v.theme)}</p>
    <h3>${escapeHtml(v.title)}</h3>
    <p><strong>관련 말씀:</strong> ${escapeHtml(v.scripture)}</p>
    <p>${escapeHtml(v.description)}</p>
    <a class="button secondary" href="${v.url}" target="_blank" rel="noopener">유튜브에서 보기</a>
  </article>`;
}

const videoData = window.VIDEOS || (typeof VIDEOS !== "undefined" ? VIDEOS : []);
const videoList = $("#videoList");
if (videoList) videoList.innerHTML = videoData.map(videoCard).join("");
const homeVideos = $("#homeVideos");
if (homeVideos) homeVideos.innerHTML = videoData.slice(0, 3).map(videoCard).join("");

function pdfProductCard(product) {
  const purchaseHref = product.purchaseUrl || "contact.html";
  const purchaseLabel = product.purchaseUrl ? "자료 신청하기" : "자료 문의하기";
  const badge = product.isFeatured ? '<span class="product-badge">대표 상품</span>' : "";
  return `<article class="pdf-product-card${product.isFeatured ? " featured" : ""}">
    <div class="product-card-top">
      <p class="eyebrow">${escapeHtml(product.category)}</p>
      ${badge}
    </div>
    <h3>${escapeHtml(product.title)}</h3>
    <p class="product-audience">${escapeHtml(product.audience)}</p>
    <ul class="compact-list">${product.composition.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <div class="product-price">${escapeHtml(product.priceRange)}</div>
    <div class="product-actions">
      <a class="button secondary" href="${product.sampleUrl}">미리보기 문의</a>
      <a class="button primary" href="${purchaseHref}">${purchaseLabel}</a>
    </div>
  </article>`;
}

const pdfProductGrid = $("#pdfProductGrid");
if (pdfProductGrid && typeof PDF_PRODUCTS !== "undefined") {
  pdfProductGrid.innerHTML = PDF_PRODUCTS.map(pdfProductCard).join("");
}

const prayerCardList = $("#prayerCardList");
if (prayerCardList) {
  renderCarousel(prayerCardList, PRAYER_CARDS, prayerImageCard, "말씀 카드");
}

const visualPrayerCards = $("#visualPrayerCards");
if (visualPrayerCards) {
  renderCarousel(visualPrayerCards, PRAYER_CARDS.slice(0, 6), prayerImageCard, "카드 미리보기");
}

const challengeList = $("#challengeList");
if (challengeList) {
  challengeList.innerHTML = PRAYER_CHALLENGE.map((d) => `<article class="day-card">
    <p class="eyebrow">Day ${d.day}</p>
    <strong>${escapeHtml(d.title)}</strong>
    <p>${escapeHtml(d.scripture)}</p>
    <p>${escapeHtml(d.summary)}</p>
    <a class="text-link" href="${d.detailUrl}">읽기</a>
  </article>`).join("");
}

const prayerForm = $("#prayerRequestForm");
if (prayerForm) {
  prayerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    prayerForm.querySelector(".form-message").textContent = "기도 제목을 확인했습니다. 함께 기도하는 마음으로 소중히 받겠습니다.";
    prayerForm.reset();
  });
}

(() => {
  const dailyWords = Array.isArray(window.DAILY_WORDS) ? window.DAILY_WORDS : [];
  const categories = Array.isArray(window.PRAYER_CATEGORIES) ? window.PRAYER_CATEGORIES : [];
  if (!dailyWords.length) return;

  const categoryOrder = ["word", "morning", "night", "video", "resource"];
  const legacyCategoryMap = {
    night: { id: "evening", label: "저녁기도", pageUrl: "night-prayer.html", icon: "moon", description: "하루를 내려놓고 잠들기 전 평안을 구하는 기도입니다.", colorKey: "evening" },
    video: { id: "video", label: "영상묵상", pageUrl: "videos.html", icon: "play", description: "기도의샘물 유튜브 채널의 말씀과 기도 영상입니다.", colorKey: "video" }
  };
  const iconPaths = {
    bible: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22z"></path><path d="M5 4.5v17M9 7h6M9 11h5"></path>',
    sun: '<path d="M12 4v3M12 17v3M4 12h3M17 12h3"></path><circle cx="12" cy="12" r="4"></circle><path d="m6.5 6.5 2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2"></path>',
    moon: '<path d="M20 15.5A7.5 7.5 0 0 1 8.5 4 8 8 0 1 0 20 15.5z"></path>',
    play: '<circle cx="12" cy="12" r="9"></circle><path d="m10 8 6 4-6 4z"></path>',
    card: '<rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M8 8h8M8 12h5M9 16h6"></path>',
    heart: '<path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21l8.8-8a5.2 5.2 0 0 0 0-7.4z"></path>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 6 8-6"></path>',
    archive: '<path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z"></path>',
    tag: '<path d="M20 13 13 20 4 11V4h7l9 9z"></path><circle cx="8.5" cy="8.5" r="1.5"></circle>',
    light: '<path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-.8.7-1.2 1.5-1.3 2.5H9.3C9.2 15.5 8.8 14.7 8 14z"></path>'
  };

  function icon(name, className = "icon") {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.light}</svg>`;
  }

  function text(value = "") {
    if (typeof escapeHtml === "function") return escapeHtml(value);
    return String(value).replace(/[&<>"']/g, (match) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[match]));
  }

  function seoulDate() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }

  function sorted(items = dailyWords) {
    return [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function pickLatest(items = dailyWords) {
    return sorted(items)[0];
  }

  function pickForDate(items, date) {
    return items.find((item) => item.date === date) || pickLatest(items);
  }

  function categoryMeta(id) {
    return categories.find((item) => item.id === id) || legacyCategoryMap[id] || { id, label: id, pageUrl: "#", icon: "light", description: "" };
  }

  function tagsHtml(tags = []) {
    return `<div class="tag-row">${tags.map((tag) => `<span>${icon("tag", "icon-sm")}${text(tag)}</span>`).join("")}</div>`;
  }

  function wordSummary(item) {
    const value = item.meditation || "";
    return text(value.length > 92 ? `${value.slice(0, 92)}...` : value);
  }

  function renderToday() {
    const root = document.getElementById("todayWordCard");
    if (!root) return;
    const item = pickForDate(dailyWords, seoulDate());
    root.innerHTML = `<div class="today-word-main">
      <div class="today-word-meta"><span>${icon("light", "icon-sm")} ${text(item.date)}</span><span>${text(item.categoryLabel)}</span></div>
      <h3>${text(item.title)}</h3>
      <blockquote><strong>${text(item.scriptureRef)}</strong><br>${text(item.scriptureText)}</blockquote>
      <p>${text(item.meditation)}</p>
      <div class="prayer-line">${text(item.prayerLine)}</div>
      ${tagsHtml(item.tags)}
      <div class="hero-actions"><a class="button primary" href="${text(item.detailUrl)}">오늘의 기도문 읽기</a><a class="button secondary" href="archive.html">지난 말씀 보기</a></div>
    </div>`;
  }

  function renderCategoryPreview() {
    const root = document.getElementById("categoryPreviewGrid");
    if (!root) return;
    root.innerHTML = categoryOrder.map((id) => {
      const meta = categoryMeta(id);
      const item = pickForDate(dailyWords.filter((word) => word.category === id), seoulDate());
      if (!item) return "";
      return `<article class="daily-preview-card theme-${text(meta.colorKey || id)}">
        <div class="daily-card-top"><span class="category-icon">${icon(meta.icon)}</span><span class="category-label">${text(meta.label)}</span></div>
        <h3>${text(item.title)}</h3><p class="scripture-ref">${text(item.scriptureRef)}</p><p>${wordSummary(item)}</p>${tagsHtml(item.tags)}
        <a class="button secondary" href="${text(meta.pageUrl)}" aria-label="${text(meta.label)} 페이지로 이동">${text(meta.label)} 보기</a>
      </article>`;
    }).join("");
  }

  function renderVisualHub() {
    const root = document.getElementById("categoryVisualGrid");
    if (!root) return;
    root.innerHTML = categories.map((meta) => `<a class="visual-hub-card visual-${text(meta.imageTheme)}" href="${text(meta.pageUrl)}"><span class="category-icon">${icon(meta.icon)}</span><strong>${text(meta.label)}</strong><p>${text(meta.description)}</p></a>`).join("");
  }

  function archiveCard(item) {
    return `<article class="archive-word-card"><div class="archive-card-meta"><span>${text(item.date)}</span><span>${text(item.categoryLabel)}</span></div><h3>${text(item.title)}</h3><p class="scripture-ref">${text(item.scriptureRef)}</p><p>${wordSummary(item)}</p>${tagsHtml(item.tags)}<a class="text-link" href="${text(item.detailUrl)}">자세히 보기</a></article>`;
  }

  function renderFilterButtons(rootId, active, onSelect) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const filters = [{ id: "all", label: "전체", icon: "archive" }, ...categoryOrder.map(categoryMeta)];
    root.innerHTML = filters.map((item) => `<button class="filter-chip${active === item.id ? " active" : ""}" type="button" data-filter="${text(item.id)}" aria-label="${text(item.label)} 필터">${icon(item.icon || "archive", "icon-sm")}${text(item.label)}</button>`).join("");
    root.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => onSelect(button.dataset.filter || "all")));
  }

  function renderRecent(active = "all") {
    const root = document.getElementById("recentWordsPreview");
    if (!root) return;
    const items = sorted(active === "all" ? dailyWords : dailyWords.filter((item) => item.category === active)).slice(0, 7);
    root.innerHTML = items.map(archiveCard).join("");
  }

  function searchItems(query, category = "all") {
    const normalized = query.trim().toLowerCase();
    return sorted(dailyWords).filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!normalized) return true;
      return [item.title, item.scriptureRef, item.scriptureText, item.meditation, item.prayerLine, ...(item.tags || [])].join(" ").toLowerCase().includes(normalized);
    });
  }

  function emptySearchMessage() {
    const recommended = categoryOrder.slice(0, 3).map(categoryMeta);
    return `<div class="soft-empty-state"><h3>가까운 주제를 다시 골라보세요</h3><p>입력한 단어와 꼭 맞는 묵상은 없지만, 아래 주제에서 오늘 마음에 필요한 말씀을 찾아볼 수 있습니다.</p><div class="filter-row">${recommended.map((item) => `<a class="filter-chip" href="${text(item.pageUrl)}">${icon(item.icon, "icon-sm")}${text(item.label)}</a>`).join("")}</div></div>`;
  }

  function renderHomeSearch(query = "") {
    const root = document.getElementById("homeSearchResults");
    if (!root) return;
    const items = query ? searchItems(query).slice(0, 8) : sorted(dailyWords).slice(0, 4);
    root.innerHTML = items.length ? items.map(archiveCard).join("") : emptySearchMessage();
  }

  function renderArchivePage(query = "", category = "all") {
    const root = document.getElementById("archiveResults");
    if (!root) return;
    const items = searchItems(query, category);
    root.innerHTML = items.length ? items.map(archiveCard).join("") : emptySearchMessage();
  }

  function decorateNavIcons() {
    document.querySelectorAll(".site-nav a").forEach((link) => {
      if (link.querySelector("svg")) return;
      const href = link.getAttribute("href") || "";
      const label = link.textContent.trim();
      let iconName = "light";
      if (href.includes("prayers") || href.includes("meditation")) iconName = "bible";
      if (label.includes("영상묵상")) iconName = "play";
      if (href.includes("morning")) iconName = "sun";
      if (href.includes("night")) iconName = "moon";
      if (href.includes("videos")) iconName = "play";
      if (href.includes("prayer-cards") || href.includes("challenge") || href.includes("premium")) iconName = "card";
      if (href.includes("prayer-request")) iconName = "heart";
      if (href.includes("contact")) iconName = "mail";
      link.insertAdjacentHTML("afterbegin", icon(iconName, "nav-icon"));
    });
  }

  let homeFilter = "all";
  function updateHomeFilter(next = homeFilter) {
    homeFilter = next;
    renderFilterButtons("homeArchiveFilters", homeFilter, updateHomeFilter);
    renderRecent(homeFilter);
  }

  let archiveFilter = "all";
  const archiveInput = document.getElementById("archiveSearch");
  function updateArchive(next = archiveFilter) {
    archiveFilter = next;
    renderFilterButtons("archiveFilters", archiveFilter, updateArchive);
    renderArchivePage(archiveInput?.value || "", archiveFilter);
  }

  renderToday();
  renderCategoryPreview();
  renderVisualHub();
  updateHomeFilter("all");
  renderHomeSearch();
  decorateNavIcons();

  const homeForm = document.getElementById("homeDailySearchForm");
  const homeInput = document.getElementById("homeDailySearch");
  homeForm?.addEventListener("submit", (event) => { event.preventDefault(); renderHomeSearch(homeInput?.value || ""); });
  homeInput?.addEventListener("input", () => renderHomeSearch(homeInput.value));

  if (document.getElementById("archiveResults")) {
    updateArchive("all");
    document.getElementById("archiveSearchForm")?.addEventListener("submit", (event) => { event.preventDefault(); renderArchivePage(archiveInput?.value || "", archiveFilter); });
    archiveInput?.addEventListener("input", () => renderArchivePage(archiveInput.value, archiveFilter));
  }
})();

(() => {
  const dailyContents = Array.isArray(window.DAILY_CONTENTS) ? window.DAILY_CONTENTS : [];
  if (!dailyContents.length) return;

  const iconPaths = {
    bible: '<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22z"></path><path d="M5 4.5v17M9 7h6M9 11h5"></path>',
    moon: '<path d="M20 15.5A7.5 7.5 0 0 1 8.5 4 8 8 0 1 0 20 15.5z"></path>',
    sun: '<path d="M12 4v3M12 17v3M4 12h3M17 12h3"></path><circle cx="12" cy="12" r="4"></circle><path d="m6.5 6.5 2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2"></path>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"></path><path d="M4 5.5v16M8 7h8M8 11h6"></path>',
    calendar: '<path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z"></path>',
    tag: '<path d="M20 13 13 20 4 11V4h7l9 9z"></path><circle cx="8.5" cy="8.5" r="1.5"></circle>',
    archive: '<path d="M4 4h16v5H4z"></path><path d="M6 9v11h12V9M9 13h6"></path>'
  };

  function svgIcon(name, className = "icon") {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.book}</svg>`;
  }

  function safeText(value = "") {
    return typeof escapeHtml === "function" ? escapeHtml(value) : String(value);
  }

  function seoulParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false
    }).formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour)
    };
  }

  function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function displayDateSeoul(date = new Date()) {
    const parts = seoulParts(date);
    const base = Date.UTC(parts.year, parts.month - 1, parts.day);
    return formatDate(new Date(parts.hour < 7 ? base - 86400000 : base));
  }

  function sortDesc(items) {
    return [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function contentsFor(category) {
    return sortDesc(dailyContents.filter((item) => item.category === category));
  }

  function pickContent(category, date = displayDateSeoul()) {
    const list = contentsFor(category);
    return list.find((item) => item.date === date) || list.find((item) => item.date < date) || list[0];
  }

  function tagRow(tags = []) {
    if (!tags.length) return "";
    return `<div class="tag-row">${tags.map((tag) => `<span>${svgIcon("tag", "icon-sm")}${safeText(tag)}</span>`).join("")}</div>`;
  }

  function dailyCard(item) {
    if (!item) return "";
    const isEditorial = item.category === "editorial";
    return `<article class="category-daily-card theme-${safeText(item.category)}">
      <div class="category-daily-head">
        <span class="category-icon">${svgIcon(item.icon || "book")}</span>
        <div>
          <p class="eyebrow">${safeText(item.categoryLabel)} · ${safeText(item.date)}</p>
          <h2>${safeText(item.title)}</h2>
        </div>
      </div>
      <blockquote><strong>${safeText(item.scriptureRef)}</strong><br>${safeText(item.scriptureText)}</blockquote>
      <p class="daily-summary">${safeText(item.summary)}</p>
      <div class="${isEditorial ? "editorial-body" : "daily-body"}">${safeText(item.body)}</div>
      ${isEditorial ? `<div class="editorial-note"><strong>오늘의 질문</strong><p>${safeText(item.editorialQuestion)}</p></div>
      <div class="editorial-note"><strong>신앙적 시사점</strong><p>${safeText(item.editorialInsight)}</p></div>` : ""}
      <div class="daily-application"><strong>${isEditorial ? "삶의 적용" : "오늘 실천할 한 가지"}</strong><p>${safeText(item.application)}</p></div>
      ${item.confession ? `<div class="daily-confession">${safeText(item.confession)}</div>` : ""}
      ${item.prayer ? `<div class="daily-prayer"><strong>${isEditorial ? "마무리 기도" : "오늘의 기도"}</strong><p>${safeText(item.prayer)}</p></div>` : ""}
      ${tagRow(item.tags)}
    </article>`;
  }

  function compactCard(item) {
    return `<article class="archive-word-card">
      <div class="archive-card-meta"><span>${safeText(item.date)}</span><span>${safeText(item.categoryLabel)}</span></div>
      <h3>${safeText(item.title)}</h3>
      <p class="scripture-ref">${safeText(item.scriptureRef)}</p>
      <p>${safeText(item.summary)}</p>
      ${tagRow(item.tags)}
      <a class="text-link" href="${safeText(item.detailUrl)}">자세히 보기</a>
    </article>`;
  }

  function renderRecent(category, count = 7) {
    const root = document.getElementById("recentCategoryContents");
    if (!root) return;
    root.innerHTML = contentsFor(category).slice(0, count).map(compactCard).join("");
  }

  function renderCalendar(category, selectedDate = displayDateSeoul()) {
    const root = document.getElementById("categoryCalendar");
    if (!root) return;
    const dates = new Set(contentsFor(category).map((item) => item.date));
    const selectedParts = selectedDate.split("-").map(Number);
    let year = selectedParts[0];
    let month = selectedParts[1];

    function draw() {
      const first = new Date(Date.UTC(year, month - 1, 1));
      const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const startDay = first.getUTCDay();
      const cells = [];
      for (let i = 0; i < startDay; i += 1) cells.push('<span class="calendar-blank"></span>');
      for (let day = 1; day <= lastDate; day += 1) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const active = dates.has(date);
        cells.push(`<button type="button" class="calendar-day${date === selectedDate ? " selected" : ""}" ${active ? "" : "disabled"} data-date="${date}" aria-label="${date} 콘텐츠 보기">${day}</button>`);
      }
      root.innerHTML = `<div class="calendar-toolbar">
        <button type="button" class="filter-chip" data-month-prev aria-label="이전 달 보기">‹</button>
        <strong>${year}년 ${month}월</strong>
        <button type="button" class="filter-chip" data-month-next aria-label="다음 달 보기">›</button>
      </div>
      <div class="calendar-weekdays" aria-hidden="true"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
      <div class="calendar-grid">${cells.join("")}</div>
      <div class="calendar-actions">
        <button type="button" class="button secondary" data-back-today>${svgIcon("calendar", "icon-sm")} 오늘 콘텐츠로 돌아가기</button>
        <button type="button" class="button secondary" data-recent-count="7">최근 7일</button>
        <button type="button" class="button secondary" data-recent-count="30">최근 30일</button>
      </div>`;
      root.querySelector("[data-month-prev]")?.addEventListener("click", () => {
        month -= 1;
        if (month < 1) {
          month = 12;
          year -= 1;
        }
        draw();
      });
      root.querySelector("[data-month-next]")?.addEventListener("click", () => {
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
        draw();
      });
      root.querySelector("[data-back-today]")?.addEventListener("click", () => renderCategory(category, displayDateSeoul()));
      root.querySelectorAll("[data-recent-count]").forEach((button) => {
        button.addEventListener("click", () => renderRecent(category, Number(button.dataset.recentCount || 7)));
      });
      root.querySelectorAll(".calendar-day:not(:disabled)").forEach((button) => {
        button.addEventListener("click", () => renderCategory(category, button.dataset.date || displayDateSeoul()));
      });
    }
    draw();
  }

  function renderCategory(category, date = displayDateSeoul()) {
    const root = document.getElementById("dailyContentCard");
    if (!root) return;
    const item = pickContent(category, date);
    root.innerHTML = dailyCard(item);
    renderCalendar(category, item?.date || date);
    renderRecent(category, 7);
  }

  function renderArchiveFromDailyContents() {
    const root = document.getElementById("archiveResults");
    const filters = document.getElementById("archiveFilters");
    if (!root || !filters) return;
    const search = document.getElementById("archiveSearch");
    const categories = ["all", "word", "evening", "morning", "editorial"];
    const labels = { all: "전체", word: "말씀 붙들기", evening: "저녁기도", morning: "아침기도", editorial: "신앙묵상" };
    let active = "all";

    function queryItems() {
      const q = (search?.value || "").trim().toLowerCase();
      const items = sortDesc(dailyContents).filter((item) => {
        if (active !== "all" && item.category !== active) return false;
        if (!q) return true;
        return [item.title, item.scriptureRef, item.scriptureText, item.summary, item.body, ...(item.tags || [])].join(" ").toLowerCase().includes(q);
      });
      root.innerHTML = items.length ? items.map(compactCard).join("") : `<div class="soft-empty-state"><h3>가까운 주제를 다시 찾아보세요</h3><p>입력한 단어와 꼭 맞는 콘텐츠는 없지만, 카테고리 필터를 바꾸면 지난 말씀과 기도를 다시 볼 수 있습니다.</p></div>`;
    }

    function drawFilters() {
      filters.innerHTML = categories.map((category) => `<button type="button" class="filter-chip${category === active ? " active" : ""}" data-category="${category}">${labels[category]}</button>`).join("");
      filters.querySelectorAll("[data-category]").forEach((button) => {
        button.addEventListener("click", () => {
          active = button.dataset.category || "all";
          drawFilters();
          queryItems();
        });
      });
    }

    drawFilters();
    queryItems();
    search?.addEventListener("input", queryItems);
    document.getElementById("archiveSearchForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      queryItems();
    });
  }

  const categoryRoot = document.querySelector("[data-daily-category]");
  if (categoryRoot) renderCategory(categoryRoot.dataset.dailyCategory || "word");
  renderArchiveFromDailyContents();
})();
