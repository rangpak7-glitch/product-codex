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

(() => {
  const fallbackResources = Array.isArray(window.FAITH_RESOURCES) ? window.FAITH_RESOURCES : [];
  const client = window.FaithSupabase;
  const previewRoot = $("#resourcePreview");
  const listRoot = $("#faithResourceList");
  const tagRoot = $("#faithResourceTags");
  const filterStatus = $("#faithResourceFilterStatus");
  const threadPanel = $("#cardThreadDetail");
  if (!previewRoot || !listRoot || !tagRoot) return;

  const typeMeta = {
    pdf: { eyebrow: "Premium PDF", title: "주제별 기도문 PDF", summary: "상황별 기도문을 게시판처럼 둘러보고 키워드로 골라볼 수 있습니다.", action: "PDF 목록 보기" },
    audio: { eyebrow: "Prayer Audiobook", title: "기도 오디오북", summary: "업로드한 MP3 자료를 주제별로 정리해 같은 방식으로 찾아 들을 수 있습니다.", action: "오디오 목록 보기" },
    card: { eyebrow: "Prayer Card Thread", title: "말씀·기도카드 이미지", summary: "말씀달력처럼 컬렉션을 열고 전체 카드 이미지를 이어서 확인합니다.", action: "카드 목록 보기" }
  };
  let resources = [];
  let viewer = null;
  let activeType = "pdf";
  const activeTags = new Set();

  const hasSubscriberAccess = () => Boolean(viewer && (viewer.role === "admin" || viewer.subscription_status === "active"));

  async function loadViewer() {
    if (!client) return null;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;
    const { data: profile } = await client
      .from("profiles")
      .select("role, subscription_status")
      .eq("id", user.id)
      .maybeSingle();
    return profile ? { ...profile, user } : { role: "member", subscription_status: "free", user };
  }

  async function loadResources() {
    if (!client) return null;
    const { data, error } = await client
      .from("faith_resources")
      .select("id, type, title, summary, tags, access_level, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (error) return null;
    return (data || []).map((resource) => ({ ...resource, isUploaded: true }));
  }

  function resourcesByType() {
    return resources.filter((resource) => resource.type === activeType);
  }

  function uploadedThreads() {
    return resourcesByType().filter((resource) => resource.isUploaded);
  }

  function filteredResources() {
    const list = uploadedThreads();
    if (!activeTags.size) return list;
    return list.filter((resource) => [...activeTags].every((tag) => resource.tags?.includes(tag)));
  }

  function renderPreview() {
    const meta = typeMeta[activeType];
    const items = resourcesByType().slice(0, 3);
    previewRoot.innerHTML = `<div class="resource-preview-copy">
      <p class="eyebrow">${escapeHtml(meta.eyebrow)}</p>
      <h3>${escapeHtml(meta.title)}</h3>
      <p>${escapeHtml(meta.summary)}</p>
      <a class="button secondary" href="#faithResourceList">${escapeHtml(meta.action)}</a>
    </div>
    <div class="resource-preview-items">
      ${items.length ? items.map((item) => `<article>
        <span>${escapeHtml(item.tags?.[0] || meta.title)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.summary)}</p>
      </article>`).join("") : `<article><strong>등록된 자료가 없습니다.</strong><p>관리자가 새 자료를 발행하면 이곳에 표시됩니다.</p></article>`}
    </div>`;
  }

  function renderTags() {
    const tags = [...new Set(uploadedThreads().flatMap((resource) => resource.tags || []))];
    tagRoot.innerHTML = [`<button class="${activeTags.size ? "" : "is-active"}" type="button" data-clear-tags>전체</button>`]
      .concat(tags.map((tag) => `<label class="${activeTags.has(tag) ? "is-active" : ""}"><input type="checkbox" value="${escapeHtml(tag)}" ${activeTags.has(tag) ? "checked" : ""}>${escapeHtml(tag)}</label>`))
      .join("");
    if (filterStatus) {
      filterStatus.textContent = activeTags.size
        ? `${[...activeTags].join(", ")} 키워드를 모두 포함한 자료를 보여드립니다.`
        : `${typeMeta[activeType].title}의 전체 스레드형 자료를 보여드립니다.`;
    }
  }

  function lockedPanel(resource) {
    const fileLabel = resource.type === "audio" ? "MP3 파일" : resource.type === "card" ? "카드 이미지 전체" : "PDF 파일";
    if (hasSubscriberAccess()) {
      return `<div class="download-row"><span>${escapeHtml(fileLabel)}</span><button class="button primary" type="button" data-resource-download="${escapeHtml(resource.id)}">다운로드</button></div>`;
    }
    return `<div class="resource-locked-panel">
      <div class="locked-blur"><p>구독회원 전용 상세 설명과 파일 구성</p><ul><li>자료 구성 안내</li><li>파일 정보</li><li>전체 내용 보기</li></ul></div>
      <div class="download-row"><span>${escapeHtml(fileLabel)}</span><button class="button primary" type="button" data-member-action>${viewer ? "구독 권한 확인" : "회원가입 후 이용"}</button></div>
    </div>`;
  }

  function previewChips(resource) {
    if (resource.type !== "card" || !hasSubscriberAccess()) return "";
    const items = resource.previewItems || [];
    return `<div class="thread-preview-row" aria-label="${escapeHtml(resource.title)} 미리보기">${items.slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`;
  }

  function resourceCard(resource) {
    const tags = (resource.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    const fileLabel = resource.type === "audio" ? "오디오 자료" : resource.type === "card" ? "카드 이미지 전체" : "기도문 PDF";
    return `<article class="faith-resource-card" data-resource-id="${escapeHtml(resource.id)}">
      <div class="resource-card-head"><p class="eyebrow">${escapeHtml(typeMeta[resource.type]?.title || "신앙자료")}</p><span class="access-pill">구독 자료</span></div>
      <h3>${escapeHtml(resource.title)}</h3>
      <p class="resource-summary">${escapeHtml(resource.summary)}</p>
      <div class="resource-card-tags">${tags}</div>
      ${previewChips(resource)}
      ${lockedPanel(resource)}
      <button class="button secondary" type="button" data-open-thread="${escapeHtml(resource.id)}">${escapeHtml(fileLabel)} 보기</button>
    </article>`;
  }

  function renderList() {
    const list = filteredResources();
    listRoot.innerHTML = list.length
      ? list.map(resourceCard).join("")
      : `<p class="muted">선택한 키워드에 맞는 ${escapeHtml(typeMeta[activeType].title)} 자료를 찾지 못했습니다.</p>`;
  }

  function paintTabs() {
    document.querySelectorAll("[data-resource-tab]").forEach((button) => {
      const selected = button.dataset.resourceTab === activeType;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
  }

  function renderAll() {
    paintTabs();
    renderPreview();
    renderTags();
    renderList();
  }

  function promptMemberAccess() {
    const status = document.querySelector("[data-member-auth-status]");
    if (status) status.textContent = viewer ? "현재 계정은 구독 권한이 필요합니다." : "회원가입 또는 로그인 후 구독 권한을 확인할 수 있습니다.";
    document.querySelector("#memberSignup")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function getPrivateResource(resourceId) {
    const [{ data: details, error: detailError }, { data: files, error: fileError }] = await Promise.all([
      client.from("faith_resource_private_details").select("description, preview_items, gallery_items").eq("resource_id", resourceId).maybeSingle(),
      client.from("resource_files").select("id, object_path, file_name, mime_type, sort_order").eq("resource_id", resourceId).order("sort_order")
    ]);
    if (detailError || fileError) throw new Error("구독 권한이 필요합니다.");
    return { details: details || {}, files: files || [] };
  }

  async function createDownloadUrl(file) {
    const { data, error } = await client.storage
      .from("faith-resources")
      .createSignedUrl(file.object_path, 300, { download: file.file_name });
    if (error) throw error;
    return data.signedUrl;
  }

  async function openThread(resource) {
    if (!hasSubscriberAccess()) {
      promptMemberAccess();
      return;
    }
    const title = $("#cardThreadTitle");
    const description = $("#cardThreadDescription");
    const gallery = $("#cardThreadGallery");
    if (!threadPanel || !client) return;
    try {
      const { details, files } = await getPrivateResource(resource.id);
      const signedFiles = await Promise.all(files.map(async (file) => ({ ...file, signedUrl: await createDownloadUrl(file) })));
      if (title) title.textContent = resource.title;
      if (description) description.textContent = details.description || resource.summary;
      if (gallery) {
        gallery.innerHTML = signedFiles.length ? signedFiles.map((file, index) => {
          if (resource.type === "card" && file.mime_type.startsWith("image/")) {
            return `<article class="thread-gallery-card"><img src="${escapeHtml(file.signedUrl)}" alt="${escapeHtml(resource.title)} ${index + 1}"><strong>${escapeHtml(file.file_name)}</strong></article>`;
          }
          if (resource.type === "audio") {
            return `<article class="thread-gallery-card"><span>${index + 1}</span><strong>${escapeHtml(file.file_name)}</strong><audio controls preload="metadata" src="${escapeHtml(file.signedUrl)}"></audio></article>`;
          }
          return `<article class="thread-gallery-card"><span>${index + 1}</span><strong>${escapeHtml(file.file_name)}</strong><a class="button secondary" href="${escapeHtml(file.signedUrl)}">파일 다운로드</a></article>`;
        }).join("") : '<p class="muted">연결된 파일이 없습니다.</p>';
      }
      threadPanel.hidden = false;
      threadPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      promptMemberAccess();
    }
  }

  async function downloadResource(resourceId) {
    if (!hasSubscriberAccess() || !client) {
      promptMemberAccess();
      return;
    }
    try {
      const { files } = await getPrivateResource(resourceId);
      if (!files.length) throw new Error("연결된 파일이 없습니다.");
      window.location.assign(await createDownloadUrl(files[0]));
    } catch (error) {
      const status = document.querySelector("[data-member-auth-status]");
      if (status) status.textContent = error.message || "파일을 열 수 없습니다.";
    }
  }

  document.querySelectorAll("[data-resource-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeType = button.dataset.resourceTab || "pdf";
      activeTags.clear();
      renderAll();
    });
  });

  tagRoot.addEventListener("click", (event) => {
    if (!event.target.closest("[data-clear-tags]")) return;
    activeTags.clear();
    renderTags();
    renderList();
  });

  tagRoot.addEventListener("change", (event) => {
    const input = event.target.closest("input[type='checkbox']");
    if (!input) return;
    input.checked ? activeTags.add(input.value) : activeTags.delete(input.value);
    renderTags();
    renderList();
  });

  listRoot.addEventListener("click", (event) => {
    if (event.target.closest("[data-member-action]")) return promptMemberAccess();
    const downloadButton = event.target.closest("[data-resource-download]");
    if (downloadButton) return downloadResource(downloadButton.dataset.resourceDownload);
    const openButton = event.target.closest("[data-open-thread]");
    const resource = resources.find((item) => item.id === openButton?.dataset.openThread);
    if (resource) openThread(resource);
  });

  document.querySelector("[data-close-thread]")?.addEventListener("click", () => {
    if (threadPanel) threadPanel.hidden = true;
  });

  window.addEventListener("faith-auth-changed", async () => {
    viewer = await loadViewer();
    renderAll();
  });

  (async () => {
    viewer = await loadViewer();
    const remoteResources = await loadResources();
    resources = remoteResources ?? fallbackResources;
    renderAll();
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
  const setStatus = (message) => { if (status) status.textContent = message; };

  async function refreshSession() {
    if (!client) return setStatus("회원 연결을 불러오지 못했습니다.");
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    const { data: profile } = await client.from("profiles").select("role, subscription_status").eq("id", user.id).maybeSingle();
    logoutButton.hidden = false;
    setStatus(profile?.subscription_status === "active" || profile?.role === "admin" ? "구독회원으로 로그인되어 있습니다." : "로그인되어 있습니다. 구독 권한은 결제 완료 후 활성화됩니다.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) return setStatus("회원 연결을 불러오지 못했습니다.");
    if ((password.value || "").length < 8) return setStatus("비밀번호는 8자 이상으로 입력해 주세요.");
    const { error } = await client.auth.signUp({ email: email.value.trim(), password: password.value });
    setStatus(error ? error.message : "인증 메일을 보냈습니다. 메일 인증 후 로그인해 주세요.");
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
  const client = window.FaithSupabase;
  if (!gate || !panel) return;
  const loginForm = document.querySelector("[data-admin-login-form]");
  const loginStatus = document.querySelector("[data-admin-auth-status]");
  const uploadForm = document.querySelector("[data-admin-resource-form]");
  const uploadStatus = document.querySelector("[data-admin-upload-status]");
  const dropzone = document.querySelector("[data-upload-dropzone]");
  const fileInput = uploadForm?.querySelector("[name='files']");
  const fileSummary = document.querySelector("[data-upload-file-summary]");
  const resetPasswordButton = document.querySelector("[data-admin-reset-password]");
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
      return;
    }
    const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      adminUser = null;
      gate.hidden = false;
      panel.hidden = true;
      return setLoginStatus("이 계정에는 관리자 권한이 없습니다.");
    }
    adminUser = user;
    gate.hidden = true;
    panel.hidden = false;
  }

  function safeFileName(name) {
    return name.normalize("NFKD").replace(/[^a-zA-Z0-9가-힣._-]+/g, "-").replace(/-+/g, "-");
  }

  function filesMatchType(type, files) {
    if (!files.length) return false;
    if (type === "pdf") return files.length === 1 && (files[0].type === "application/pdf" || /\.pdf$/i.test(files[0].name));
    if (type === "audio") return files.length === 1 && (/^audio\//.test(files[0].type) || /\.mp3$/i.test(files[0].name));
    return files.every((file) => /^image\//.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name));
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

  fileInput?.addEventListener("change", updateFileSummary);
  dropzone?.addEventListener("click", () => fileInput?.click());
  dropzone?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") fileInput?.click();
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
    if (!fileInput || !event.dataTransfer?.files.length) return;
    fileInput.files = event.dataTransfer.files;
    updateFileSummary();
  });

  uploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client || !adminUser || !fileInput) return setUploadStatus("관리자 로그인이 필요합니다.");
    const formData = new FormData(uploadForm);
    const type = String(formData.get("type"));
    const files = [...fileInput.files];
    if (!filesMatchType(type, files)) return setUploadStatus(type === "card" ? "카드 자료에는 이미지 파일을 선택해 주세요." : "선택한 자료 유형에 맞는 파일 한 개를 선택해 주세요.");
    const tags = String(formData.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!tags.length) return setUploadStatus("키워드를 하나 이상 입력해 주세요.");
    setUploadStatus("자료와 파일을 저장하고 있습니다.");
    const { data: resource, error: resourceError } = await client.from("faith_resources").insert({
      type,
      title: String(formData.get("title")).trim(),
      summary: String(formData.get("summary")).trim(),
      tags,
      created_by: adminUser.id
    }).select("id").single();
    if (resourceError) return setUploadStatus(resourceError.message);
    const { error: detailError } = await client.from("faith_resource_private_details").insert({
      resource_id: resource.id,
      description: String(formData.get("description")).trim(),
      preview_items: files.slice(0, 3).map((file) => file.name),
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
    const { error: publishError } = await client.from("faith_resources").update({ published: true, updated_at: new Date().toISOString() }).eq("id", resource.id);
    if (publishError) return setUploadStatus(publishError.message);
    uploadForm.reset();
    updateFileSummary();
    setUploadStatus("자료를 등록하고 발행했습니다.");
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

const prayerForm = $("#prayerRequestForm");
if (prayerForm) {
  prayerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    prayerForm.querySelector(".form-message").textContent = "기도 제목을 확인했습니다. 함께 기도하는 마음으로 소중히 받겠습니다.";
    prayerForm.reset();
  });
}

function normalizeSiteNav() {
  const nav = document.getElementById("site-nav");
  if (!nav) return;
  const current = (window.location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "");
  const paths = {
    light: '<path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-.8.7-1.2 1.5-1.3 2.5H9.3C9.2 15.5 8.8 14.7 8 14z"></path>',
    bible: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z"></path><path d="M8 7h7M8 11h6"></path>',
    moon: '<path d="M20 15.5A7.5 7.5 0 0 1 8.5 4 8 8 0 1 0 20 15.5z"></path>',
    sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"></path>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"></path><path d="M4 5.5v16M8 7h8M8 11h6"></path>',
    play: '<circle cx="12" cy="12" r="9"></circle><path d="m10 8 6 4-6 4z"></path>',
    card: '<rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M8 8h8M8 12h5M9 16h6"></path>',
    heart: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z"></path>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 6 8-6"></path>'
  };
  const navIcon = (name) => `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.light}</svg>`;
  const items = [
    { href: "about.html", label: "\uAE30\uB3C4\uC758\uC0D8\uBB3C \uC18C\uAC1C", iconName: "light", keys: ["about"] },
    { href: "prayers.html", label: "\uB9D0\uC500 \uBD99\uB4E4\uAE30", iconName: "bible", keys: ["prayers"] },
    { href: "night-prayer.html", label: "\uC800\uB141\uAE30\uB3C4", iconName: "moon", keys: ["night-prayer"] },
    { href: "morning-prayer.html", label: "\uC544\uCE68\uAE30\uB3C4", iconName: "sun", keys: ["morning-prayer"] },
    { href: "meditation.html", label: "\uD050\uD2F0(QT)", iconName: "book", keys: ["meditation"] },
    { href: "videos.html", label: "\uAE30\uB3C4(\uC720\uD29C\uBE0C)", iconName: "play", keys: ["videos"] },
    { href: "prayer-cards.html", label: "\uC2E0\uC559\uC790\uB8CC", iconName: "card", keys: ["prayer-cards", "prayer-challenge", "premium-pdf"] },
    { href: "prayer-request.html", label: "\uAE30\uB3C4\uC81C\uBAA9", iconName: "heart", keys: ["prayer-request"] },
    { href: "contact.html", label: "\uBB38\uC758\uD558\uAE30", iconName: "mail", keys: ["contact"] }
  ];
  nav.innerHTML = items.map((item) => {
    const active = item.keys.includes(current);
    const className = active ? ' class="active"' : "";
    const currentAttr = active ? ' aria-current="page"' : "";
    return `<a${className}${currentAttr} href="${item.href}">${navIcon(item.iconName)}${item.label}</a>`;
  }).join("");
}

normalizeSiteNav();
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
    const nav = document.getElementById("site-nav");
    if (!nav) return;
    const current = (window.location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "");
    const items = [
      { href: "about.html", label: "\uAE30\uB3C4\uC758\uC0D8\uBB3C \uC18C\uAC1C", iconName: "light", keys: ["about"] },
      { href: "prayers.html", label: "\uB9D0\uC500 \uBD99\uB4E4\uAE30", iconName: "bible", keys: ["prayers"] },
      { href: "night-prayer.html", label: "\uC800\uB141\uAE30\uB3C4", iconName: "moon", keys: ["night-prayer"] },
      { href: "morning-prayer.html", label: "\uC544\uCE68\uAE30\uB3C4", iconName: "sun", keys: ["morning-prayer"] },
      { href: "meditation.html", label: "\uD050\uD2F0(QT)", iconName: "book", keys: ["meditation"] },
      { href: "videos.html", label: "\uAE30\uB3C4(\uC720\uD29C\uBE0C)", iconName: "play", keys: ["videos"] },
      { href: "prayer-cards.html", label: "\uC2E0\uC559\uC790\uB8CC", iconName: "card", keys: ["prayer-cards", "prayer-challenge", "premium-pdf"] },
      { href: "prayer-request.html", label: "\uAE30\uB3C4\uC81C\uBAA9", iconName: "heart", keys: ["prayer-request"] },
      { href: "contact.html", label: "\uBB38\uC758\uD558\uAE30", iconName: "mail", keys: ["contact"] }
    ];
    nav.innerHTML = items.map((item) => {
      const active = item.keys.includes(current);
      const className = active ? ' class="active"' : "";
      const currentAttr = active ? ' aria-current="page"' : "";
      return `<a${className}${currentAttr} href="${item.href}">${icon(item.iconName, "nav-icon")}${item.label}</a>`;
    }).join("");
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
    const labels = { all: "전체", word: "말씀 붙들기", evening: "저녁기도", morning: "아침기도", editorial: "큐티(QT)" };
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
