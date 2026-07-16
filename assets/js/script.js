const $ = (selector) => document.querySelector(selector);

// 공개 페이지 어디에서나 동일한 로그인/회원가입 UI를 사용할 수 있도록 한 번만 로드합니다.
(() => {
  if (window.__faithMemberScriptLoaded) return;
  window.__faithMemberScriptLoaded = true;
  const script = document.createElement("script");
  script.src = new URL("assets/js/faith-member.js?v=20260715-pdf-sales2", window.location.href).href;
  script.async = true;
  document.head.append(script);
})();

function normalizeSiteCategoryNav() {
  const navRoot = document.getElementById("site-nav");
  if (!navRoot) return;

  const pathPage = window.location.pathname.split("/").pop() || "index.html";
  const currentPage = pathPage === "index.html" || pathPage.includes(".") ? pathPage : `${pathPage}.html`;
  const currentParams = new URLSearchParams(window.location.search);
  if (currentPage === "prayers.html" && currentParams.get("category") === "감사") {
    window.location.replace(`gratitude-prayer.html${window.location.hash || ""}`);
    return;
  }

  const groups = [
    {
      id: "bible",
      title: "성경말씀",
      href: "meditation.html",
      pages: ["meditation.html", "prayers.html"],
      links: [
        ["meditation.html", "큐티(QT)"],
        ["prayers.html", "말씀 붙들기"]
      ]
    },
    {
      id: "prayer",
      title: "기도",
      href: "gratitude-prayer.html",
      pages: ["gratitude-prayer.html", "night-prayer.html", "morning-prayer.html"],
      links: [
        ["gratitude-prayer.html", "감사기도"],
        ["night-prayer.html", "저녁기도"],
        ["morning-prayer.html", "아침기도"]
      ]
    },
    {
      id: "community",
      title: "나눔게시판",
      href: "community.html",
      pages: ["community.html", "community-write.html"],
      links: []
    },
    {
      id: "youtube",
      title: "유튜브",
      href: "videos.html",
      pages: ["videos.html"],
      links: [
        ["videos.html?tab=videos", "영상"],
        ["videos.html?tab=posts", "채널 소식"]
      ]
    },
    {
      id: "resources",
      title: "신앙자료",
      href: "prayer-cards?type=all",
      pages: ["prayer-cards.html", "premium-pdf.html", "prayer-pdf-library.html", "prayer-audiobook.html", "prayer-card-library.html", "prayer-challenge.html"],
      links: [
        ["premium-pdf.html", "기도문 PDF"],
        ["prayer-audiobook.html", "기도 오디오북"],
        ["prayer-card-library.html", "기도카드"]
      ]
    }
  ];

  const isCurrentLink = (href) => {
    const target = new URL(href, window.location.href);
    const targetPage = target.pathname.split("/").pop() || "index.html";
    if (targetPage !== currentPage) return false;
    if (target.searchParams.size === 0) return true;
    for (const [key, value] of target.searchParams) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  };

  const activeGroup = groups.find((group) => group.pages.includes(currentPage));
  navRoot.innerHTML = `<div class="site-nav-map">
    <div class="site-nav-primary" aria-label="상위 카테고리">${groups.map((group) => {
      const groupActive = group === activeGroup;
      const panelId = `site-nav-panel-${group.id}`;
      const hasChildren = group.links.length > 0;
      const directLink = group.id === "resources";
      const parentAttributes = hasChildren
        ? ` aria-haspopup="true" aria-expanded="false" aria-controls="${panelId}"`
        : "";
      const panel = hasChildren
        ? `<div id="${panelId}" class="site-nav-dropdown-panel" aria-label="${group.title} 하위 메뉴">${group.links.map(([href, label]) => {
            const active = isCurrentLink(href);
            return `<a href="${href}"${active ? ' class="active" aria-current="page"' : ""}>${label}</a>`;
          }).join("")}</div>`
        : "";
      return `<div class="site-nav-dropdown${groupActive ? " active" : ""}" data-nav-dropdown>
        <a class="site-nav-parent-link${groupActive ? " active" : ""}" href="${group.href}" data-nav-section="${group.id}"${directLink ? " data-nav-direct" : ""}${groupActive ? ' aria-current="page"' : ""}${parentAttributes}>${group.title}${hasChildren ? '<span class="site-nav-chevron" aria-hidden="true">⌄</span>' : ""}</a>
        ${panel}
      </div>`;
    }).join("")}</div>
  </div>`;
}

normalizeSiteCategoryNav();

function ensureLegalBusinessName() {
  document.querySelectorAll(".site-footer").forEach((footer) => {
    if (footer.querySelector(".footer-business-name")) return;
    const nav = footer.querySelector(".minimal-footer-nav");
    if (!nav) return;
    const businessName = document.createElement("p");
    businessName.className = "footer-business-name";
    businessName.textContent = "상호명: 몽자몰(mongzamall)";
    nav.prepend(businessName);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensureLegalBusinessName, { once: true });
} else {
  ensureLegalBusinessName();
}

(() => {
  const navRoot = document.getElementById("site-nav");
  if (!navRoot) return;
  const dropdowns = [...navRoot.querySelectorAll("[data-nav-dropdown]")].filter((item) => item.querySelector(".site-nav-dropdown-panel"));
  const closeTimers = new WeakMap();
  const closeDelay = 200;
  let lastOpened = null;

  const clearCloseTimer = (dropdown) => {
    const timer = closeTimers.get(dropdown);
    if (timer) window.clearTimeout(timer);
    closeTimers.delete(dropdown);
  };

  const setOpen = (dropdown, open, { restoreFocus = false, method = "" } = {}) => {
    if (!dropdown) return;
    clearCloseTimer(dropdown);
    dropdown.classList.toggle("is-open", open);
    if (open && method) dropdown.dataset.openMethod = method;
    if (!open) delete dropdown.dataset.openMethod;
    const trigger = dropdown.querySelector(".site-nav-parent-link");
    trigger?.setAttribute("aria-expanded", String(open));
    if (open) lastOpened = dropdown;
    if (!open && restoreFocus) trigger?.focus();
  };

  const closeOthers = (except = null) => {
    dropdowns.forEach((dropdown) => {
      if (dropdown !== except) setOpen(dropdown, false);
    });
  };

  const scheduleClose = (dropdown) => {
    clearCloseTimer(dropdown);
    closeTimers.set(dropdown, window.setTimeout(() => {
      const stillHovered = dropdown.matches(":hover");
      const stillFocused = dropdown.contains(document.activeElement);
      if (!stillHovered && !stillFocused) setOpen(dropdown, false);
    }, closeDelay));
  };

  dropdowns.forEach((dropdown) => {
    const trigger = dropdown.querySelector(".site-nav-parent-link");
    const panel = dropdown.querySelector(".site-nav-dropdown-panel");

    dropdown.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      clearCloseTimer(dropdown);
      closeOthers(dropdown);
      if (!dropdown.classList.contains("is-open")) setOpen(dropdown, true, { method: "hover" });
    });
    dropdown.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch") return;
      if (dropdown.dataset.openMethod === "click") return;
      scheduleClose(dropdown);
    });
    dropdown.addEventListener("focusout", () => scheduleClose(dropdown));

    trigger?.addEventListener("click", (event) => {
      const directLink = trigger.hasAttribute("data-nav-direct");
      const compactNavigation = window.matchMedia("(max-width: 860px)").matches;
      if (directLink && !compactNavigation) return;
      if (directLink && dropdown.classList.contains("is-open") && dropdown.dataset.openMethod === "click") return;
      event.preventDefault();
      if (directLink) event.stopPropagation();
      if (dropdown.classList.contains("is-open") && dropdown.dataset.openMethod === "hover") {
        dropdown.dataset.openMethod = "click";
        return;
      }
      const nextOpen = directLink || !dropdown.classList.contains("is-open");
      closeOthers(dropdown);
      setOpen(dropdown, nextOpen, { method: "click" });
    });
    trigger?.addEventListener("keydown", (event) => {
      if (trigger.hasAttribute("data-nav-direct")) return;
      if (event.key === "Enter") {
        event.preventDefault();
        const nextOpen = !dropdown.classList.contains("is-open");
        closeOthers(dropdown);
        setOpen(dropdown, nextOpen, { method: "keyboard" });
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(dropdown, false, { restoreFocus: true });
      }
    });
    panel?.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeOthers();
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("#site-nav")) closeOthers();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const opened = dropdowns.find((dropdown) => dropdown.classList.contains("is-open")) || lastOpened;
    if (!opened?.classList.contains("is-open")) return;
    event.preventDefault();
    setOpen(opened, false, { restoreFocus: true });
  });
  window.addEventListener("resize", () => closeOthers());
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
    marketingDetails: product.marketingDetails ?? product.marketing_details ?? {},
    basePrintCopies: Number(product.basePrintCopies ?? product.base_print_copies ?? 1),
    printPackSize: Number(product.printPackSize ?? product.print_pack_size ?? 10),
    printPackPrice: Number(product.printPackPrice ?? product.print_pack_price ?? 0),
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

function calculatePrintLicense(product, requestedCopies) {
  const normalized = normalizeFaithProduct(product);
  const base = Math.max(1, Number(normalized.basePrintCopies || 1));
  const packSize = Math.max(1, Number(normalized.printPackSize || 10));
  const packPrice = Math.max(0, Number(normalized.printPackPrice || 0));
  const requested = Math.max(1, Math.min(10000, Math.floor(Number(requestedCopies || base))));
  const packs = Math.ceil(Math.max(0, requested - base) / packSize);
  return { requested, licensed: base + packs * packSize, surcharge: packs * packPrice, total: Number(normalized.priceKrw || 0) + packs * packPrice };
}

async function requestProductPurchase(productId, printCopies = null) {
  if (window.FaithAuth?.requestPurchase) {
    return window.FaithAuth.requestPurchase(productId, printCopies);
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("회원 서비스를 불러오지 못했습니다. 자료 문의하기를 이용해 주세요.")), 5000);
    window.addEventListener("faith-auth-ready", async () => {
      window.clearTimeout(timer);
      try {
        if (!window.FaithAuth?.requestPurchase) throw new Error("회원 서비스를 불러오지 못했습니다. 자료 문의하기를 이용해 주세요.");
        resolve(await window.FaithAuth.requestPurchase(productId, printCopies));
      } catch (error) {
        reject(error);
      }
    }, { once: true });
  });
}

async function startProductPurchase(productId, printCopies = null) {
  const result = await requestProductPurchase(productId, printCopies);
  if (!result?.alreadyPurchased) return result;
  if (!result.resourceId || !window.FaithAuth?.requestProtectedDownload) {
    window.location.assign("account.html");
    return result;
  }
  const download = await window.FaithAuth.requestProtectedDownload(result.resourceId);
  trackFaithEvent("resource_download", { resource_id: result.resourceId, product_id: productId, repeat: true });
  await openProtectedDownloads(download);
  return result;
}

async function openProtectedDownloads(download) {
  if (window.FaithAuth?.startProtectedDownloads) return window.FaithAuth.startProtectedDownloads(download);
  const file = download?.downloads?.[0] || download;
  if (!file?.url) throw new Error("다운로드 링크를 찾지 못했습니다.");
  const response = await fetch(file.url, { credentials: "omit" });
  if (!response.ok) throw new Error("파일을 내려받지 못했습니다. 잠시 후 다시 시도해 주세요.");
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = String(file.fileName || "faith-resource-download").replace(/[\\/:*?"<>|]/g, "-");
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
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
renderList("gratitudeList", sitePrayers.filter((p) => p.category === "감사" || p.tags?.includes("감사")));
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

const rawVideoData = window.VIDEOS || (typeof VIDEOS !== "undefined" ? VIDEOS : []);
const videoData = [...rawVideoData].sort((a, b) => String(b.publishedAt || b.publishedDate || "").localeCompare(String(a.publishedAt || a.publishedDate || "")));
const featuredVideo = videoData.find((video) => video.isShort !== true);
const homeVideoData = featuredVideo
  ? [featuredVideo, ...videoData.filter((video) => video.videoId !== featuredVideo.videoId)]
  : [];
const videoList = $("#videoList");
if (videoList) videoList.innerHTML = videoData.map((video) => videoCard(video, { inline: true })).join("");
const homeVideos = $("#homeVideos");
if (homeVideos) homeVideos.innerHTML = homeVideoData.slice(0, 3).map(videoCard).join("");

(() => {
  const qtRoot = document.getElementById("homeQtPreview");
  const prayerRoot = document.getElementById("homePrayerPreview");
  if (!qtRoot || !prayerRoot) return;
  const items = Array.isArray(window.DAILY_CONTENTS) ? window.DAILY_CONTENTS : [];
  const seoulNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const targetDate = new Date(seoulNow);
  if (seoulNow.getHours() < 4) targetDate.setDate(targetDate.getDate() - 1);
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
  renderFeaturedVideo(featuredVideo);
  const filters = [...document.querySelectorAll("[data-video-filter]")];
  const draw = (filter = "all") => {
    const list = filter === "videos"
      ? videoData.filter((video) => video.isShort !== true)
      : filter === "shorts"
        ? videoData.filter((video) => video.isShort === true)
        : videoData;
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
      : homeVideoData.slice(0, 3).map((video, index) => videoCard(video, { inline: true, featured: index === 0 })).join("");
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
    .select("id, resource_id, type, title, summary, preview_items, sale_status, price_amount, currency, purchasable, published, marketing_details, base_print_copies, print_pack_size, print_pack_price")
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
        .select("id, resource_id, type, title, summary, preview_items, sale_status, price_amount, currency, purchasable, published, marketing_details, base_print_copies, print_pack_size, print_pack_price")
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
  const client = window.FaithSupabase;
  const listRoot = $("#faithResourceList");
  const tagRoot = $("#faithResourceTags");
  const filterStatus = $("#faithResourceFilterStatus");
  const actionStatus = $("#faithResourceActionStatus");
  const typeRoot = $("#faithResourceTypes");
  const searchInput = $("#faithResourceSearch");
  const resetButton = $("#faithResourceReset");
  const threadPanel = $("#cardThreadDetail");
  const currentResourceRoute = (window.location.pathname.split("/").pop() || "").replace(/\.html$/i, "");
  document.querySelector("[data-pdf-guide-link]")?.addEventListener("click", () => trackFaithEvent("pdf_guide_view", { source: currentResourceRoute || "premium_pdf" }));
  document.querySelectorAll("[data-pdf-library-link]").forEach((link) => {
    link.addEventListener("click", () => trackFaithEvent("pdf_library_view", { source: link.dataset.pdfLibraryLink || currentResourceRoute || "premium_pdf" }));
  });
  if (currentResourceRoute === "premium-pdf" && (!listRoot || !tagRoot)) {
    const legacyResourceId = new URLSearchParams(window.location.search).get("resource");
    if (legacyResourceId) {
      const target = new URL("prayer-pdf-library.html", window.location.href);
      target.search = window.location.search;
      target.searchParams.set("type", "pdf");
      window.location.replace(target);
    }
    return;
  }
  if (!listRoot || !tagRoot) return;

  const typeMeta = {
    all: {
      title: "신앙자료",
      eyebrow: "신앙생활을 돕는 자료",
      hero: "말씀과 기도를 오래 곁에 두는 자료",
      description: "기도문 PDF, 기도 오디오북, 기도카드 가운데 실제로 등록된 자료만 차분히 소개합니다.",
      empty: "현재 공개된 회원 자료가 없습니다.",
      placeholder: "예: 자녀, 가정, 위로"
    },
    pdf: {
      title: "기도문 PDF",
      eyebrow: "신앙자료 · 읽는 자료",
      hero: "기도문 PDF",
      description: "삶의 여러 상황에서 천천히 읽고 보관할 수 있는 기도문 자료를 모았습니다.",
      empty: "현재 공개된 회원 자료가 없습니다.",
      placeholder: "예: 자녀, 가정, 위로"
    },
    audio: {
      title: "기도 오디오북",
      eyebrow: "신앙자료 · 듣는 자료",
      hero: "기도 오디오북",
      description: "이동 중이나 잠들기 전에 차분히 들을 수 있는 기도 낭독 자료입니다.",
      empty: "현재 공개된 회원 자료가 없습니다.",
      placeholder: "예: 잠들기 전, 평안, 회복"
    },
    card: {
      title: "기도카드",
      eyebrow: "신앙자료 · 저장하는 자료",
      hero: "기도카드",
      description: "말씀과 기도를 한 장씩 저장하고 나눌 수 있도록 만든 카드 자료입니다.",
      empty: "현재 공개된 회원 자료가 없습니다.",
      placeholder: "예: 자녀, 위로, 결정"
    }
  };
  let resources = [];
  let resourceLoadFailed = false;
  let viewer = null;
  let entitledResourceIds = new Set();
  const resourceRoute = (window.location.pathname.split("/").pop() || "").replace(/\.html$/i, "");
  const resourcePageType = {
    "prayer-pdf-library": "pdf",
    "prayer-audiobook": "audio",
    "prayer-card-library": "card"
  }[resourceRoute];
  const requestedType = resourcePageType || new URLSearchParams(window.location.search).get("type") || "all";
  let activeType = Object.hasOwn(typeMeta, requestedType) ? requestedType : "pdf";
  let searchQuery = new URLSearchParams(window.location.search).get("search") || "";
  const activeTags = new Set();
  let keywordPanelExpanded = false;
  let freeDownloadStarted = false;

  const featuredResourceKeywords = ["자녀", "가정", "건강", "관계", "불안", "수면", "감사", "회복"];
  const resourceKeywordGroups = [
    { id: "family", label: "가족·자녀", keywords: new Set(["가정", "가족", "가족기도", "가족대화", "가족안전", "아들", "자녀", "탕자"]) },
    { id: "heart", label: "마음·감정", keywords: new Set(["걱정", "기다림", "긴장", "닫음", "두려움", "마음", "변화", "불면", "불안", "상처", "소외감", "신뢰", "안식", "외로움", "위로", "자존감", "존재", "죄책감", "탄식", "평안"]) },
    { id: "health", label: "건강·회복", keywords: new Set(["건강", "수고", "수면", "쉼", "잠", "치유", "피로", "회복"]) },
    { id: "life", label: "관계·생활", keywords: new Set(["결정", "관계", "관계회복", "발견", "부담", "생업", "성실", "시간", "일터", "재정", "정직", "진로", "책임", "출퇴근"]) },
    { id: "faith", label: "기도·신앙", keywords: new Set(["감사", "공의", "기도", "말씀카드", "맡김", "믿음", "밤기도", "보호기도", "온유기도"]) },
    { id: "environment", label: "환경·안전", keywords: new Set(["강풍", "무더위", "열대야", "장맛비"]) }
  ];

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
    if (localProduct) {
      return resource.access_level === "free"
        ? { ...localProduct, salesStatus: "free", priceKrw: null }
        : localProduct;
    }
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

  async function loadResources(catalog = [], previews = new Map()) {
    if (!client) return null;
    const { data, error } = await client
      .from("faith_resources")
      .select("id, type, title, summary, tags, access_level, status, display_order, published_at, created_at")
      .eq("status", "published")
      .eq("published", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return null;
    return (data || []).map((resource) => {
      const product = catalog.find((item) => item.resourceId === resource.id);
      if (!product || !["inquiry", "available"].includes(product.salesStatus)) return null;
      return {
        ...resource,
        productId: product.id,
        previewItems: product.previewItems || product.preview_items || [],
        previews: previews.get(resource.id) || [],
        isUploaded: true
      };
    }).filter(Boolean);
  }

  async function loadProductCatalog() {
    if (!client) return null;
    const { data, error } = await client
      .from("faith_products")
      .select("id, resource_id, type, title, summary, preview_items, sale_status, price_amount, currency, purchasable, published, marketing_details, base_print_copies, print_pack_size, print_pack_price")
      .eq("published", true)
      .in("sale_status", ["inquiry", "available"]);
    if (error) return null;
    return (data || []).map(normalizeFaithProduct);
  }

  const builtInPreviewFiles = {
    "bdfbfab7-4798-4aa0-9a0b-617a36fd780c": [
      { file_name: "page-1.png", mime_type: "image/png", alt_text: "가정을 품는 7일간의 기도 1페이지", url: new URL("assets/previews/bdfbfab7-4798-4aa0-9a0b-617a36fd780c/page-1.png", document.baseURI).href },
      { file_name: "page-2.png", mime_type: "image/png", alt_text: "가정을 품는 7일간의 기도 2페이지", url: new URL("assets/previews/bdfbfab7-4798-4aa0-9a0b-617a36fd780c/page-2.png", document.baseURI).href },
      { file_name: "page-3.png", mime_type: "image/png", alt_text: "가정을 품는 7일간의 기도 3페이지", url: new URL("assets/previews/bdfbfab7-4798-4aa0-9a0b-617a36fd780c/page-3.png", document.baseURI).href }
    ],
    "1a9ad9d3-8b81-42e5-aa2d-20c15d31eb46": [
      { file_name: "preview-1.png", mime_type: "image/png", alt_text: "마음이 다친 자녀를 위한 위로기도 카드 미리보기 1", url: new URL("assets/previews/1a9ad9d3-8b81-42e5-aa2d-20c15d31eb46/preview-1.png", document.baseURI).href },
      { file_name: "preview-2.png", mime_type: "image/png", alt_text: "마음이 다친 자녀를 위한 위로기도 카드 미리보기 2", url: new URL("assets/previews/1a9ad9d3-8b81-42e5-aa2d-20c15d31eb46/preview-2.png", document.baseURI).href }
    ],
    "e9fbe4a5-7419-4a43-8401-25e24d6e0278": [
      { file_name: "preview-1.png", mime_type: "image/png", alt_text: "중요한 결정과 재정 부담 앞에 선 가정을 위한 지혜기도 카드 미리보기 1", url: new URL("assets/previews/e9fbe4a5-7419-4a43-8401-25e24d6e0278/preview-1.png", document.baseURI).href },
      { file_name: "preview-2.png", mime_type: "image/png", alt_text: "중요한 결정과 재정 부담 앞에 선 가정을 위한 지혜기도 카드 미리보기 2", url: new URL("assets/previews/e9fbe4a5-7419-4a43-8401-25e24d6e0278/preview-2.png", document.baseURI).href }
    ],
    "6f0ba68d-4d6e-4093-8c68-025ee28db187": [
      { file_name: "preview-90s.mp3", mime_type: "audio/mpeg", alt_text: "기도 오디오북 90초 미리듣기", url: new URL("assets/previews/6f0ba68d-4d6e-4093-8c68-025ee28db187/preview-90s.mp3", document.baseURI).href }
    ]
  };

  function applyBuiltInPreviewFallback(previewMap = new Map()) {
    Object.entries(builtInPreviewFiles).forEach(([resourceId, files]) => {
      if ((previewMap.get(resourceId) || []).length) return;
      previewMap.set(resourceId, files);
    });
    return previewMap;
  }
  async function loadPublicPreviews() {
    const previewMap = new Map();
    if (!client) return applyBuiltInPreviewFallback(previewMap);
    const { data, error } = await client
      .from("resource_preview_files")
      .select("id,resource_id,bucket_id,object_path,file_name,mime_type,file_size,alt_text,sort_order")
      .order("sort_order", { ascending: true });
    if (error) return applyBuiltInPreviewFallback(previewMap);
    (data || []).forEach((item) => {
      const { data: publicData } = client.storage.from(item.bucket_id).getPublicUrl(item.object_path);
      const list = previewMap.get(item.resource_id) || [];
      list.push({ ...item, url: publicData?.publicUrl || "" });
      previewMap.set(item.resource_id, list);
    });
    return applyBuiltInPreviewFallback(previewMap);
  }

  function resourcesByType() {
    return activeType === "all" ? resources : resources.filter((resource) => resource.type === activeType);
  }

  function uploadedThreads() {
    return resourcesByType().filter((resource) => resource.isUploaded);
  }

  function renderAll() {
    renderResourceHub();
  }

  function renderHubPreviewItems(resource) {
    if (Array.isArray(resource.previewItems) && resource.previewItems.length) return resource.previewItems;
    const tags = (resource.tags || []).slice(0, 3);
    if (resource.type === "audio") return tags.map((tag) => `${tag}을 위한 기도 낭독 흐름`);
    if (resource.type === "card") return tags.map((tag) => `${tag}을 위한 한 장의 기도`);
    return tags.map((tag) => `${tag} 앞에서 천천히 읽는 기도와 묵상`);
  }

  function renderHubAccessPanel(resource) {
    const product = productForResource(resource);
    if (hasPurchasedResource(resource)) {
      return `<div class="resource-access-panel"><p>구매한 자료입니다. 내 자료실에서도 다시 다운로드할 수 있습니다.</p><button class="button primary" type="button" data-resource-download="${escapeHtml(resource.id)}">자료 다운로드</button></div>`;
    }
    if (product.salesStatus === "free") {
      return `<div class="resource-access-panel"><p>회원 무료자료입니다. 로그인 후 결제 없이 내려받을 수 있습니다.</p><button class="button primary" type="button" data-resource-download="${escapeHtml(resource.id)}">무료 다운로드</button></div>`;
    }
    if (isPurchasable(product)) {
      if (resource.type === "pdf") {
        const license = calculatePrintLicense(product, product.basePrintCopies);
        return `<div class="resource-access-panel pdf-print-license" data-print-license="${escapeHtml(product.id)}"><p>개인 열람과 비영리 인쇄 ${license.licensed}부까지 포함됩니다.</p><label>필요한 인쇄 부수<input type="number" min="1" max="10000" step="1" value="${license.requested}" data-print-copies></label><p class="pdf-print-price"><span>${license.licensed}부 인쇄 권한</span><strong data-print-total>${escapeHtml(formatKrw(license.total))}</strong></p><small>20부 초과 시 10부당 3,000원이 자동 추가됩니다.</small><button class="button primary" type="button" data-product-purchase="${escapeHtml(product.id)}">구매하기</button></div>`;
      }
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

  function resourceTagSummary() {
    const counts = new Map();
    uploadedThreads().forEach((resource) => {
      new Set(resource.tags || []).forEach((rawTag) => {
        const tag = String(rawTag || "").trim();
        if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return {
      counts,
      tags: [...counts.keys()].sort((a, b) => String(a).localeCompare(String(b), "ko"))
    };
  }

  function renderResourceKeywordButton(tag, count, extraClass = "") {
    const selected = activeTags.has(tag);
    return `<button class="${selected ? "is-active " : ""}${extraClass}" type="button" data-resource-tag="${escapeHtml(tag)}" aria-pressed="${String(selected)}" aria-label="${escapeHtml(tag)} 키워드, 자료 ${count}건">${escapeHtml(tag)}<span class="resource-keyword-count" aria-hidden="true">${count}</span></button>`;
  }

  function renderHubTags() {
    const { counts, tags } = resourceTagSummary();
    tagRoot.hidden = resourceLoadFailed || !tags.length;
    tagRoot.classList.add("resource-keyword-filter");
    if (!tags.length) {
      tagRoot.innerHTML = "";
      return;
    }

    const featuredTags = featuredResourceKeywords.filter((tag) => counts.has(tag));
    const groupedTags = new Set();
    const groups = resourceKeywordGroups.map((group) => {
      const groupTags = tags.filter((tag) => group.keywords.has(tag));
      groupTags.forEach((tag) => groupedTags.add(tag));
      return { ...group, tags: groupTags };
    }).filter((group) => group.tags.length);
    const otherTags = tags.filter((tag) => !groupedTags.has(tag));
    if (otherTags.length) groups.push({ id: "other", label: "기타", tags: otherTags });

    const selectedTags = [...activeTags].sort((a, b) => String(a).localeCompare(String(b), "ko"));
    const selectedMarkup = selectedTags.length
      ? `<div class="resource-keyword-selected" aria-label="선택한 키워드"><strong>선택한 키워드</strong><div class="resource-keyword-selected-list">${selectedTags.map((tag) => `<button type="button" data-resource-tag="${escapeHtml(tag)}" aria-label="${escapeHtml(tag)} 키워드 선택 해제">${escapeHtml(tag)}<span aria-hidden="true">×</span></button>`).join("")}</div><button class="resource-keyword-clear" type="button" data-clear-tags>전체 해제</button></div>`
      : "";
    const featuredMarkup = featuredTags.length
      ? `<div class="resource-keyword-featured"><span class="resource-keyword-label">대표 키워드</span><div class="resource-keyword-options"><button class="${activeTags.size ? "" : "is-active"}" type="button" data-clear-tags aria-pressed="${String(!activeTags.size)}">전체</button>${featuredTags.map((tag) => renderResourceKeywordButton(tag, counts.get(tag), "resource-keyword-featured-button")).join("")}</div></div>`
      : "";
    const groupMarkup = groups.map((group) => {
      const containsActiveTag = group.tags.some((tag) => activeTags.has(tag));
      const open = containsActiveTag || window.matchMedia?.("(min-width: 561px)").matches;
      return `<details class="resource-keyword-group" data-resource-keyword-group="${group.id}"${open ? " open" : ""}><summary><span>${group.label}</span><span>${group.tags.length}</span></summary><div class="resource-keyword-options">${group.tags.map((tag) => renderResourceKeywordButton(tag, counts.get(tag))).join("")}</div></details>`;
    }).join("");

    tagRoot.innerHTML = `${selectedMarkup}<div class="resource-keyword-heading"><span>필요한 주제로 자료를 찾아보세요</span><button class="resource-keyword-toggle" type="button" data-resource-keyword-toggle aria-expanded="${String(keywordPanelExpanded)}" aria-controls="resourceKeywordPanel">${keywordPanelExpanded ? "전체 키워드 접기" : "전체 키워드 보기"}<span aria-hidden="true">(${tags.length})</span></button></div>${featuredMarkup}<div id="resourceKeywordPanel" class="resource-keyword-panel"${keywordPanelExpanded ? "" : " hidden"}><div class="resource-keyword-groups">${groupMarkup}</div></div>`;
  }

  function displayResourceTitle(resource) {
    return String(resource?.title || "").replace(/^\(샘플\)\s*/, "");
  }

  let resourcePreviewReturnTarget = null;

  function ensureResourcePreviewDialog() {
    let dialog = document.getElementById("resourcePreviewDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "resourcePreviewDialog";
    dialog.className = "resource-preview-dialog";
    dialog.setAttribute("aria-labelledby", "resourcePreviewCaption");
    dialog.innerHTML = `<div class="resource-preview-dialog-inner">
      <img data-resource-preview-dialog-image alt="">
      <p id="resourcePreviewCaption" data-resource-preview-dialog-caption></p>
      <button class="resource-preview-dialog-close" type="button" data-resource-preview-close aria-label="미리보기 닫기">×</button>
    </div>`;
    document.body.append(dialog);
    const close = () => dialog.close();
    dialog.querySelector("[data-resource-preview-close]")?.addEventListener("click", close);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) close();
    });
    dialog.addEventListener("close", () => {
      const image = dialog.querySelector("[data-resource-preview-dialog-image]");
      if (image) image.removeAttribute("src");
      resourcePreviewReturnTarget?.focus();
      resourcePreviewReturnTarget = null;
    });
    return dialog;
  }

  function openResourcePreviewDialog(trigger) {
    const dialog = ensureResourcePreviewDialog();
    const image = dialog.querySelector("[data-resource-preview-dialog-image]");
    const caption = dialog.querySelector("[data-resource-preview-dialog-caption]");
    const source = trigger.dataset.resourcePreviewUrl || "";
    const alt = trigger.dataset.resourcePreviewAlt || "PDF 페이지 미리보기";
    if (!image || !caption || !source) return;
    resourcePreviewReturnTarget = trigger;
    image.src = source;
    image.alt = alt;
    caption.textContent = alt;
    dialog.showModal();
    dialog.querySelector("[data-resource-preview-close]")?.focus();
  }

  function renderPublicPreviewGallery(resource, compact = false) {
    if (compact) return "";
    const previewLimit = compact ? 1 : resource.type === "card" ? 2 : resource.type === "pdf" ? 4 : 3;
    const previews = (resource.previews || []).filter((item) => item.url && (/^image\//.test(item.mime_type || "") || /\.(jpe?g|png|webp)$/i.test(item.file_name || item.object_path || ""))).slice(0, previewLimit);
    if (!previews.length) {
      return !compact && resource.type === "pdf"
        ? `<section class="resource-media-preview resource-media-preview-pages" aria-label="PDF 공개 미리보기"><div class="resource-media-heading"><p class="eyebrow">PDF Preview</p><h3>1~4페이지 미리보기</h3><p>이 자료에는 현재 공개된 페이지 미리보기가 없습니다.</p></div></section>`
        : "";
    }
    const gallery = `<div class="resource-public-preview-grid${compact ? " is-compact" : ""}">${previews.map((item, index) => {
      const alt = item.alt_text || `${displayResourceTitle(resource)} ${index + 1}페이지 미리보기`;
      return `<figure><button class="resource-preview-open" type="button" data-resource-preview-url="${escapeHtml(item.url)}" data-resource-preview-alt="${escapeHtml(alt)}" aria-label="${escapeHtml(`${alt} 크게 보기`)}" title="미리보기 크게 보기"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(alt)}" loading="lazy"></button><figcaption>${escapeHtml(alt)}</figcaption></figure>`;
    }).join("")}</div>`;
    if (compact || resource.type !== "pdf") return gallery;
    return `<section class="resource-media-preview resource-media-preview-pages" aria-label="PDF 1페이지부터 4페이지 미리보기"><div class="resource-media-heading"><p class="eyebrow">PDF Preview</p><h3>1~4페이지 미리보기</h3><p>표지, 자료 정보, 1일차 읽기와 기록까지 실제 4쪽을 공개합니다.</p></div>${gallery}</section>`;
  }

  function publicAudioPreview(resource) {
    if (resource.type !== "audio") return null;
    return (resource.previews || []).find((item) => item.url && (/^audio\/(mpeg|mp3)$/i.test(item.mime_type || "") || /\.mp3$/i.test(item.file_name || item.object_path || ""))) || null;
  }

  function renderPublicAudioPreview(resource) {
    const file = publicAudioPreview(resource);
    if (!file) return "";
    return `<section class="resource-media-preview resource-media-preview-audio" aria-label="오디오 미리듣기"><div class="resource-media-heading"><p class="eyebrow">Audio Preview</p><h3>미리듣기</h3><p>공개된 일부 내용을 페이지에서 바로 재생할 수 있습니다.</p></div><audio controls preload="metadata" controlslist="nodownload"><source src="${escapeHtml(file.url)}" type="${escapeHtml(file.mime_type || "audio/mpeg")}">브라우저에서 오디오 재생을 지원하지 않습니다.</audio></section>`;
  }

  function randomResourceFiles(files, count) {
    const pool = [...files];
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      const target = values[0] % (index + 1);
      [pool[index], pool[target]] = [pool[target], pool[index]];
    }
    return pool.slice(0, count);
  }

  async function createProtectedMediaPreviews(resource, files) {
    const publicImageCount = (resource.previews || []).filter((item) => item.url && (/^image\//.test(item.mime_type || "") || /\.(jpe?g|png|webp)$/i.test(item.file_name || item.object_path || ""))).length;
    const matchesType = (file, type) => {
      const name = String(file.file_name || "");
      const mime = String(file.mime_type || "");
      if (type === "pdf") return mime === "application/pdf" || /\.pdf$/i.test(name);
      if (type === "audio") return /^audio\//.test(mime) || /\.(mp3|m4a|wav|ogg)$/i.test(name);
      return /^image\//.test(mime) || /\.(jpe?g|png|webp)$/i.test(name);
    };
    let selected = [];
    if (resource.type === "pdf") selected = files.filter((file) => matchesType(file, "pdf")).slice(0, 1);
    if (resource.type === "audio") {
      const audioFiles = files.filter((file) => matchesType(file, "audio"));
      selected = [audioFiles.find((file) => !/(preview|sample|미리)/i.test(file.file_name || "")) || audioFiles[0]].filter(Boolean);
    }
    if (resource.type === "card" && publicImageCount < 2) selected = randomResourceFiles(files.filter((file) => matchesType(file, "card")), 2);
    const signed = await Promise.all(selected.map(async (file) => {
      const { data, error } = await client.storage.from(file.bucket_id || "faith-resources").createSignedUrl(file.object_path, 900);
      return error || !data?.signedUrl ? null : { ...file, url: data.signedUrl };
    }));
    return signed.filter(Boolean);
  }

  function renderProtectedMediaPreview(resource, files) {
    if (!files.length) return "";
    if (resource.type === "pdf") {
      const file = files[0];
      const source = `${file.url}#page=1&view=FitH`;
      return `<section class="resource-media-preview resource-media-preview-pdf" aria-label="구매한 PDF 전체 미리보기"><div class="resource-media-heading"><p class="eyebrow">Purchased PDF</p><h3>구매 자료 전체 미리보기</h3><p>구매한 자료의 전체 페이지를 확인할 수 있습니다.</p></div><div class="resource-pdf-frame"><iframe src="${escapeHtml(source)}" title="${escapeHtml(displayResourceTitle(resource))} 전체 미리보기" loading="lazy"></iframe></div></section>`;
    }
    if (resource.type === "audio") {
      const file = files[0];
      return `<section class="resource-media-preview resource-media-preview-audio" aria-label="오디오 미리듣기"><div class="resource-media-heading"><p class="eyebrow">Audio Preview</p><h3>미리듣기</h3><p>페이지에서 바로 재생하거나 원하는 위치로 이동해 들을 수 있습니다.</p></div><audio controls preload="metadata" controlslist="nodownload"><source src="${escapeHtml(file.url)}" type="${escapeHtml(file.mime_type || "audio/mpeg")}">브라우저에서 오디오 재생을 지원하지 않습니다.</audio></section>`;
    }
    return `<section class="resource-media-preview resource-media-preview-card" aria-label="무작위 기도카드 미리보기"><div class="resource-media-heading"><p class="eyebrow">Card Preview</p><h3>무작위 카드 2장 미리보기</h3></div><div class="resource-private-card-preview">${files.map((file, index) => `<figure><img src="${escapeHtml(file.url)}" alt="${escapeHtml(`${displayResourceTitle(resource)} 무작위 미리보기 ${index + 1}`)}" loading="lazy"><figcaption>기도카드 ${index + 1}</figcaption></figure>`).join("")}</div></section>`;
  }

  function renderHubCard(resource) {
    const tags = (resource.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    const meta = typeMeta[resource.type] || typeMeta.all;
    const product = productForResource(resource);
    const badge = product.salesStatus === "free"
      ? "무료"
      : product.salesStatus === "available" && product.priceKrw
        ? formatKrw(product.priceKrw)
        : "자료 문의";
    const marketing = product.marketingDetails || {};
    return `<article class="faith-resource-card resource-type-${escapeHtml(resource.type)}" data-resource-id="${escapeHtml(resource.id)}">
      ${renderPublicPreviewGallery(resource, true)}
      <div class="resource-card-copy">
        <div class="resource-card-heading"><p class="eyebrow">${escapeHtml(meta?.title || "신앙자료")}</p><span class="resource-member-badge">${escapeHtml(badge)}</span></div>
        <h3>${escapeHtml(displayResourceTitle(resource))}</h3>
        <p class="resource-summary">${escapeHtml(marketing.hook || resource.summary)}</p>
        <div class="resource-card-tags" aria-label="자료 키워드">${tags}</div>
        <button class="resource-card-open" type="button" data-resource-detail="${escapeHtml(resource.id)}" aria-expanded="false">자료 열기 <span aria-hidden="true">→</span></button>
      </div>
      <div class="resource-inline-detail" data-resource-inline-detail hidden></div>
    </article>`;
  }

  function renderResourceHubSamples(list) {
    const sampleGroups = [
      { type: "pdf", title: "기도문 PDF", href: "prayer-pdf-library.html", description: "천천히 읽고 보관하며 반복해서 기도할 수 있는 자료" },
      { type: "audio", title: "기도 오디오북", href: "prayer-audiobook.html", description: "이동 중이나 잠들기 전에 차분히 듣는 기도 자료" },
      { type: "card", title: "기도카드", href: "prayer-card-library.html", description: "휴대폰에 저장하고 일상에서 다시 보는 말씀과 기도" }
    ];
    return `<div class="resource-hub-samples">${sampleGroups.map((group) => {
      const groupResources = list.filter((item) => item.type === group.type);
      return `<section class="resource-sample-group resource-sample-${group.type}">
        <header><div><p class="eyebrow">신앙자료</p><h3>${group.title}</h3><p>${group.description}</p></div><a class="text-link" href="${group.href}">전체 보기</a></header>
        ${groupResources.length
          ? `<div class="resource-sample-list">${groupResources.map(renderHubCard).join("")}</div>`
          : `<div class="resource-empty-state resource-coming-soon"><strong>현재 공개된 회원 자료가 없습니다.</strong></div>`}
      </section>`;
    }).join("")}</div>`;
  }

  function renderHubList() {
    const list = hubFilteredResources();
    if (filterStatus) {
      filterStatus.hidden = false;
      const conditions = [];
      if (activeTags.size) conditions.push([...activeTags].join(" · "));
      if (searchQuery.trim()) conditions.push(`“${searchQuery.trim()}” 검색`);
      const detail = conditions.length ? ` · ${conditions.join(" · ")}` : "";
      filterStatus.textContent = list.length
        ? `${typeMeta[activeType].title} ${list.length}건${detail}`
        : activeTags.size || searchQuery.trim()
          ? `${typeMeta[activeType].title}에서 조건에 맞는 자료를 찾지 못했습니다${detail}`
          : `${typeMeta[activeType].title} 0건`;
    }
    if (resourceLoadFailed) {
      listRoot.innerHTML = `<div class="resource-empty-state resource-load-error" role="alert"><strong>자료 목록을 불러오지 못했습니다.</strong><p>잠시 후 페이지를 새로고침해 주세요.</p></div>`;
      return;
    }
    const isResourceHub = document.body.dataset.sitePage === "prayer-cards" && activeType === "all";
    listRoot.innerHTML = isResourceHub
      ? renderResourceHubSamples(list)
      : list.length
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

  function closeInlineResourceDetails(exceptCard = null) {
    listRoot.querySelectorAll(".faith-resource-card.is-expanded").forEach((card) => {
      if (card === exceptCard) return;
      card.classList.remove("is-expanded");
      const detail = card.querySelector("[data-resource-inline-detail]");
      const trigger = card.querySelector("[data-resource-detail]");
      if (detail) {
        detail.hidden = true;
        detail.innerHTML = "";
      }
      trigger?.setAttribute("aria-expanded", "false");
    });
  }

  async function openResourceDetail(resource) {
    const card = [...listRoot.querySelectorAll("[data-resource-id]")].find((item) => item.dataset.resourceId === resource.id);
    const detail = card?.querySelector("[data-resource-inline-detail]");
    const trigger = card?.querySelector("[data-resource-detail]");
    if (!card || !detail || !trigger) return;
    if (card.classList.contains("is-expanded")) {
      closeInlineResourceDetails();
      const closedUrl = new URL(window.location.href);
      closedUrl.searchParams.delete("resource");
      window.history.replaceState({}, "", closedUrl);
      return;
    }
    closeInlineResourceDetails(card);
    detail.hidden = false;
    detail.innerHTML = '<p class="resource-detail-loading" role="status">자료 안내를 불러오고 있습니다.</p>';
    card.classList.add("is-expanded");
    trigger.setAttribute("aria-expanded", "true");
    const items = renderHubPreviewItems(resource);
    const canReadOriginal = hasPurchasedResource(resource);
    let privateDetail = null;
    let privateFiles = [];
    let protectedMediaPreviews = [];

    if (canReadOriginal && client) {
      const [detailResult, filesResult] = await Promise.all([
        client.from("faith_resource_private_details").select("description,preview_items,gallery_items").eq("resource_id", resource.id).maybeSingle(),
        client.from("resource_files").select("id,bucket_id,object_path,file_name,mime_type,sort_order").eq("resource_id", resource.id).order("sort_order", { ascending: true })
      ]);
      if (detailResult.error || filesResult.error) {
        setResourceActionStatus("구매 자료의 상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        privateDetail = detailResult.data;
        privateFiles = filesResult.data || [];
        protectedMediaPreviews = await createProtectedMediaPreviews(resource, privateFiles);
      }
    }

    detail.innerHTML = `<div class="resource-detail-content">
        <p class="eyebrow">${escapeHtml((typeMeta[resource.type] || typeMeta.all).title)}</p>
        ${canReadOriginal && protectedMediaPreviews.length && ["pdf", "card"].includes(resource.type) ? "" : renderPublicPreviewGallery(resource)}
        ${canReadOriginal && protectedMediaPreviews.length && resource.type === "audio" ? "" : renderPublicAudioPreview(resource)}
        ${renderProtectedMediaPreview(resource, protectedMediaPreviews)}
        ${(() => { const marketing = productForResource(resource).marketingDetails || {}; const benefits = Array.isArray(marketing.benefits) ? marketing.benefits : []; return benefits.length ? `<div class="resource-marketing-points"><strong>${escapeHtml(marketing.hook || "이 자료가 돕는 일")}</strong><ul>${benefits.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""; })()}
        <p class="resource-detail-description">${escapeHtml(privateDetail?.description || resource.summary)}</p>
        <h3>${canReadOriginal ? "구매 자료 구성" : "공개 미리보기"}</h3>
        <ul class="compact-list">${(privateDetail?.preview_items || items).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        ${canReadOriginal && privateFiles.length ? `<div class="resource-owned-files"><strong>포함 파일</strong><ul>${privateFiles.map((file) => `<li>${escapeHtml(file.file_name)}</li>`).join("")}</ul></div>` : ""}
        ${!canReadOriginal ? `<p class="resource-locked-detail">상세 원문과 원본 파일 정보는 구매 후 확인할 수 있습니다.</p>` : ""}
        ${renderHubAccessPanel(resource)}
      </div>`;
    if (threadPanel) threadPanel.hidden = true;
    const url = new URL(window.location.href);
    url.searchParams.set("resource", resource.id);
    window.history.replaceState({}, "", url);
    trackFaithEvent("resource_detail_view", { resource_id: resource.id, product_id: productForResource(resource).id });
  }

  async function restoreRequestedResourceDetail() {
    const requestedResource = new URLSearchParams(window.location.search).get("resource");
    if (!requestedResource) return;
    const resource = resources.find((item) => item.id === requestedResource);
    if (!resource) return;
    const card = [...listRoot.querySelectorAll("[data-resource-id]")].find((item) => item.dataset.resourceId === resource.id);
    if (card?.classList.contains("is-expanded")) return;
    await openResourceDetail(resource);
  }

  async function downloadResource(resourceId) {
    const resource = resources.find((item) => item.id === resourceId);
    if (!resource) return;
    const product = productForResource(resource);
    try {
      if (!window.FaithAuth?.requestProtectedDownload) throw new Error("회원 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      const download = await window.FaithAuth.requestProtectedDownload(resourceId);
      trackFaithEvent("resource_download", { resource_id: resourceId, product_id: product.id });
      const count = await openProtectedDownloads(download);
      setResourceActionStatus(count > 1 ? `${count}개 파일의 다운로드 목록을 열었습니다.` : "다운로드를 시작했습니다.");
    } catch (error) {
      setResourceActionStatus(error.message || "파일을 열 수 없습니다.");
    }
  }

  async function handleRequestedFreePdfDownload() {
    if (freeDownloadStarted || new URLSearchParams(window.location.search).get("download") !== "free" || !resources.length) return;
    const freePdf = resources.find((resource) => resource.type === "pdf" && productForResource(resource).salesStatus === "free");
    if (!freePdf) {
      setResourceActionStatus("현재 다운로드할 수 있는 무료 기도문이 없습니다.");
      return;
    }
    if (!viewer) {
      promptMemberAccess();
      return;
    }
    freeDownloadStarted = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("download");
    window.history.replaceState({}, "", url);
    await downloadResource(freePdf.id);
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
    const keywordToggle = event.target.closest("[data-resource-keyword-toggle]");
    if (keywordToggle) {
      keywordPanelExpanded = !keywordPanelExpanded;
      renderHubTags();
      tagRoot.querySelector("[data-resource-keyword-toggle]")?.focus();
      return;
    }
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

  listRoot.addEventListener("input", (event) => {
    const input = event.target.closest("[data-print-copies]");
    if (!input) return;
    const panel = input.closest("[data-print-license]");
    const product = findFaithProduct(panel?.dataset.printLicense);
    if (!panel || !product) return;
    const license = calculatePrintLicense(product, input.value);
    input.value = license.requested;
    const price = panel.querySelector("[data-print-total]");
    const label = panel.querySelector(".pdf-print-price span");
    if (price) price.textContent = formatKrw(license.total);
    if (label) label.textContent = `${license.licensed}부 인쇄 권한`;
  });

  listRoot.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-resource-preview-url]");
    if (previewButton) {
      openResourcePreviewDialog(previewButton);
      return;
    }
    if (event.target.closest("[data-reset-resource-search]")) {
      activeTags.clear();
      searchQuery = "";
      if (searchInput) searchInput.value = "";
      renderAll();
      return;
    }
    const purchaseButton = event.target.closest("[data-product-purchase]");
    if (purchaseButton) {
      const productId = purchaseButton.dataset.productPurchase;
      const printCopies = purchaseButton.closest("[data-print-license]")?.querySelector("[data-print-copies]")?.value || null;
      trackFaithEvent("purchase_start", { product_id: productId, print_copies: printCopies ? Number(printCopies) : undefined });
      startProductPurchase(productId, printCopies).catch((error) => {
        setResourceActionStatus(error.message || "결제 흐름을 열지 못했습니다. 자료 문의하기로 연락해 주세요.");
      });
      return;
    }
    if (event.target.closest("[data-resource-inquiry]")) return;
    const downloadButton = event.target.closest("[data-resource-download]");
    if (downloadButton) return downloadResource(downloadButton.dataset.resourceDownload);
    const detailButton = event.target.closest("[data-resource-detail]");
    if (detailButton) {
      const resource = resources.find((item) => item.id === detailButton.dataset.resourceDetail);
      if (resource) openResourceDetail(resource).catch(() => setResourceActionStatus("자료 상세를 불러오지 못했습니다."));
    }
  });

  listRoot.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const detailButton = event.target.closest("[data-resource-detail]");
    if (!detailButton) return;
    event.preventDefault();
    const resource = resources.find((item) => item.id === detailButton.dataset.resourceDetail);
    if (resource) openResourceDetail(resource).catch(() => setResourceActionStatus("자료 상세를 불러오지 못했습니다."));
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
      const printCopies = purchaseButton.closest("[data-print-license]")?.querySelector("[data-print-copies]")?.value || null;
      trackFaithEvent("purchase_start", { product_id: productId, print_copies: printCopies ? Number(printCopies) : undefined });
      startProductPurchase(productId, printCopies).catch((error) => {
        setResourceActionStatus(error.message || "결제 흐름을 열지 못했습니다. 자료 문의하기로 연락해 주세요.");
      });
      return;
    }
    const downloadButton = event.target.closest("[data-resource-download]");
    if (downloadButton) downloadResource(downloadButton.dataset.resourceDownload);
  });

  function wireFreePdfCta() {
    const cta = document.querySelector("[data-free-pdf-cta]");
    if (!cta) return;
    const freePdf = resources.find((resource) => resource.type === "pdf" && productForResource(resource).salesStatus === "free");
    if (freePdf) cta.href = `prayer-pdf-library.html?resource=${encodeURIComponent(freePdf.id)}`;
    if (cta.dataset.trackingBound) return;
    cta.dataset.trackingBound = "true";
    cta.addEventListener("click", (event) => {
      event.preventDefault();
      const availableFreePdf = resources.find((resource) => resource.type === "pdf" && productForResource(resource).salesStatus === "free");
      trackFaithEvent("free_pdf_hero_click", availableFreePdf ? { resource_id: availableFreePdf.id } : {});
      if (!viewer) {
        promptMemberAccess();
        return;
      }
      if (availableFreePdf) {
        openResourceDetail(availableFreePdf)
          .then(() => {
            const sampleCard = [...listRoot.querySelectorAll("[data-resource-id]")]
              .find((item) => item.dataset.resourceId === availableFreePdf.id);
            sampleCard?.scrollIntoView({ behavior: "smooth", block: "start" });
          })
          .catch(() => {
            setResourceActionStatus("샘플 기도문 PDF를 열지 못했습니다. 잠시 후 다시 시도해 주세요.");
          });
        return;
      }
      setResourceActionStatus("\uBB34\uB8CC \uC790\uB8CC\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uB20C\uB7EC \uC8FC\uC138\uC694.");
      document.querySelector("#faithResourceBrowser")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }


  window.addEventListener("faith-auth-changed", async () => {
    viewer = await loadViewer();
    await refreshEntitlements();
    renderAll();
    await restoreRequestedResourceDetail();
    await handleRequestedFreePdfDownload();
  });

  window.addEventListener("faith-auth-ready", async () => {
    await refreshEntitlements();
    renderAll();
    await restoreRequestedResourceDetail();
    await handleRequestedFreePdfDownload();
  });

  wireFreePdfCta();

  (async () => {
    if (resourcePageType || !new URLSearchParams(window.location.search).has("type")) {
      const url = new URL(window.location.href);
      url.searchParams.set("type", activeType);
      window.history.replaceState({}, "", url);
    }
    viewer = await loadViewer();
    const [catalog, previews] = await Promise.all([loadProductCatalog(), loadPublicPreviews()]);
    const remoteResources = catalog && previews ? await loadResources(catalog, previews) : null;
    resourceLoadFailed = !catalog || !previews || remoteResources === null;
    window.FAITH_PRODUCT_CATALOG = catalog || [];
    resources = remoteResources || [];
    if (searchInput) searchInput.value = searchQuery;
    await refreshEntitlements();
    renderAll();
    wireFreePdfCta();
    await restoreRequestedResourceDetail();
    await handleRequestedFreePdfDownload();
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
    return formatDate(new Date(parts.hour < 4 ? base - 86400000 : base));
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
