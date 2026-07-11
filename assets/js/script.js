const $ = (selector) => document.querySelector(selector);

// 공개 페이지 어디에서나 동일한 로그인/회원가입 UI를 사용할 수 있도록 한 번만 로드합니다.
(() => {
  if (window.__faithMemberScriptLoaded) return;
  window.__faithMemberScriptLoaded = true;
  const script = document.createElement("script");
  script.src = new URL("assets/js/faith-member.js?v=20260711-account", window.location.href).href;
  script.async = true;
  document.head.append(script);
})();

const toggle = $(".menu-toggle");
const nav = $("#site-nav");
if (toggle && nav) {
  const navDetails = () => [...nav.querySelectorAll("details.site-nav-section")];
  const closeNavDetails = ({ restoreFocus = false } = {}) => {
    const opened = navDetails().filter((details) => details.open);
    const focusTarget = opened[0]?.querySelector("summary");
    opened.forEach((details) => { details.open = false; });
    if (restoreFocus && focusTarget) focusTarget.focus();
  };
  const closeMenu = ({ restoreFocus = false } = {}) => {
    closeNavDetails();
    nav.classList.remove("open");
    document.body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector(".sr-only").textContent = "전체 메뉴 열기";
    if (restoreFocus) toggle.focus();
  };
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
    toggle.querySelector(".sr-only").textContent = open ? "전체 메뉴 닫기" : "전체 메뉴 열기";
  });
  nav.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    closeNavDetails();
    if (window.matchMedia("(max-width: 860px)").matches) closeMenu();
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest("#site-nav")) return;
    closeNavDetails();
    if (nav.classList.contains("open") && !event.target.closest(".site-header")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (navDetails().some((details) => details.open)) {
      closeNavDetails({ restoreFocus: true });
      return;
    }
    if (nav.classList.contains("open")) closeMenu({ restoreFocus: true });
  });
  window.addEventListener("resize", () => closeNavDetails());
  window.addEventListener("scroll", () => closeNavDetails(), { passive: true });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function faithProducts() {
  const remote = Array.isArray(window.FAITH_PRODUCT_CATALOG) ? window.FAITH_PRODUCT_CATALOG : [];
  const fallback = Array.isArray(window.FAITH_PRODUCTS) ? window.FAITH_PRODUCTS : [];
  return [...remote, ...fallback].map(normalizeFaithProduct);
}

function normalizeFaithProduct(product = {}) {
  return {
    ...product,
    resourceId: product.resourceId ?? product.resource_id ?? null,
    previewItems: product.previewItems ?? product.preview_items ?? [],
    salesStatus: product.salesStatus ?? product.saleStatus ?? product.sale_status ?? "inquiry",
    priceKrw: product.priceKrw ?? product.priceAmount ?? product.price_amount ?? null,
    contactUrl: product.contactUrl ?? product.contact_url ?? "contact.html"
  };
}

function findFaithProduct(productId) {
  return faithProducts().find((product) => product.id === productId) || null;
}

function isPurchasable(product) {
  const normalized = normalizeFaithProduct(product);
  return Boolean(normalized && ["on_sale", "available"].includes(normalized.salesStatus) && normalized.purchasable !== false && Number(normalized.priceKrw) > 0);
}

function productInquiryLink(product) {
  return normalizeFaithProduct(product).contactUrl || "contact.html";
}

function productInquiryHref(product) {
  const normalized = normalizeFaithProduct(product);
  const link = productInquiryLink(normalized);
  if (!normalized.id) return link;
  return `${link}${link.includes("?") ? "&" : "?"}product=${encodeURIComponent(normalized.id)}`;
}

function formatKrw(value) {
  return `${Number(value).toLocaleString("ko-KR")}원`;
}

async function requestProductPurchase(productId) {
  if (window.FaithAuth?.requestPurchase) {
    return window.FaithAuth.requestPurchase(productId);
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("회원 서비스를 불러오지 못했습니다. 자료 문의하기를 이용해 주세요.")), 5000);
    window.addEventListener("faith-auth-ready", async () => {
      window.clearTimeout(timer);
      try {
        if (!window.FaithAuth?.requestPurchase) throw new Error("회원 서비스를 불러오지 못했습니다. 자료 문의하기를 이용해 주세요.");
        resolve(await window.FaithAuth.requestPurchase(productId));
      } catch (error) {
        reject(error);
      }
    }, { once: true });
  });
}

async function startProductPurchase(productId) {
  const result = await requestProductPurchase(productId);
  if (!result?.alreadyPurchased) return result;
  if (!result.resourceId || !window.FaithAuth?.requestProtectedDownload) {
    window.location.assign("account.html");
    return result;
  }
  const download = await window.FaithAuth.requestProtectedDownload(result.resourceId);
  trackFaithEvent("resource_download", { resource_id: result.resourceId, product_id: productId, repeat: true });
  openProtectedDownloads(download);
  return result;
}

function openProtectedDownloads(download) {
  if (window.FaithAuth?.startProtectedDownloads) return window.FaithAuth.startProtectedDownloads(download);
  if (!download?.url) throw new Error("다운로드 링크를 찾지 못했습니다.");
  window.location.assign(download.url);
  return 1;
}

function trackFaithEvent(name, params = {}) {
  const payload = { ...params, page_path: window.location.pathname };
  if (typeof window.gtag === "function") window.gtag("event", name, payload);
  window.dispatchEvent(new CustomEvent("faith-conversion", { detail: { name, ...payload } }));
}

document.addEventListener("click", (event) => {
  const preview = event.target.closest("[data-resource-preview]");
  if (preview) trackFaithEvent("resource_preview", { product_id: preview.dataset.productId || "" });
  const inquiry = event.target.closest("[data-resource-inquiry]");
  if (inquiry) trackFaithEvent("resource_inquiry", { product_id: inquiry.dataset.productId || "" });
});

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
  if (window.matchMedia("(max-width: 860px)").matches) {
    root.className = "card-carousel mobile-content-list";
    root.setAttribute("aria-label", `${label} 목록`);
    root.innerHTML = `<div class="card-stack">${items.map(renderer).join("")}</div>`;
    root.querySelectorAll(".stack-card").forEach((card) => card.removeAttribute("aria-hidden"));
    return;
  }
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

function renderPrayers(list = window.PRAYERS || []) {
  const root = $("#prayerResults");
  if (!root) return;
  renderCompactContentList(root, list, "기도문");
}

function searchPrayers() {
  const input = $("#prayerSearch");
  if (!input) return;
  const q = input.value.trim().toLowerCase();
  const requestedCategory = new URLSearchParams(location.search).get("category") || "";
  const categoryList = requestedCategory
    ? (window.PRAYERS || []).filter((p) => p.category === requestedCategory || p.tags?.includes(requestedCategory))
    : (window.PRAYERS || []);
  const list = q
    ? categoryList.filter((p) => [p.title, p.category, p.scripture, ...(p.tags || [])].join(" ").toLowerCase().includes(q))
    : categoryList;
  renderPrayers(list);
  const help = $("#searchHelp");
  if (help) help.textContent = list.length ? `${requestedCategory ? `${requestedCategory} 주제의 ` : ""}${list.length}개 기도문을 찾았습니다.` : "가까운 주제의 기도문을 다시 검색해 주세요.";
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
  if (root) renderCompactContentList(root, list, "기도문");
}

const sitePrayers = window.PRAYERS || [];
renderList("nightList", sitePrayers.filter((p) => p.tags?.includes("밤") || p.tags?.includes("수면") || p.category === "수면").concat(sitePrayers.slice(0, 3)));
renderList("morningList", sitePrayers.filter((p) => p.category === "아침").concat(sitePrayers.slice(0, 3)));

if ($("#meditationList")) {
  renderCompactContentList($("#meditationList"), window.MEDITATIONS || [], "말씀 묵상");
}

function videoCard(v, { inline = false, featured = false } = {}) {
  const thumb = inline
    ? `<button class="video-thumb" type="button" data-play-video="${escapeHtml(v.videoId)}" aria-label="${escapeHtml(v.title)} 이 페이지에서 재생"><img src="${v.thumbnail}" alt="${escapeHtml(v.title)} 썸네일" loading="lazy"><span class="play-mark" aria-hidden="true">▶</span></button>`
    : `<a class="video-thumb" href="${v.url}" target="_blank" rel="noopener" aria-label="${escapeHtml(v.title)} 영상 보기"><img src="${v.thumbnail}" alt="${escapeHtml(v.title)} 썸네일" loading="lazy"><span class="play-mark" aria-hidden="true">▶</span></a>`;
  return `<article class="video-card${featured ? " home-featured-video" : ""}">
    ${thumb}
    <p class="eyebrow">${escapeHtml(v.theme)}${v.publishedDate ? ` · ${escapeHtml(v.publishedDate)}` : ""}</p>
    <h3>${escapeHtml(v.title)}</h3>
    <p class="video-scripture">${escapeHtml(v.scripture || "")}</p>
    <a class="text-link" href="${v.url}" target="_blank" rel="noopener">유튜브에서 보기</a>
  </article>`;
}

const videoData = window.VIDEOS || (typeof VIDEOS !== "undefined" ? VIDEOS : []);
const videoList = $("#videoList");
if (videoList) videoList.innerHTML = videoData.map((video) => videoCard(video, { inline: true })).join("");
const homeVideos = $("#homeVideos");
if (homeVideos) homeVideos.innerHTML = videoData.slice(0, 3).map(videoCard).join("");

(() => {
  const qtRoot = document.getElementById("homeQtPreview");
  const prayerRoot = document.getElementById("homePrayerPreview");
  if (!qtRoot || !prayerRoot) return;
  const items = Array.isArray(window.DAILY_CONTENTS) ? window.DAILY_CONTENTS : [];
  const seoulNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const targetDate = new Date(seoulNow);
  if (seoulNow.getHours() < 6) targetDate.setDate(targetDate.getDate() - 1);
  const date = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
  const latest = (category) => [...items].filter((item) => item.category === category).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const pick = (category) => items.find((item) => item.category === category && item.date === date) || latest(category);
  const qt = pick("editorial");
  const prayerCategory = seoulNow.getHours() < 12 ? "morning" : "evening";
  const prayer = pick(prayerCategory);
  if (qt) qtRoot.innerHTML = `<p class="eyebrow">오늘의 큐티(QT)</p><h3>${escapeHtml(qt.title)}</h3><blockquote>${escapeHtml(qt.scriptureRef)} · ${escapeHtml(qt.scriptureText)}</blockquote><p>${escapeHtml(qt.summary || qt.editorialInsight || "")}</p><a class="text-link" href="meditation.html">묵상 전문 읽기</a>`;
  if (prayer) prayerRoot.innerHTML = `<p class="eyebrow">${prayerCategory === "morning" ? "오늘의 아침기도" : "오늘의 저녁기도"}</p><h3>${escapeHtml(prayer.title)}</h3><blockquote>${escapeHtml(prayer.scriptureRef)} · ${escapeHtml(prayer.scriptureText)}</blockquote><p>${escapeHtml(prayer.prayer || prayer.summary || "")}</p><a class="text-link" href="${prayerCategory === "morning" ? "morning-prayer.html" : "night-prayer.html"}">기도 전문 읽기</a>`;
})();

function inlineVideoMarkup(video) {
  return `<div class="inline-video-shell"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}?autoplay=1" title="${escapeHtml(video.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
}

function renderFeaturedVideo(video) {
  const root = document.getElementById("featuredVideo");
  if (!root || !video) return;
  root.innerHTML = `<div data-featured-video-media><button class="video-thumb" type="button" data-play-video="${escapeHtml(video.videoId)}" aria-label="${escapeHtml(video.title)} 이 페이지에서 재생"><img src="${video.thumbnail}" alt="${escapeHtml(video.title)} 썸네일"><span class="play-mark" aria-hidden="true">▶</span></button></div><div><p class="eyebrow">${escapeHtml(video.theme)} · ${escapeHtml(video.publishedDate || "")}</p><h2>${escapeHtml(video.title)}</h2><p><strong>${escapeHtml(video.scripture)}</strong></p><p>${escapeHtml(video.description)}</p><div class="hero-actions"><button class="button primary" type="button" data-play-video="${escapeHtml(video.videoId)}">이 페이지에서 재생</button><a class="button secondary" href="${video.url}" target="_blank" rel="noopener">유튜브에서 보기</a></div></div>`;
}

function replaceWithInlinePlayer(button) {
  const video = videoData.find((item) => item.videoId === button.dataset.playVideo);
  if (!video) return;
  const featured = button.closest("#featuredVideo");
  const media = featured?.querySelector("[data-featured-video-media]") || button.closest(".video-card")?.querySelector(".video-thumb");
  if (!media) return;
  if (media.matches(".video-thumb")) media.outerHTML = inlineVideoMarkup(video);
  else media.innerHTML = inlineVideoMarkup(video);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-play-video]");
  if (button) replaceWithInlinePlayer(button);
});

(() => {
  if (!videoList) return;
  const sectionTab = new URLSearchParams(location.search).get("tab") === "posts" ? "posts" : "videos";
  document.querySelectorAll("[data-media-section-tab]").forEach((link) => link.classList.toggle("active", link.dataset.mediaSectionTab === sectionTab));
  renderFeaturedVideo(videoData[0]);
  const filters = [...document.querySelectorAll("[data-video-filter]")];
  const draw = (filter = "all") => {
    const list = filter === "all" ? videoData : videoData.filter((video) => {
      const source = [video.theme, ...(video.tags || [])].join(" ");
      if (filter === "morning") return /아침/.test(source);
      if (filter === "evening") return /저녁|밤|수면/.test(source);
      if (filter === "meditation") return /큐티|묵상|말씀/.test(source);
      if (filter === "prayer") return /기도|회복|위로/.test(source);
      if (filter === "shorts") return video.isShort === true;
      return true;
    });
    videoList.innerHTML = list.length ? list.map((video) => videoCard(video, { inline: true })).join("") : '<div class="soft-empty-state"><h3>해당 분류의 영상은 아직 없습니다.</h3><p>전체 영상에서 다른 기도와 묵상을 살펴보세요.</p></div>';
  };
  filters.forEach((button) => button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.toggle("is-active", item === button));
    draw(button.dataset.videoFilter || "all");
  }));
})();

function channelPostCard(post) {
  const related = videoData.find((video) => video.videoId === (post.relatedVideoId || post.related_video_id));
  return `<article class="channel-post-card"><p class="eyebrow">채널 소식 · ${escapeHtml(post.publishedDate || "")}</p><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.body)}</p><div class="hero-actions">${related ? `<a class="text-link" href="${related.url}" target="_blank" rel="noopener">관련 영상 보기</a>` : ""}${post.youtubePostUrl ? `<a class="text-link" href="${escapeHtml(post.youtubePostUrl)}" target="_blank" rel="noopener">유튜브 게시물 보기</a>` : ""}</div></article>`;
}

(() => {
  let posts = (window.CHANNEL_POSTS || []).filter((post) => post.status === "published");
  const postRoot = document.getElementById("channelPostList");
  const homeRoot = document.getElementById("homeMediaList");
  const tabs = [...document.querySelectorAll("[data-home-media-tab]")];
  let activeTab = new URLSearchParams(location.search).get("tab") === "posts" ? "posts" : "videos";
  const draw = (tab = "videos") => {
    activeTab = tab;
    if (postRoot) postRoot.innerHTML = posts.length ? posts.map(channelPostCard).join("") : '<p class="soft-empty-state">채널 소식은 새 글이 등록되면 이곳에 표시됩니다.</p>';
    if (!homeRoot) return;
    homeRoot.className = tab === "posts" ? "channel-post-grid" : "home-media-grid";
    homeRoot.innerHTML = tab === "posts"
      ? posts.slice(0, 2).map(channelPostCard).join("")
      : videoData.slice(0, 3).map((video, index) => videoCard(video, { inline: true, featured: index === 0 })).join("");
  };
  tabs.forEach((button) => button.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.toggle("is-active", item === button));
    draw(button.dataset.homeMediaTab || "videos");
  }));
  async function loadRemotePosts() {
    const client = window.FaithAuth?.getClient ? await window.FaithAuth.getClient() : window.FaithSupabase;
    if (!client) return;
    const { data, error } = await client.from("channel_posts").select("id,title,body,related_video_id,youtube_post_url,published_at,status").eq("status", "published").order("published_at", { ascending: false }).limit(20);
    if (error || !data?.length) return;
    posts = data.map((post) => ({ ...post, publishedDate: post.published_at?.slice(0, 10) || "", youtubePostUrl: post.youtube_post_url || "" }));
    draw(activeTab);
  }
  draw(activeTab);
  if (window.FaithAuth?.getClient || window.FaithSupabase) loadRemotePosts().catch(() => {});
  else window.addEventListener("faith-auth-ready", () => loadRemotePosts().catch(() => {}), { once: true });
})();

function pdfProductCard(product) {
  const productId = product.productId || product.id;
  const canPurchase = isPurchasable(product);
  const action = canPurchase
    ? `<button class="button primary" type="button" data-product-purchase="${escapeHtml(productId)}">구매하기 · ${escapeHtml(formatKrw(product.priceKrw))}</button>`
    : `<a class="button primary" href="${escapeHtml(productInquiryHref(product))}" data-resource-inquiry data-product-id="${escapeHtml(productId)}">자료 문의하기</a>`;
  const badge = product.isFeatured ? '<span class="product-badge">대표 상품</span>' : "";
  return `<article class="pdf-product-card${product.isFeatured ? " featured" : ""}">
    <div class="product-card-top">
      <p class="eyebrow">${escapeHtml(product.category)}</p>
      ${badge}
    </div>
    <h3>${escapeHtml(product.title)}</h3>
    <p class="product-audience">${escapeHtml(product.audience)}</p>
    <ul class="compact-list">${product.composition.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <div class="product-actions">
      ${action}
    </div>
  </article>`;
}

function compactContentItem(item, label = "콘텐츠") {
  const category = item.category || label;
  const scripture = item.scripture || item.scriptureRef || "";
  const summary = item.summary || "";
  const body = item.body || "";
  return `<details class="compact-content-item">
    <summary>
      <span class="compact-content-category">${escapeHtml(category)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      ${scripture ? `<span class="compact-content-scripture">${escapeHtml(scripture)}</span>` : ""}
    </summary>
    <div class="compact-content-expanded">
      ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
      ${body ? `<p>${escapeHtml(body)}</p>` : ""}
    </div>
  </details>`;
}

function renderCompactContentList(root, items, label) {
  if (!root) return;
  root.className = "compact-content-list";
  root.setAttribute("aria-label", `${label} 간략 목록`);
  root.innerHTML = items.length
    ? items.map((item) => compactContentItem(item, label)).join("")
    : `<div class="soft-empty-state"><strong>표시할 자료가 없습니다.</strong></div>`;
}

function resolvedPdfProduct(product) {
  const direct = findFaithProduct(product.productId || product.id);
  const linked = product.resourceId ? faithProducts().find((item) => item.resourceId === product.resourceId) : null;
  const live = direct || linked;
  if (!live) return product;
  return {
    ...product,
    ...live,
    id: live.id || product.id,
    productId: live.id || product.productId || product.id,
    resourceId: live.resourceId ?? product.resourceId
  };
}

const pdfProductGrid = $("#pdfProductGrid");
function renderPdfProductGrid() {
  if (!pdfProductGrid || typeof PDF_PRODUCTS === "undefined") return;
  pdfProductGrid.innerHTML = PDF_PRODUCTS.map((product) => pdfProductCard(resolvedPdfProduct(product))).join("");
}
if (pdfProductGrid && typeof PDF_PRODUCTS !== "undefined") {
  renderPdfProductGrid();
  pdfProductGrid.addEventListener("click", async (event) => {
    const purchaseButton = event.target.closest("[data-product-purchase]");
    if (purchaseButton) {
      event.preventDefault();
      const productId = purchaseButton.dataset.productPurchase;
      trackFaithEvent("purchase_start", { product_id: productId });
      try {
        await startProductPurchase(productId);
      } catch (error) {
        window.alert(error.message || "결제 흐름을 열지 못했습니다. 자료 문의하기로 연락해 주세요.");
      }
      return;
    }
  });
}

const homeFaithResources = $("#homeFaithResources");
function renderHomeFaithResources() {
  if (!homeFaithResources || !Array.isArray(window.FAITH_RESOURCES)) return;
  homeFaithResources.innerHTML = window.FAITH_RESOURCES.slice(0, 3).map((resource) => {
    const formatLabel = resource.type === "audio" ? "기도 오디오북" : resource.type === "card" ? "기도카드" : "기도문 PDF";
    return `<article class="home-resource-preview resource-type-${escapeHtml(resource.type)}">
      <p class="eyebrow">${escapeHtml(formatLabel)}</p>
      <h3>${escapeHtml(resource.title)}</h3>
      <p>${escapeHtml(resource.summary)}</p>
      <div class="home-resource-preview-actions">
        <span class="resource-price-inline">가격 준비중</span>
        <a class="text-link" href="prayer-cards.html?type=${encodeURIComponent(resource.type)}">${escapeHtml(formatLabel)} 보기</a>
      </div>
    </article>`;
  }).join("");
}
if (homeFaithResources && Array.isArray(window.FAITH_RESOURCES)) {
  renderHomeFaithResources();
  homeFaithResources.addEventListener("click", async (event) => {
    const purchaseButton = event.target.closest("[data-product-purchase]");
    if (purchaseButton) {
      event.preventDefault();
      const productId = purchaseButton.dataset.productPurchase;
      trackFaithEvent("purchase_start", { product_id: productId });
      try {
        await startProductPurchase(productId);
      } catch (error) {
        window.alert(error.message || "결제 흐름을 열지 못했습니다. 자료 문의하기로 연락해 주세요.");
      }
      return;
    }
  });
}

async function refreshCommerceProductCatalog() {
  if (!pdfProductGrid && !homeFaithResources) return;
  const client = window.FaithAuth?.getClient ? await window.FaithAuth.getClient() : window.FaithSupabase;
  if (!client) return;
  const { data, error } = await client
    .from("faith_products")
    .select("id, resource_id, type, title, summary, preview_items, sale_status, price_amount, currency, purchasable, published")
    .eq("published", true);
  if (error) return;
  window.FAITH_PRODUCT_CATALOG = (data || []).map(normalizeFaithProduct);
  renderPdfProductGrid();
  renderHomeFaithResources();
}

if (pdfProductGrid || homeFaithResources) {
  refreshCommerceProductCatalog().catch(() => {});
  window.addEventListener("faith-auth-ready", () => { refreshCommerceProductCatalog().catch(() => {}); }, { once: true });
}

function productActionMarkup(product, productId) {
  const normalized = normalizeFaithProduct(product || { id: productId, salesStatus: "inquiry", contactUrl: "contact.html" });
  if (isPurchasable(normalized)) {
    return `<button class="button primary" type="button" data-product-purchase="${escapeHtml(normalized.id)}">구매하기 · ${escapeHtml(formatKrw(normalized.priceKrw))}</button>`;
  }
  return `<a class="button primary" href="${escapeHtml(productInquiryHref(normalized))}" data-resource-inquiry data-product-id="${escapeHtml(normalized.id || productId)}">자료 문의하기</a>`;
}

(() => {
  const targets = [...document.querySelectorAll("[data-product-action]")];
  if (!targets.length) return;
  const status = document.querySelector("[data-product-action-status]");
  const setStatus = (message = "") => { if (status) status.textContent = message; };

  async function hydrateProductActions() {
    const ids = [...new Set(targets.map((target) => String(target.dataset.productAction || "").trim()).filter(Boolean))];
    const client = window.FaithSupabase;
    if (client && ids.length) {
      const { data, error } = await client
        .from("faith_products")
        .select("id, resource_id, type, title, summary, preview_items, sale_status, price_amount, currency, purchasable, published")
        .in("id", ids)
        .eq("published", true);
      if (!error && data?.length) window.FAITH_PRODUCT_CATALOG = (data || []).map(normalizeFaithProduct);
    }
    targets.forEach((target) => {
      const productId = String(target.dataset.productAction || "").trim();
      target.innerHTML = productActionMarkup(findFaithProduct(productId), productId);
      if (target.dataset.productActionBound) return;
      target.dataset.productActionBound = "true";
      target.addEventListener("click", async (event) => {
        const purchaseButton = event.target.closest("[data-product-purchase]");
        if (!purchaseButton) return;
        event.preventDefault();
        const id = purchaseButton.dataset.productPurchase;
        purchaseButton.disabled = true;
        setStatus("결제 화면을 준비하고 있습니다.");
        trackFaithEvent("purchase_start", { product_id: id });
        try {
          await startProductPurchase(id);
        } catch (error) {
          setStatus(error.message || "결제 흐름을 열지 못했습니다. 자료 문의하기로 연락해 주세요.");
        } finally {
          purchaseButton.disabled = false;
        }
      });
    });
  }

  hydrateProductActions().catch(() => {
    // 원격 상품 목록을 읽지 못해도 HTML에 둔 문의 CTA는 계속 사용할 수 있습니다.
  });
  window.addEventListener("faith-auth-ready", () => {
    hydrateProductActions().catch(() => {});
  }, { once: true });
})();

const prayerCardList = $("#prayerCardList");
if (prayerCardList) {
  renderCarousel(prayerCardList, window.PRAYER_CARDS || [], prayerImageCard, "말씀 카드");
}

const visualPrayerCards = $("#visualPrayerCards");
if (visualPrayerCards) {
  renderCarousel(visualPrayerCards, (window.PRAYER_CARDS || []).slice(0, 6), prayerImageCard, "카드 미리보기");
}

(() => {
  const embeddedFallback = document.getElementById("faithResourceFallback");
  let parsedEmbeddedFallback = [];
  try {
    parsedEmbeddedFallback = embeddedFallback ? JSON.parse(embeddedFallback.textContent || "[]") : [];
  } catch {
    parsedEmbeddedFallback = [];
  }
  const fallbackResources = Array.isArray(window.FAITH_RESOURCES) ? window.FAITH_RESOURCES : parsedEmbeddedFallback;
  const client = window.FaithSupabase;
  const listRoot = $("#faithResourceList");
  const tagRoot = $("#faithResourceTags");
  const filterStatus = $("#faithResourceFilterStatus");
  const actionStatus = $("#faithResourceActionStatus");
  const typeRoot = $("#faithResourceTypes");
  const searchInput = $("#faithResourceSearch");
  const resetButton = $("#faithResourceReset");
  const threadPanel = $("#cardThreadDetail");
  if (!listRoot || !tagRoot) return;

  const typeMeta = {
    pdf: {
      title: "기도문 PDF",
      eyebrow: "신앙자료 · 읽는 자료",
      hero: "기도문 PDF",
      description: "삶의 여러 상황에서 천천히 읽고 보관할 수 있는 유료 기도문 자료를 모았습니다.",
      empty: "준비중",
      placeholder: "예: 자녀, 가정, 위로"
    },
    audio: {
      title: "기도 오디오북",
      eyebrow: "신앙자료 · 듣는 자료",
      hero: "기도 오디오북",
      description: "이동 중이나 잠들기 전에 차분히 들을 수 있는 유료 기도 낭독 자료입니다.",
      empty: "준비중",
      placeholder: "예: 잠들기 전, 평안, 회복"
    },
    card: {
      title: "기도카드",
      eyebrow: "신앙자료 · 저장하는 자료",
      hero: "기도카드",
      description: "말씀과 기도를 한 장씩 저장하고 나눌 수 있도록 만든 유료 카드 자료입니다.",
      empty: "준비중",
      placeholder: "예: 자녀, 위로, 결정"
    }
  };
  let resources = [];
  let viewer = null;
  let entitledResourceIds = new Set();
  const requestedType = new URLSearchParams(window.location.search).get("type") || "pdf";
  let activeType = Object.hasOwn(typeMeta, requestedType) ? requestedType : "pdf";
  let searchQuery = new URLSearchParams(window.location.search).get("search") || "";
  const activeTags = new Set();

  const isAdmin = () => Boolean(viewer?.role === "admin");
  const hasPurchasedResource = (resource) => isAdmin() || entitledResourceIds.has(resource.id);

  function setResourceActionStatus(message = "") {
    if (!actionStatus) return;
    actionStatus.textContent = message;
    actionStatus.hidden = !message;
  }

  function productForResource(resource) {
    const productId = resource.productId || resource.product_id || resource.id;
    const localProduct = findFaithProduct(productId) || faithProducts().find((product) => product.resourceId === resource.id);
    if (localProduct) return localProduct;
    return normalizeFaithProduct({
      id: productId,
      resourceId: resource.id,
      type: resource.type,
      salesStatus: resource.access_level === "free" ? "free" : "inquiry",
      priceKrw: null,
      contactUrl: "contact.html"
    });
  }

  async function loadViewer() {
    if (!client) return null;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;
    const { data: profile } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return profile ? { ...profile, user } : { role: "member", user };
  }

  async function refreshEntitlements() {
    entitledResourceIds = new Set();
    if (!viewer || isAdmin() || !window.FaithAuth?.hasPurchasedResource) return;
    const checks = await Promise.all(resources.map(async (resource) => {
      try {
        const product = productForResource(resource);
        const owned = await window.FaithAuth.hasPurchasedResource(product.resourceId || resource.id);
        return owned ? resource.id : null;
      } catch {
        return null;
      }
    }));
    entitledResourceIds = new Set(checks.filter(Boolean));
  }

  async function loadResources(catalog = []) {
    if (!client) return null;
    // 현재 공개 카탈로그에서 제외한 이전 자료입니다. Supabase 원본과 파일은 삭제하지 않습니다.
    const unlistedResourceIds = new Set(["9ac7451f-0ea2-48df-afed-8bcf6187faad"]);
    const { data, error } = await client
      .from("faith_resources")
      .select("id, type, title, summary, tags, access_level, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (error) return null;
    return (data || []).filter((resource) => !unlistedResourceIds.has(resource.id)).map((resource) => {
      const localPreview = fallbackResources.find((item) => item.id === resource.id);
      const product = catalog.find((item) => item.resourceId === resource.id);
      return {
        ...resource,
        productId: product?.id || localPreview?.productId || resource.productId || resource.id,
        previewItems: product?.previewItems || product?.preview_items || localPreview?.previewItems || [],
        sampleAudioUrl: localPreview?.sampleAudioUrl || localPreview?.sample_audio_url || "",
        isUploaded: true
      };
    });
  }

  async function loadProductCatalog() {
    if (!client) return [];
    const { data, error } = await client
      .from("faith_products")
      .select("id, resource_id, type, title, summary, preview_items, sale_status, price_amount, currency, purchasable, published")
      .eq("published", true);
    if (error) return [];
    return (data || []).map(normalizeFaithProduct);
  }

  function resourcesByType() {
    return resources.filter((resource) => resource.type === activeType);
  }

  function uploadedThreads() {
    return resourcesByType().filter((resource) => resource.isUploaded);
  }

  function renderAll() {
    renderResourceHub();
  }

  function renderHubPreviewItems(resource) {
    if (Array.isArray(resource.previewItems) && resource.previewItems.length) return resource.previewItems.slice(0, 3);
    const tags = (resource.tags || []).slice(0, 3);
    if (resource.type === "audio") return tags.map((tag) => `${tag}을 위한 기도 낭독 흐름`);
    if (resource.type === "card") return tags.map((tag) => `${tag}을 위한 한 장의 기도`);
    return tags.map((tag) => `${tag} 앞에서 천천히 읽는 기도와 묵상`);
  }

  function renderHubAccessPanel(resource) {
    const fileLabel = resource.type === "audio" ? "MP3 파일" : resource.type === "card" ? "카드 전체 보기" : "PDF 파일";
    const product = productForResource(resource);
    if (hasPurchasedResource(resource)) {
      return `<div class="resource-access-panel"><p>구매한 자료입니다. 내 자료실에서도 다시 열 수 있습니다.</p><button class="button primary" type="button" data-resource-download="${escapeHtml(resource.id)}">${escapeHtml(fileLabel)} 열기</button></div>`;
    }
    if (product.salesStatus === "free") {
      const publicUrl = resource.downloadUrl || resource.download_url || resource.publicDownloadUrl || "";
      const action = publicUrl
        ? `<a class="button primary" href="${escapeHtml(publicUrl)}">${escapeHtml(fileLabel)} 열기</a>`
        : `<button class="button secondary" type="button" data-resource-detail="${escapeHtml(resource.id)}">자료 구성 보기</button>`;
      return `<div class="resource-access-panel"><p>공개 자료입니다. 필요한 때에 다시 꺼내 읽을 수 있습니다.</p>${action}</div>`;
    }
    if (isPurchasable(product)) {
      return `<div class="resource-access-panel"><p>개별 구매 후 바로 내 자료실에서 열 수 있습니다.</p><button class="button primary" type="button" data-product-purchase="${escapeHtml(product.id)}">구매하기 · ${escapeHtml(formatKrw(product.priceKrw))}</button></div>`;
    }
    return `<div class="resource-access-panel"><p>등록된 자료 구성을 확인한 뒤, 이용 방법을 안내받을 수 있습니다.</p><a class="button primary" href="${escapeHtml(productInquiryHref(product))}" data-resource-inquiry data-product-id="${escapeHtml(product.id)}">자료 문의하기</a></div>`;
  }

  function hubFilteredResources() {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return uploadedThreads().filter((resource) => {
      const matchesTags = !activeTags.size || [...activeTags].some((tag) => resource.tags?.includes(tag));
      const searchable = [resource.title, resource.summary, ...(resource.tags || [])].join(" ").toLowerCase();
      return matchesTags && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }

  function renderHubTags() {
    const tags = [...new Set(uploadedThreads().flatMap((resource) => resource.tags || []))].sort((a, b) => String(a).localeCompare(String(b), "ko"));
    tagRoot.innerHTML = [`<button class="${activeTags.size ? "" : "is-active"}" type="button" data-clear-tags aria-pressed="${String(!activeTags.size)}">전체 키워드</button>`]
      .concat(tags.map((tag) => `<button class="${activeTags.has(tag) ? "is-active" : ""}" type="button" data-resource-tag="${escapeHtml(tag)}" aria-pressed="${String(activeTags.has(tag))}">${escapeHtml(tag)}</button>`))
      .join("");
  }

  function renderHubCard(resource) {
    const tags = (resource.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    const meta = typeMeta[resource.type] || typeMeta.all;
    const product = productForResource(resource);
    return `<article class="faith-resource-card resource-type-${escapeHtml(resource.type)}" data-resource-id="${escapeHtml(resource.id)}">
      <div class="resource-card-copy">
        <p class="eyebrow">${escapeHtml(meta?.title || "신앙자료")}</p>
        <h3>${escapeHtml(resource.title)}</h3>
        <p class="resource-summary">${escapeHtml(resource.summary)}</p>
        <div class="resource-card-tags" aria-label="자료 키워드">${tags}</div>
      </div>
      <div class="resource-card-commerce">
        <span class="resource-price-label">가격</span>
        <strong>준비중</strong>
        <a class="text-link" href="${escapeHtml(productInquiryHref(product))}" data-resource-inquiry data-product-id="${escapeHtml(product.id)}">자료 문의하기</a>
      </div>
    </article>`;
  }

  function renderHubList() {
    const list = hubFilteredResources();
    if (filterStatus) {
      const conditions = [];
      if (activeTags.size) conditions.push([...activeTags].join(" · "));
      if (searchQuery.trim()) conditions.push(`“${searchQuery.trim()}” 검색`);
      const detail = conditions.length ? ` · ${conditions.join(" · ")}` : "";
      filterStatus.textContent = list.length
        ? `${typeMeta[activeType].title} ${list.length}건${detail}`
        : activeTags.size || searchQuery.trim()
          ? `${typeMeta[activeType].title}에서 조건에 맞는 자료를 찾지 못했습니다${detail}`
          : `${typeMeta[activeType].title} 0건 · 준비중`;
    }
    listRoot.innerHTML = list.length
      ? list.map(renderHubCard).join("")
      : activeTags.size || searchQuery.trim()
        ? `<div class="resource-empty-state"><strong>선택한 조건에 맞는 자료가 없습니다.</strong><p>키워드 선택을 줄이거나 검색어를 바꿔보세요.</p><button class="button secondary" type="button" data-reset-resource-search>필터 초기화</button></div>`
        : `<div class="resource-empty-state resource-coming-soon"><strong>${escapeHtml(typeMeta[activeType].empty)}</strong></div>`;
  }

  function renderResourceHub() {
    const meta = typeMeta[activeType];
    document.body.dataset.resourceType = activeType;
    document.querySelectorAll("[data-resource-page-link]").forEach((link) => {
      const selected = link.dataset.resourcePageLink === activeType;
      link.classList.toggle("is-active", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    const heroEyebrow = document.getElementById("resourceHeroEyebrow");
    const heroTitle = document.getElementById("resourceHeroTitle");
    const heroDescription = document.getElementById("resourceHeroDescription");
    const listEyebrow = document.getElementById("resourceListEyebrow");
    const listTitle = document.getElementById("resourceListTitle");
    if (heroEyebrow) heroEyebrow.textContent = meta.eyebrow;
    if (heroTitle) heroTitle.textContent = meta.hero;
    if (heroDescription) heroDescription.textContent = meta.description;
    if (listEyebrow) listEyebrow.textContent = meta.title;
    if (listTitle) listTitle.textContent = `등록된 ${meta.title}`;
    if (searchInput) searchInput.placeholder = meta.placeholder;
    renderHubTags();
    renderHubList();
    if (resetButton) resetButton.hidden = !activeTags.size && !searchQuery.trim();
  }

  function promptMemberAccess() {
    setResourceActionStatus(viewer ? "구매한 자료는 내 자료실에서 다시 열 수 있습니다." : "자료를 구매하거나 내 자료실을 이용하려면 로그인해 주세요.");
    if (window.FaithAuth?.open) {
      window.FaithAuth.open(viewer ? "login" : "signup");
      return;
    }
    window.addEventListener("faith-auth-ready", () => window.FaithAuth?.open(viewer ? "login" : "signup"), { once: true });
  }

  function openResourceDetail(resource) {
    const title = $("#cardThreadTitle");
    const description = $("#cardThreadDescription");
    const gallery = $("#cardThreadGallery");
    if (!threadPanel) return;
    const items = renderHubPreviewItems(resource);
    if (title) title.textContent = resource.title;
    if (description) description.textContent = resource.description || resource.summary;
    if (gallery) {
      gallery.innerHTML = `<div class="resource-detail-content">
        <p class="eyebrow">${escapeHtml((typeMeta[resource.type] || typeMeta.all).title)}</p>
        <h3>자료 구성</h3>
        <ul class="compact-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        ${renderHubAccessPanel(resource)}
      </div>`;
    }
    threadPanel.hidden = false;
    const url = new URL(window.location.href);
    url.searchParams.set("resource", resource.id);
    window.history.replaceState({}, "", url);
    trackFaithEvent("resource_detail_view", { resource_id: resource.id, product_id: productForResource(resource).id });
    threadPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function downloadResource(resourceId) {
    const resource = resources.find((item) => item.id === resourceId);
    if (!resource) return;
    const product = productForResource(resource);
    const publicUrl = resource.downloadUrl || resource.download_url || resource.publicDownloadUrl || "";
    if (product.salesStatus === "free" && publicUrl) {
      trackFaithEvent("resource_download", { resource_id: resourceId, product_id: product.id });
      window.location.assign(publicUrl);
      return;
    }
    try {
      if (!window.FaithAuth?.requestProtectedDownload) throw new Error("회원 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      const download = await window.FaithAuth.requestProtectedDownload(resourceId);
      trackFaithEvent("resource_download", { resource_id: resourceId, product_id: product.id });
      const count = openProtectedDownloads(download);
      setResourceActionStatus(count > 1 ? `${count}개 파일의 다운로드를 시작했습니다.` : "다운로드를 시작했습니다.");
    } catch (error) {
      setResourceActionStatus(error.message || "파일을 열 수 없습니다.");
    }
  }

  document.querySelectorAll("[data-resource-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeType = button.dataset.resourceTab || "pdf";
      activeTags.clear();
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      renderAll();
      document.querySelector("#faithResourceBrowser")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  tagRoot.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-tags]")) {
      activeTags.clear();
      renderAll();
      return;
    }
    const tagButton = event.target.closest("[data-resource-tag]");
    if (!tagButton) return;
    const tag = tagButton.dataset.resourceTag;
    if (activeTags.has(tag)) activeTags.delete(tag);
    else activeTags.add(tag);
    renderAll();
  });

  typeRoot?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-resource-filter-type]");
    if (!button) return;
    activeType = button.dataset.resourceFilterType || "all";
    renderAll();
  });

  searchInput?.addEventListener("input", (event) => {
    searchQuery = event.target.value;
    renderAll();
  });

  resetButton?.addEventListener("click", () => {
    activeTags.clear();
    searchQuery = "";
    if (searchInput) searchInput.value = "";
    renderAll();
  });

  listRoot.addEventListener("click", (event) => {
    if (event.target.closest("[data-reset-resource-search]")) {
      activeTags.clear();
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      renderAll();
      return;
    }
    const detailButton = event.target.closest("[data-resource-detail]");
    if (detailButton) {
      const resource = resources.find((item) => item.id === detailButton.dataset.resourceDetail);
      if (resource) openResourceDetail(resource);
      return;
    }
    const purchaseButton = event.target.closest("[data-product-purchase]");
    if (purchaseButton) {
      const productId = purchaseButton.dataset.productPurchase;
      trackFaithEvent("purchase_start", { product_id: productId });
      startProductPurchase(productId).catch((error) => {
        setResourceActionStatus(error.message || "결제 흐름을 열지 못했습니다. 자료 문의하기로 연락해 주세요.");
      });
      return;
    }
    if (event.target.closest("[data-resource-inquiry]")) return;
    const downloadButton = event.target.closest("[data-resource-download]");
    if (downloadButton) return downloadResource(downloadButton.dataset.resourceDownload);
  });

  document.querySelector("[data-close-thread]")?.addEventListener("click", () => {
    if (threadPanel) threadPanel.hidden = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("resource");
    window.history.replaceState({}, "", url);
  });

  threadPanel?.addEventListener("click", (event) => {
    const purchaseButton = event.target.closest("[data-product-purchase]");
    if (purchaseButton) {
      const productId = purchaseButton.dataset.productPurchase;
      trackFaithEvent("purchase_start", { product_id: productId });
      startProductPurchase(productId).catch((error) => {
        setResourceActionStatus(error.message || "결제 흐름을 열지 못했습니다. 자료 문의하기로 연락해 주세요.");
      });
      return;
    }
    const downloadButton = event.target.closest("[data-resource-download]");
    if (downloadButton) downloadResource(downloadButton.dataset.resourceDownload);
  });

  window.addEventListener("faith-auth-changed", async () => {
    viewer = await loadViewer();
    await refreshEntitlements();
    renderAll();
  });

  window.addEventListener("faith-auth-ready", async () => {
    await refreshEntitlements();
    renderAll();
  });

  (async () => {
    if (!new URLSearchParams(window.location.search).has("type")) {
      const url = new URL(window.location.href);
      url.searchParams.set("type", activeType);
      window.history.replaceState({}, "", url);
    }
    viewer = await loadViewer();
    window.FAITH_PRODUCT_CATALOG = await loadProductCatalog();
    const remoteResources = await loadResources(window.FAITH_PRODUCT_CATALOG);
    resources = remoteResources?.length ? remoteResources : fallbackResources;
    if (searchInput) searchInput.value = searchQuery;
    await refreshEntitlements();
    renderAll();
    const requestedResource = new URLSearchParams(window.location.search).get("resource");
    const resource = resources.find((item) => item.id === requestedResource);
    if (resource) openResourceDetail(resource);
  })();
})();

(() => {
  const form = document.querySelector(".signup-form");
  const client = window.FaithSupabase;
  if (!form) return;
  const email = form.querySelector("[name='email']");
  const password = form.querySelector("[name='password']");
  const status = form.querySelector("[data-member-auth-status]");
  const loginButton = form.querySelector("[data-member-login]");
  const logoutButton = form.querySelector("[data-member-logout]");
  const notice = document.querySelector("#memberAuthNotice");
  const setStatus = (message) => { if (status) status.textContent = message; };
  let noticeTimer;

  function showNotice(message, isError = false) {
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("is-error", isError);
    notice.hidden = false;
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => { notice.hidden = true; }, 6000);
  }

  async function refreshSession() {
    if (!client) return setStatus("회원 연결을 불러오지 못했습니다.");
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    logoutButton.hidden = false;
    setStatus(profile?.role === "admin" ? "관리자 계정으로 로그인되어 있습니다." : "로그인되어 있습니다. 구매한 자료는 내 자료실에서 확인할 수 있습니다.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) return setStatus("회원 연결을 불러오지 못했습니다.");
    if ((password.value || "").length < 8) return setStatus("비밀번호는 8자 이상으로 입력해 주세요.");
    const { data, error } = await client.auth.signUp({ email: email.value.trim(), password: password.value });
    if (error) {
      const message = "인증 메일을 보내지 못했습니다. 이메일 주소를 확인한 뒤 다시 시도해 주세요.";
      setStatus(message);
      showNotice(message, true);
      return;
    }
    const message = data.session
      ? "회원가입이 완료되었습니다. 바로 로그인되어 있습니다."
      : "인증 메일을 보냈습니다. 받은편지함에서 인증을 완료해 주세요.";
    setStatus(message);
    showNotice(message);
  });

  loginButton?.addEventListener("click", async () => {
    if (!client) return setStatus("회원 연결을 불러오지 못했습니다.");
    const { error } = await client.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (error) return setStatus(error.message);
    await refreshSession();
    window.dispatchEvent(new Event("faith-auth-changed"));
  });

  logoutButton?.addEventListener("click", async () => {
    await client?.auth.signOut();
    logoutButton.hidden = true;
    setStatus("로그아웃했습니다.");
    window.dispatchEvent(new Event("faith-auth-changed"));
  });

  refreshSession();
})();

(() => {
  const gate = document.querySelector("[data-admin-gate]");
  const panel = document.querySelector("[data-admin-panel]");
  const channelPanel = document.querySelector("[data-admin-channel-panel]");
  const client = window.FaithSupabase;
  if (!gate || !panel) return;
  const loginForm = document.querySelector("[data-admin-login-form]");
  const loginStatus = document.querySelector("[data-admin-auth-status]");
  const uploadForm = document.querySelector("[data-admin-resource-form]");
  const uploadStatus = document.querySelector("[data-admin-upload-status]");
  const dropzone = document.querySelector("[data-upload-dropzone]");
  const fileInput = uploadForm?.querySelector("[name='files']");
  const typeInput = uploadForm?.querySelector("[name='type']");
  const fileField = uploadForm?.querySelector("[data-admin-file-field]");
  const journeyNote = uploadForm?.querySelector("[data-admin-journey-note]");
  const saleStatusInput = uploadForm?.querySelector("[name='saleStatus']");
  const priceAmountInput = uploadForm?.querySelector("[name='priceAmount']");
  const fileSummary = document.querySelector("[data-upload-file-summary]");
  const resetPasswordButton = document.querySelector("[data-admin-reset-password]");
  const channelForm = document.querySelector("[data-admin-channel-form]");
  const channelStatus = document.querySelector("[data-admin-channel-status]");
  const channelList = document.querySelector("[data-admin-channel-list]");
  let adminUser = null;
  const setLoginStatus = (message) => { if (loginStatus) loginStatus.textContent = message; };
  const setUploadStatus = (message) => { if (uploadStatus) uploadStatus.textContent = message; };

  function updateFileSummary() {
    if (!fileSummary || !fileInput) return;
    const files = [...fileInput.files];
    fileSummary.textContent = files.length ? files.map((file) => file.name).join(", ") : "선택된 파일 없음";
  }

  async function refreshAdminAccess() {
    if (!client) return setLoginStatus("관리자 연결을 불러오지 못했습니다.");
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      adminUser = null;
      gate.hidden = false;
      panel.hidden = true;
      if (channelPanel) channelPanel.hidden = true;
      return;
    }
    const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      adminUser = null;
      gate.hidden = false;
      panel.hidden = true;
      if (channelPanel) channelPanel.hidden = true;
      return setLoginStatus("이 계정에는 관리자 권한이 없습니다.");
    }
    adminUser = user;
    gate.hidden = true;
    panel.hidden = false;
    if (channelPanel) channelPanel.hidden = false;
    await refreshChannelPosts();
  }

  async function refreshChannelPosts() {
    if (!client || !channelList || !adminUser) return;
    const { data, error } = await client.from("channel_posts").select("id,title,status,published_at,youtube_post_url").order("created_at", { ascending: false }).limit(30);
    if (error) {
      channelList.innerHTML = '<p class="muted">채널 소식 목록을 불러오지 못했습니다. 마이그레이션 적용 여부를 확인해 주세요.</p>';
      return;
    }
    channelList.innerHTML = data?.length ? data.map((post) => `<article><strong>${escapeHtml(post.title)}</strong><span>${escapeHtml(post.status)}${post.published_at ? ` · ${escapeHtml(post.published_at.slice(0, 10))}` : ""}</span>${post.youtube_post_url ? `<a href="${escapeHtml(post.youtube_post_url)}" target="_blank" rel="noopener">유튜브 게시물 보기</a>` : ""}</article>`).join("") : '<p class="muted">등록한 채널 소식이 없습니다.</p>';
  }

  function safeFileName(name) {
    return name.normalize("NFKD").replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").replace(/-+/g, "-");
  }

  function filesMatchType(type, files) {
    if (type === "journey") return files.length === 0;
    if (!files.length) return false;
    if (type === "pdf") return files.length === 1 && (files[0].type === "application/pdf" || /\.pdf$/i.test(files[0].name));
    if (type === "audio") return files.length === 1 && (/^audio\//.test(files[0].type) || /\.mp3$/i.test(files[0].name));
    return files.every((file) => /^image\//.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name));
  }

  function syncProductSaleFields() {
    if (!saleStatusInput || !priceAmountInput) return;
    const purchasable = saleStatusInput.value === "available";
    priceAmountInput.disabled = !purchasable;
    priceAmountInput.required = purchasable;
    if (!purchasable) priceAmountInput.value = "";
  }

  function syncResourceTypeFields() {
    if (!typeInput || !fileInput) return;
    const isJourney = typeInput.value === "journey";
    fileInput.required = !isJourney;
    fileInput.disabled = isJourney;
    if (isJourney) fileInput.value = "";
    if (fileField) fileField.hidden = isJourney;
    if (dropzone) dropzone.hidden = isJourney;
    if (journeyNote) journeyNote.hidden = !isJourney;
    updateFileSummary();
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) return setLoginStatus("관리자 연결을 불러오지 못했습니다.");
    const formData = new FormData(loginForm);
    const { error } = await client.auth.signInWithPassword({ email: formData.get("email"), password: formData.get("password") });
    if (error) return setLoginStatus(error.message);
    await refreshAdminAccess();
  });

  resetPasswordButton?.addEventListener("click", async () => {
    if (!client || !loginForm) return setLoginStatus("관리자 연결을 불러오지 못했습니다.");
    const email = loginForm.elements.email.value.trim();
    if (!email) return setLoginStatus("재설정할 이메일을 입력해 주세요.");
    const redirectTo = new URL("reset-password.html", window.location.href).href;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    setLoginStatus(error ? error.message : "비밀번호 재설정 메일을 보냈습니다. 메일의 링크에서 새 비밀번호를 설정해 주세요.");
  });

  document.querySelector("[data-admin-logout]")?.addEventListener("click", async () => {
    await client?.auth.signOut();
    await refreshAdminAccess();
  });

  channelForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client || !adminUser) return;
    const data = new FormData(channelForm);
    const status = String(data.get("status") || "draft");
    const payload = {
      title: String(data.get("title") || "").trim(),
      body: String(data.get("body") || "").trim(),
      related_video_id: String(data.get("relatedVideoId") || "").trim() || null,
      youtube_post_url: String(data.get("youtubePostUrl") || "").trim() || null,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
      created_by: adminUser.id
    };
    const { error } = await client.from("channel_posts").insert(payload);
    if (channelStatus) channelStatus.textContent = error ? "채널 소식을 저장하지 못했습니다." : "채널 소식을 저장했습니다.";
    if (!error) { channelForm.reset(); await refreshChannelPosts(); }
  });

  fileInput?.addEventListener("change", updateFileSummary);
  saleStatusInput?.addEventListener("change", syncProductSaleFields);
  typeInput?.addEventListener("change", syncResourceTypeFields);
  syncProductSaleFields();
  syncResourceTypeFields();
  dropzone?.addEventListener("click", () => { if (!fileInput?.disabled) fileInput?.click(); });
  dropzone?.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !fileInput?.disabled) fileInput?.click();
  });
  ["dragenter", "dragover"].forEach((eventName) => dropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => dropzone?.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  }));
  dropzone?.addEventListener("drop", (event) => {
    if (!fileInput || fileInput.disabled || !event.dataTransfer?.files.length) return;
    fileInput.files = event.dataTransfer.files;
    updateFileSummary();
  });

  uploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client || !adminUser || !fileInput) return setUploadStatus("관리자 로그인이 필요합니다.");
    const formData = new FormData(uploadForm);
    const type = String(formData.get("type"));
    const files = [...fileInput.files];
    if (!["pdf", "audio", "card", "journey"].includes(type)) return setUploadStatus("자료 유형을 확인해 주세요.");
    if (!filesMatchType(type, files)) return setUploadStatus(type === "card" ? "카드 자료에는 이미지 파일을 선택해 주세요." : "선택한 자료 유형에 맞는 파일 한 개를 선택해 주세요.");
    const tags = String(formData.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!tags.length) return setUploadStatus("키워드를 하나 이상 입력해 주세요.");
    const productId = String(formData.get("productId") || "").trim();
    if (!/^[A-Za-z0-9_-]{2,120}$/.test(productId)) return setUploadStatus("상품 ID는 영문, 숫자, 밑줄, 하이픈으로 2~120자 입력해 주세요.");
    const saleStatus = String(formData.get("saleStatus") || "inquiry");
    if (!["inquiry", "unavailable", "available"].includes(saleStatus)) return setUploadStatus("판매 상태를 확인해 주세요.");
    const priceInput = String(formData.get("priceAmount") || "").trim();
    const priceAmount = priceInput ? Number(priceInput) : null;
    if (saleStatus === "available" && (!Number.isInteger(priceAmount) || priceAmount <= 0)) return setUploadStatus("온라인 구매 가능 자료에는 올바른 판매 가격을 입력해 주세요.");
    if (saleStatus !== "available" && priceInput) return setUploadStatus("문의 안내 또는 판매 비노출 자료에는 가격을 입력하지 않아야 합니다.");
    const previewItems = String(formData.get("previewItems") || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
    const title = String(formData.get("title")).trim();
    const summary = String(formData.get("summary")).trim();
    const productPayload = {
      id: productId,
      resource_id: null,
      type,
      title,
      summary,
      preview_items: previewItems,
      sale_status: saleStatus,
      price_amount: saleStatus === "available" ? priceAmount : null,
      currency: "KRW",
      purchasable: saleStatus === "available",
      published: true
    };
    if (type === "journey") {
      setUploadStatus("기도 여정 상품을 등록하고 있습니다.");
      const { error: journeyError } = await client.from("faith_products").insert(productPayload);
      if (journeyError) return setUploadStatus(`기도 여정 상품을 등록하지 못했습니다. ${journeyError.message}`);
      uploadForm.reset();
      syncProductSaleFields();
      syncResourceTypeFields();
      setUploadStatus("기도 여정 상품 계약을 등록하고 발행했습니다.");
      return;
    }
    setUploadStatus("자료와 파일을 저장하고 있습니다.");
    const { data: resource, error: resourceError } = await client.from("faith_resources").insert({
      type,
      title,
      summary,
      tags,
      created_by: adminUser.id
    }).select("id").single();
    if (resourceError) return setUploadStatus(resourceError.message);
    const { error: detailError } = await client.from("faith_resource_private_details").insert({
      resource_id: resource.id,
      description: String(formData.get("description")).trim(),
      preview_items: previewItems,
      gallery_items: files.map((file) => file.name)
    });
    if (detailError) return setUploadStatus(detailError.message);
    const fileRows = [];
    for (const [index, file] of files.entries()) {
      const objectPath = `${resource.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const { error: uploadError } = await client.storage.from("faith-resources").upload(objectPath, file, { cacheControl: "3600", contentType: file.type || undefined, upsert: false });
      if (uploadError) return setUploadStatus(uploadError.message);
      fileRows.push({ resource_id: resource.id, object_path: objectPath, file_name: file.name, mime_type: file.type || "application/octet-stream", file_size: file.size, sort_order: index });
    }
    const { error: fileError } = await client.from("resource_files").insert(fileRows);
    if (fileError) return setUploadStatus(fileError.message);
    const { error: productError } = await client.from("faith_products").insert({
      ...productPayload,
      resource_id: resource.id,
      published: false
    });
    if (productError) return setUploadStatus(`상품 계약을 저장하지 못했습니다. ${productError.message}`);
    const { error: publishError } = await client.from("faith_resources").update({ published: true, updated_at: new Date().toISOString() }).eq("id", resource.id);
    if (publishError) return setUploadStatus(publishError.message);
    const { error: productPublishError } = await client.from("faith_products").update({ published: true }).eq("id", productId);
    if (productPublishError) return setUploadStatus(`자료는 등록되었지만 상품 발행을 완료하지 못했습니다. ${productPublishError.message}`);
    uploadForm.reset();
    syncProductSaleFields();
    syncResourceTypeFields();
    updateFileSummary();
    setUploadStatus("자료와 상품 계약을 등록하고 발행했습니다.");
  });

  window.addEventListener("faith-auth-changed", refreshAdminAccess);
  refreshAdminAccess();
})();

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

(() => {
  const productInput = document.querySelector("[data-contact-product-id]");
  const productId = new URLSearchParams(window.location.search).get("product");
  if (productInput && productId && /^[A-Za-z0-9_-]{2,120}$/.test(productId)) productInput.value = productId;
})();

function normalizeSiteNav() {
  const nav = document.getElementById("site-nav");
  if (!nav) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("category") === "감사") nav.querySelector('[data-nav-section="prayer"] .site-nav-summary')?.classList.add("active");
  nav.querySelectorAll("details").forEach((details) => details.addEventListener("toggle", () => {
    if (!details.open) return;
    nav.querySelectorAll("details").forEach((other) => { if (other !== details) other.open = false; });
  }));
}

normalizeSiteNav();
(() => {
  const root = document.getElementById("homeCommunityPreview");
  if (!root) return;

  const dateText = (value) => value ? new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(value)) : "";
  const render = (posts = [], message = "") => {
    root.setAttribute("aria-busy", "false");
    if (posts.length) {
      const labels = { prayer: "기도제목", gratitude: "감사 나눔", pain: "아픔나눔" };
      root.innerHTML = posts.map((post) => `<article><span>${escapeHtml(labels[post.category] || "나눔")} · ${escapeHtml(dateText(post.created_at))}</span><strong>${escapeHtml(post.title)}</strong><p>${escapeHtml(post.body).slice(0, 72)}${post.body.length > 72 ? "…" : ""}</p><a class="text-link" href="community.html?post=${encodeURIComponent(post.id)}">이야기 보기</a></article>`).join("");
      return;
    }
    root.innerHTML = `<p>${escapeHtml(message || "최근 나눔은 소통게시판에서 확인할 수 있습니다.")}</p>`;
  };

  async function loadCommunityPreview() {
    try {
      const client = window.FaithAuth?.getClient ? await window.FaithAuth.getClient() : window.FaithSupabase;
      if (!client) return render([], "최근 나눔은 소통게시판에서 확인할 수 있습니다.");
      const { data, error } = await client
        .from("community_posts")
        .select("id,category,title,body,created_at")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) return render([], "최근 나눔은 소통게시판에서 확인할 수 있습니다.");
      render(data || []);
    } catch {
      render([], "최근 나눔은 소통게시판에서 확인할 수 있습니다.");
    }
  }

  if (window.FaithAuth?.getClient || window.FaithSupabase) loadCommunityPreview();
  else window.addEventListener("faith-auth-ready", loadCommunityPreview, { once: true });
})();
(() => {
  const dailyWords = Array.isArray(window.DAILY_WORDS) ? window.DAILY_WORDS : [];
  const categories = Array.isArray(window.PRAYER_CATEGORIES) ? window.PRAYER_CATEGORIES : [];
  if (!dailyWords.length) return;

  const categoryOrder = ["word", "morning", "night", "video", "resource"];
  const legacyCategoryMap = {
    night: { id: "evening", label: "저녁기도", pageUrl: "night-prayer.html", icon: "moon", description: "하루를 내려놓고 잠들기 전 평안을 구하는 기도입니다.", colorKey: "evening" },
    video: { id: "video", label: "기도(유튜브)", pageUrl: "videos.html", icon: "play", description: "기도의샘물 유튜브 채널의 말씀과 기도 영상입니다.", colorKey: "video" }
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
    light: '<path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-.8.7-1.2 1.5-1.3 2.5H9.3C9.2 15.5 8.8 14.7 8 14z"></path>',
    community: '<path d="M5 19.5A8.5 8.5 0 1 1 20 14H9l-4 4z"></path><path d="M8 11h.01M12 11h.01M16 11h.01"></path>'
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

  function resourceSearchCard(resource) {
    const typeLabel = resource.type === "audio" ? "기도 오디오" : resource.type === "card" ? "말씀·기도카드" : "기도문 PDF";
    return `<article class="archive-word-card home-resource-search-card"><div class="archive-card-meta"><span>신앙자료</span><span>${text(typeLabel)}</span></div><h3>${text(resource.title)}</h3><p>${text(resource.summary)}</p>${tagsHtml(resource.tags || [])}<a class="text-link" href="prayer-cards.html?resource=${encodeURIComponent(resource.id)}">자료 구성 보기</a></article>`;
  }

  function searchFaithResources(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const resources = Array.isArray(window.FAITH_RESOURCES) ? window.FAITH_RESOURCES : [];
    return resources.filter((resource) => [resource.title, resource.summary, ...(resource.tags || [])].join(" ").toLowerCase().includes(normalized));
  }

  function renderHomeSearch(query = "") {
    const root = document.getElementById("homeSearchResults");
    if (!root) return;
    const words = query ? searchItems(query).slice(0, 6) : sorted(dailyWords).slice(0, 4);
    const resources = query ? searchFaithResources(query).slice(0, 4) : [];
    const cards = [...words.map(archiveCard), ...resources.map(resourceSearchCard)];
    root.innerHTML = cards.length ? cards.join("") : emptySearchMessage();
  }

  function renderArchivePage(query = "", category = "all") {
    const root = document.getElementById("archiveResults");
    if (!root) return;
    const items = searchItems(query, category);
    root.innerHTML = items.length ? items.map(archiveCard).join("") : emptySearchMessage();
  }

  function decorateNavIcons() {
    normalizeSiteNav();
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

  decorateNavIcons();
  renderToday();
  renderCategoryPreview();
  renderVisualHub();
  updateHomeFilter("all");
  renderHomeSearch();

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
    return formatDate(new Date(parts.hour < 6 ? base - 86400000 : base));
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

  function dateLabel(value) {
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value}T00:00:00+09:00`));
  }

  function categoryRecentRow(item) {
    const url = new URL(window.location.href);
    url.searchParams.set("date", item.date);
    url.hash = "dailyContentCard";
    const displayDate = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(`${item.date}T00:00:00+09:00`));
    return `<a class="category-recent-row" href="${safeText(`${url.pathname}${url.search}${url.hash}`)}" data-history-date="${safeText(item.date)}">
      <time datetime="${safeText(item.date)}">${safeText(displayDate)}</time>
      <span><strong>${safeText(item.title)}</strong><small>${safeText(item.scriptureRef || item.summary || "")}</small></span>
    </a>`;
  }

  function historyPageHref(page) {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(page));
    url.hash = "recentCategoryContents";
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function renderRecent(category, requestedPage = 1, pageSize = 10) {
    const root = document.getElementById("recentCategoryContents");
    const pagination = document.getElementById("categoryHistoryPagination");
    if (!root) return;
    const allItems = contentsFor(category);
    const pageCount = Math.max(1, Math.ceil(allItems.length / pageSize));
    const page = Math.min(pageCount, Math.max(1, Number(requestedPage) || 1));
    const items = allItems.slice((page - 1) * pageSize, page * pageSize);
    root.className = "category-recent-list";
    root.innerHTML = items.length
      ? items.map(categoryRecentRow).join("")
      : `<p class="muted">아직 지난 자료가 없습니다.</p>`;

    root.querySelectorAll("[data-history-date]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const date = link.dataset.historyDate || displayDateSeoul();
        updateSelectedDate(date);
        renderCategory(category, date, { focus: true });
      });
    });

    if (!pagination) return;
    if (pageCount <= 1) {
      pagination.innerHTML = "";
      return;
    }
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
    pagination.innerHTML = `${page > 1 ? `<a href="${safeText(historyPageHref(page - 1))}" aria-label="이전 페이지">이전</a>` : '<span aria-hidden="true">이전</span>'}
      <div>${pages.map((number) => number === page
        ? `<a class="is-current" href="${safeText(historyPageHref(number))}" aria-current="page">${number}</a>`
        : `<a href="${safeText(historyPageHref(number))}">${number}</a>`).join("")}</div>
      ${page < pageCount ? `<a href="${safeText(historyPageHref(page + 1))}" aria-label="다음 페이지">다음</a>` : '<span aria-hidden="true">다음</span>'}`;
  }

  function updateSelectedDate(date, { replace = false } = {}) {
    const url = new URL(window.location.href);
    url.searchParams.set("date", date);
    url.hash = "dailyContentCard";
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
  }

  function closeDateDialog({ restoreFocus = true } = {}) {
    const dialog = document.querySelector("[data-date-picker-dialog]");
    const trigger = document.querySelector("[data-date-picker-open]");
    if (dialog?.open) {
      dialog.dataset.restoreFocus = String(restoreFocus);
      dialog.close();
      return;
    }
    if (restoreFocus) trigger?.focus();
  }

  function renderCalendar(category, selectedDate = displayDateSeoul()) {
    const root = document.getElementById("categoryCalendar");
    if (!root) return;
    const dates = new Set(contentsFor(category).map((item) => item.date));
    const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : displayDateSeoul();
    const selectedParts = safeDate.split("-").map(Number);
    let year = selectedParts[0];
    let month = selectedParts[1];

    function draw() {
      const first = new Date(Date.UTC(year, month - 1, 1));
      const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const startDay = first.getUTCDay();
      const cells = [];
      for (let index = 0; index < startDay; index += 1) cells.push('<span class="calendar-blank" aria-hidden="true"></span>');
      for (let day = 1; day <= lastDate; day += 1) {
        const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const active = dates.has(date);
        cells.push(`<button type="button" class="calendar-day${date === safeDate ? " selected" : ""}" ${active ? 'data-has-content="true"' : "disabled"} data-date="${date}" aria-label="${dateLabel(date)}${active ? " 콘텐츠 보기" : " 콘텐츠 없음"}">${day}</button>`);
      }
      root.innerHTML = `<div class="calendar-toolbar">
        <button type="button" class="calendar-month-button" data-month-prev aria-label="이전 달 보기">‹</button>
        <strong>${year}년 ${month}월</strong>
        <button type="button" class="calendar-month-button" data-month-next aria-label="다음 달 보기">›</button>
      </div>
      <div class="calendar-weekdays" aria-hidden="true"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
      <div class="calendar-grid">${cells.join("")}</div>
      <p class="calendar-legend"><span aria-hidden="true"></span> 콘텐츠가 있는 날짜만 선택할 수 있습니다.</p>`;
      root.querySelector("[data-month-prev]")?.addEventListener("click", () => {
        month -= 1;
        if (month < 1) { month = 12; year -= 1; }
        draw();
      });
      root.querySelector("[data-month-next]")?.addEventListener("click", () => {
        month += 1;
        if (month > 12) { month = 1; year += 1; }
        draw();
      });
      root.querySelectorAll(".calendar-day:not(:disabled)").forEach((button) => {
        button.addEventListener("click", () => {
          const nextDate = button.dataset.date || displayDateSeoul();
          updateSelectedDate(nextDate);
          renderCategory(category, nextDate, { focus: true });
          closeDateDialog({ restoreFocus: false });
        });
      });
    }
    draw();
  }

  function setupDatePickerDialog() {
    const dialog = document.querySelector("[data-date-picker-dialog]");
    const trigger = document.querySelector("[data-date-picker-open]");
    if (!dialog || !trigger || dialog.dataset.ready === "true") return;
    dialog.dataset.ready = "true";
    trigger.addEventListener("click", () => {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      window.requestAnimationFrame(() => dialog.querySelector(".calendar-day.selected:not(:disabled), .calendar-day:not(:disabled)")?.focus());
    });
    dialog.querySelector("[data-date-picker-close]")?.addEventListener("click", () => closeDateDialog());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDateDialog();
    });
    dialog.addEventListener("close", () => {
      const restoreFocus = dialog.dataset.restoreFocus !== "false";
      delete dialog.dataset.restoreFocus;
      if (restoreFocus) window.requestAnimationFrame(() => trigger.focus());
    });
  }

  function renderCategory(category, date = displayDateSeoul(), { focus = false } = {}) {
    const root = document.getElementById("dailyContentCard");
    if (!root) return;
    const item = pickContent(category, date);
    root.innerHTML = dailyCard(item);
    root.setAttribute("tabindex", "-1");
    const selectedDate = item?.date || date;
    const selectedDateRoot = document.getElementById("selectedContentDate");
    if (selectedDateRoot) selectedDateRoot.textContent = selectedDate ? `선택: ${dateLabel(selectedDate)}` : "";
    renderCalendar(category, selectedDate);
    const requestedPage = new URLSearchParams(window.location.search).get("page") || "1";
    renderRecent(category, Number(requestedPage), 10);
    if (focus) window.requestAnimationFrame(() => root.focus({ preventScroll: true }));
  }

  const categoryRoot = document.querySelector("[data-daily-category]");
  if (categoryRoot) {
    const category = categoryRoot.dataset.dailyCategory || "word";
    setupDatePickerDialog();
    const dateParam = new URLSearchParams(window.location.search).get("date") || "";
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : displayDateSeoul();
    renderCategory(category, requestedDate);
    window.addEventListener("popstate", () => {
      const nextDateParam = new URLSearchParams(window.location.search).get("date") || "";
      const date = /^\d{4}-\d{2}-\d{2}$/.test(nextDateParam) ? nextDateParam : displayDateSeoul();
      renderCategory(category, date);
    });
  }
})();
