(() => {
  "use strict";

  const client = window.FaithSupabase;
  const ORIGINAL_BUCKET = "faith-resources";
  const PREVIEW_BUCKET = "faith-resource-previews";
  const IMAGE_PREVIEW_LIMIT = 3;
  const PDF_PREVIEW_LIMIT = 4;
  const IMAGE_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
  const AUDIO_PREVIEW_MAX_BYTES = 15 * 1024 * 1024;
  const PDFJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.mjs";
  const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.mjs";
  const PDF_PREVIEW_TARGET_WIDTH = 1200;
  const PREVIEW_ITEMS_MAX_LENGTH = 3000;
  const TYPE_LABELS = { pdf: "기도문 PDF", audio: "기도 오디오북", card: "기도카드" };
  const STATUS_LABELS = { draft: "초안", published: "공개", archived: "보관" };
  const SALE_LABELS = { free: "무료다운", inquiry: "문의 안내", available: "온라인 구매", unavailable: "판매 비노출" };

  const state = {
    user: null,
    resources: [],
    details: new Map(),
    files: new Map(),
    previews: new Map(),
    products: new Map(),
    activeView: "all",
    statusFilter: "all",
    saleFilter: "all",
    search: "",
    editorStep: 1,
    editorOriginals: [],
    editorPreviews: [],
    editorPreviewReplacements: [],
    pdfPreviewGenerating: false,
    pdfPreviewGenerationError: "",
    workerReady: false,
    loading: false,
    draggedResourceId: ""
  };
  let pdfJsPromise = null;

  const gate = document.querySelector("[data-admin-gate]");
  const panel = document.querySelector("[data-admin-panel]");
  const loginForm = document.querySelector("[data-admin-login-form]");
  const loginStatus = document.querySelector("[data-admin-auth-status]");
  const globalStatus = document.querySelector("[data-admin-status]");
  const resourceList = document.querySelector("[data-admin-resource-list]");
  const editor = document.querySelector("[data-admin-editor]");
  const form = document.querySelector("[data-admin-resource-form]");
  const uploadStatus = document.querySelector("[data-admin-upload-status]");
  const previewItemsCount = document.querySelector("[data-preview-items-count]");
  const originalInput = form?.elements.files;
  const previewInput = form?.elements.previewFiles;

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setStatus(target, message = "", isError = false) {
    if (!target) return;
    target.textContent = message;
    target.classList.toggle("is-error", isError);
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatPrice(value) {
    return value ? `${Number(value).toLocaleString("ko-KR")}원` : "가격 없음";
  }

  function safeFileName(name) {
    return String(name || "file")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9가-힣._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(-180);
  }

  function makeKey() {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function tagsFrom(value) {
    return [...new Set(String(value || "").split(",").map((tag) => tag.trim()).filter(Boolean))];
  }

  function previewItemsFrom(value) {
    return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function linesFrom(value) {
    return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function marketingDetailsFromForm() {
    return {
      schemaVersion: 1,
      hook: form.elements.marketingHook.value.trim(),
      audiences: linesFrom(form.elements.marketingAudiences.value),
      benefits: linesFrom(form.elements.marketingBenefits.value),
      usageModes: linesFrom(form.elements.marketingUsageModes.value),
      purchaseGoal: form.elements.purchaseGoal.value.trim(),
      pageCount: Number(form.elements.pageCount.value || 0) || null,
      dayCount: Number(form.elements.dayCount.value || 0) || null,
      formats: ["A4 인쇄", "휴대폰 열람"],
      relatedResourceIds: tagsFrom(form.elements.relatedResourceIds.value)
    };
  }

  function previewItemsMatch(savedItems, expectedItems) {
    return JSON.stringify(Array.isArray(savedItems) ? savedItems : []) === JSON.stringify(expectedItems);
  }

  function syncPreviewItemsCount() {
    if (!form || !previewItemsCount) return;
    const length = form.elements.previewItems.value.length;
    previewItemsCount.textContent = `${length.toLocaleString("ko-KR")} / ${PREVIEW_ITEMS_MAX_LENGTH.toLocaleString("ko-KR")}자 · 한 줄에 한 항목씩 저장됩니다.`;
    previewItemsCount.classList.toggle("is-error", length > PREVIEW_ITEMS_MAX_LENGTH);
  }

  function preventOversizedPreviewItemsPaste(event) {
    const field = event.currentTarget;
    const pastedText = event.clipboardData?.getData("text") || "";
    if (!pastedText) return;
    const selectionStart = field.selectionStart ?? field.value.length;
    const selectionEnd = field.selectionEnd ?? selectionStart;
    const nextLength = field.value.length - (selectionEnd - selectionStart) + pastedText.length;
    if (nextLength <= PREVIEW_ITEMS_MAX_LENGTH) return;
    event.preventDefault();
    setStatus(uploadStatus, `공개 자료 구성은 ${PREVIEW_ITEMS_MAX_LENGTH.toLocaleString("ko-KR")}자 이하로 입력해 주세요. 초과한 붙여넣기는 적용하지 않아 기존 내용을 유지했습니다.`, true);
    syncPreviewItemsCount();
  }

  function resourceFiles(resourceId) {
    return state.files.get(resourceId) || [];
  }

  function resourcePreviews(resourceId) {
    return state.previews.get(resourceId) || [];
  }

  function resourceProduct(resourceId) {
    return state.products.get(resourceId) || null;
  }

  function resourceSaleStatus(resource) {
    return resource?.access_level === "free" ? "free" : resourceProduct(resource?.id)?.sale_status || "inquiry";
  }

  function isIncomplete(resource) {
    return resourceFiles(resource.id).length === 0;
  }

  async function checkWorker() {
    const status = document.querySelector("[data-worker-status]");
    const base = String(window.FAITH_ORDER_API_URL || "").replace(/\/$/, "");
    if (!base) {
      state.workerReady = false;
      if (status) {
        status.textContent = "결제 Worker 주소가 설정되지 않아 문의 안내로만 저장할 수 있습니다.";
        status.className = "admin-worker-status is-error";
      }
      renderPublishChecklist();
      return false;
    }
    try {
      const response = await fetch(`${base}/health`, { headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      state.workerReady = response.ok && data.ok === true && data.billing === "one-time-orders";
    } catch {
      state.workerReady = false;
    }
    if (status) {
      status.textContent = state.workerReady ? "단건 결제 Worker 연결이 확인되었습니다." : "결제 Worker 연결을 확인할 수 없어 온라인 구매 상태를 저장할 수 없습니다.";
      status.className = `admin-worker-status ${state.workerReady ? "is-ready" : "is-error"}`;
    }
    renderPublishChecklist();
    return state.workerReady;
  }

  async function refreshAdminAccess() {
    if (!client) {
      setStatus(loginStatus, "관리자 연결을 불러오지 못했습니다.", true);
      return;
    }
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      state.user = null;
      gate.hidden = false;
      panel.hidden = true;
      return;
    }
    const { data: profile, error } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (error || profile?.role !== "admin") {
      state.user = null;
      gate.hidden = false;
      panel.hidden = true;
      setStatus(loginStatus, "이 계정에는 관리자 권한이 없습니다.", true);
      return;
    }
    state.user = user;
    gate.hidden = true;
    panel.hidden = false;
    await Promise.all([loadDashboard(), checkWorker()]);
  }

  async function loadDashboard() {
    if (!client || !state.user || state.loading) return;
    state.loading = true;
    setStatus(globalStatus, "자료 목록을 불러오고 있습니다.");
    try {
      const [resourcesResult, detailsResult, filesResult, previewsResult, productsResult] = await Promise.all([
        client.from("faith_resources").select("id,type,title,summary,tags,access_level,published,status,display_order,published_at,created_at,updated_at").order("type").order("display_order").order("created_at", { ascending: false }),
        client.from("faith_resource_private_details").select("resource_id,description,preview_items,gallery_items,updated_at"),
        client.from("resource_files").select("id,resource_id,bucket_id,object_path,file_name,mime_type,file_size,sort_order,created_at").order("sort_order"),
        client.from("resource_preview_files").select("id,resource_id,bucket_id,object_path,file_name,mime_type,file_size,alt_text,sort_order,created_at").order("sort_order"),
        client.from("faith_products").select("id,resource_id,type,title,summary,preview_items,sale_status,price_amount,currency,purchasable,published,marketing_details,base_print_copies,print_pack_size,print_pack_price,updated_at")
      ]);
      const failed = [resourcesResult, detailsResult, filesResult, previewsResult, productsResult].find((result) => result.error);
      if (failed) throw failed.error;

      state.resources = resourcesResult.data || [];
      state.details = new Map((detailsResult.data || []).map((item) => [item.resource_id, item]));
      state.files = groupByResource(filesResult.data || []);
      state.previews = groupByResource(previewsResult.data || []);
      state.products = new Map((productsResult.data || []).filter((item) => item.resource_id).map((item) => [item.resource_id, item]));
      renderDashboard();
      setStatus(globalStatus, "");
    } catch (error) {
      setStatus(globalStatus, `자료 목록을 불러오지 못했습니다. ${error.message || "Supabase 마이그레이션을 확인해 주세요."}`, true);
      if (resourceList) resourceList.innerHTML = '<div class="admin-empty">관리자 자료 계약을 확인할 수 없습니다.</div>';
    } finally {
      state.loading = false;
    }
  }

  function groupByResource(rows) {
    const grouped = new Map();
    rows.forEach((row) => {
      const list = grouped.get(row.resource_id) || [];
      list.push(row);
      grouped.set(row.resource_id, list);
    });
    grouped.forEach((list) => list.sort((a, b) => a.sort_order - b.sort_order));
    return grouped;
  }

  function visibleResources() {
    const normalized = state.search.trim().toLowerCase();
    const canReorder = isReorderMode();
    return state.resources.filter((resource) => {
      if (state.activeView === "incomplete" && !isIncomplete(resource)) return false;
      if (Object.hasOwn(TYPE_LABELS, state.activeView) && resource.type !== state.activeView) return false;
      if (canReorder && resource.status === "archived") return false;
      if (state.statusFilter !== "all" && resource.status !== state.statusFilter) return false;
      if (state.saleFilter !== "all" && resourceSaleStatus(resource) !== state.saleFilter) return false;
      if (!normalized) return true;
      return [resource.title, resource.summary, ...(resource.tags || [])].join(" ").toLowerCase().includes(normalized);
    }).sort((a, b) => a.display_order - b.display_order || new Date(b.created_at) - new Date(a.created_at));
  }

  function isReorderMode() {
    return Object.hasOwn(TYPE_LABELS, state.activeView)
      && state.statusFilter === "all"
      && state.saleFilter === "all"
      && !state.search.trim();
  }

  function renderDashboard() {
    renderStats();
    renderNavigation();
    renderResources();
  }

  function renderStats() {
    const stats = {
      published: state.resources.filter((item) => item.status === "published").length,
      draft: state.resources.filter((item) => item.status === "draft").length,
      incomplete: state.resources.filter(isIncomplete).length,
      available: state.resources.filter((item) => resourceProduct(item.id)?.sale_status === "available").length
    };
    Object.entries(stats).forEach(([key, value]) => {
      const target = document.querySelector(`[data-stat="${key}"]`);
      if (target) target.textContent = String(value);
    });
  }

  function renderNavigation() {
    const counts = {
      all: state.resources.length,
      pdf: state.resources.filter((item) => item.type === "pdf").length,
      audio: state.resources.filter((item) => item.type === "audio").length,
      card: state.resources.filter((item) => item.type === "card").length,
      incomplete: state.resources.filter(isIncomplete).length
    };
    Object.entries(counts).forEach(([key, value]) => {
      const target = document.querySelector(`[data-nav-count="${key}"]`);
      if (target) target.textContent = String(value);
    });
    document.querySelectorAll("[data-admin-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminView === state.activeView));
    const heading = document.querySelector("[data-admin-heading]");
    const description = document.querySelector("[data-admin-description]");
    if (heading) heading.textContent = state.activeView === "all" ? "전체 자료" : state.activeView === "incomplete" ? "업로드 미완료" : TYPE_LABELS[state.activeView];
    if (description) description.textContent = isReorderMode() ? "공개 페이지에 표시할 순서를 바로 조정할 수 있습니다." : "필터 조건에 맞는 자료를 확인하고 수정합니다.";
    const hint = document.querySelector("[data-admin-order-hint]");
    if (hint) hint.hidden = !isReorderMode();
  }

  function renderResources() {
    if (!resourceList) return;
    const rows = visibleResources();
    if (!rows.length) {
      resourceList.innerHTML = '<div class="admin-empty">조건에 맞는 자료가 없습니다.</div>';
      return;
    }
    const canReorder = isReorderMode();
    const boardHead = `<div class="admin-resource-board-head" role="row">
      <span role="columnheader">번호</span><span role="columnheader">업로드일</span><span role="columnheader">자료 유형</span><span role="columnheader">제목</span>
    </div>`;
    resourceList.innerHTML = boardHead + rows.map((resource, index) => {
      const product = resourceProduct(resource.id) || { sale_status: "inquiry", price_amount: null };
      const saleStatus = resourceSaleStatus(resource);
      const incomplete = isIncomplete(resource);
      const badgeClass = incomplete ? "incomplete" : resource.status;
      const badgeText = incomplete ? "업로드 미완료" : STATUS_LABELS[resource.status] || resource.status;
      const tags = (resource.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
      const primaryAction = resource.status === "published"
        ? '<button type="button" data-action="unpublish">비공개</button>'
        : resource.status === "archived"
          ? '<button type="button" data-action="recover">복구</button>'
          : `<button type="button" data-action="publish" ${incomplete ? "disabled" : ""}>공개</button>`;
      const detailId = `admin-resource-detail-${resource.id}`;
      return `<article class="admin-resource-row" data-resource-id="${escapeHtml(resource.id)}" draggable="${String(canReorder)}">
        <button class="admin-resource-summary" type="button" data-resource-toggle aria-expanded="false" aria-controls="${escapeHtml(detailId)}" aria-label="${escapeHtml(resource.title)} 상세 정보 열기">
          <span class="admin-resource-number">${rows.length - index}</span>
          <time datetime="${escapeHtml(resource.created_at || resource.updated_at || "")}">${escapeHtml(formatDate(resource.created_at || resource.updated_at))}</time>
          <span>${escapeHtml(TYPE_LABELS[resource.type])}</span>
          <strong>${escapeHtml(resource.title)}</strong>
        </button>
        <div class="admin-resource-webzine" id="${escapeHtml(detailId)}" hidden>
          <div class="admin-resource-copy"><span class="admin-badge admin-badge-${badgeClass}">${badgeText}</span><p>${escapeHtml(resource.summary)}</p><div class="admin-resource-tags">${tags}</div></div>
          <dl class="admin-resource-detail-meta">
            <div><dt>파일</dt><dd>원본 ${resourceFiles(resource.id).length}개 · 미리보기 ${resourcePreviews(resource.id).length}개</dd></div>
            <div><dt>최근 수정</dt><dd>${escapeHtml(formatDate(resource.updated_at))}</dd></div>
            <div><dt>판매 상태</dt><dd>${escapeHtml(SALE_LABELS[saleStatus] || "문의 안내")} · ${escapeHtml(saleStatus === "free" ? "결제 없음" : formatPrice(product.price_amount))}</dd></div>
          </dl>
          <div class="admin-resource-management">
            <div class="admin-order-controls" aria-label="노출 순서 변경"><button type="button" data-move="up" aria-label="${escapeHtml(resource.title)} 위로 이동" ${!canReorder || index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move="down" aria-label="${escapeHtml(resource.title)} 아래로 이동" ${!canReorder || index === rows.length - 1 ? "disabled" : ""}>↓</button></div>
            <div class="admin-resource-actions"><button type="button" data-action="edit">수정</button><button type="button" data-action="preview">미리보기</button>${primaryAction}${resource.status !== "archived" ? '<button type="button" data-action="archive">보관</button>' : ""}<button type="button" data-action="delete">영구 삭제</button></div>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function toggleResourceDetails(row, toggle) {
    const panel = row.querySelector(".admin-resource-webzine");
    if (!panel) return;
    const shouldOpen = toggle.getAttribute("aria-expanded") !== "true";
    resourceList.querySelectorAll("[data-resource-toggle][aria-expanded='true']").forEach((openToggle) => {
      if (openToggle === toggle) return;
      const openRow = openToggle.closest("[data-resource-id]");
      const openPanel = openRow?.querySelector(".admin-resource-webzine");
      openToggle.setAttribute("aria-expanded", "false");
      openToggle.setAttribute("aria-label", `${openRow?.querySelector(".admin-resource-summary strong")?.textContent || "자료"} 상세 정보 열기`);
      openRow?.classList.remove("is-expanded");
      if (openPanel) openPanel.hidden = true;
    });
    toggle.setAttribute("aria-expanded", String(shouldOpen));
    toggle.setAttribute("aria-label", `${toggle.querySelector("strong")?.textContent || "자료"} 상세 정보 ${shouldOpen ? "닫기" : "열기"}`);
    row.classList.toggle("is-expanded", shouldOpen);
    panel.hidden = !shouldOpen;
  }

  function allKnownTags() {
    return [...new Set(state.resources.flatMap((resource) => resource.tags || []))].sort((a, b) => a.localeCompare(b, "ko"));
  }

  function openEditor(resourceId = "") {
    const resource = state.resources.find((item) => item.id === resourceId) || null;
    const product = resource ? resourceProduct(resource.id) : null;
    const details = resource ? state.details.get(resource.id) : null;
    form.reset();
    form.elements.resourceId.value = resource?.id || "";
    form.elements.title.value = resource?.title || "";
    form.elements.summary.value = resource?.summary || "";
    form.elements.type.value = resource?.type || "pdf";
    form.elements.type.disabled = Boolean(resource);
    form.elements.description.value = details?.description || "";
    form.elements.tags.value = (resource?.tags || []).join(", ");
    form.elements.previewItems.value = (product?.preview_items || details?.preview_items || []).join("\n");
    form.elements.accessLevel.value = resource?.access_level || "paid";
    syncPreviewItemsCount();
    form.elements.saleStatus.value = product?.sale_status || "inquiry";
    form.elements.priceAmount.value = product?.price_amount || "";
    const marketing = product?.marketing_details || {};
    form.elements.marketingHook.value = marketing.hook || "";
    form.elements.marketingAudiences.value = (marketing.audiences || []).join("\n");
    form.elements.marketingBenefits.value = (marketing.benefits || []).join("\n");
    form.elements.marketingUsageModes.value = (marketing.usageModes || []).join("\n");
    form.elements.purchaseGoal.value = marketing.purchaseGoal || "";
    form.elements.pageCount.value = marketing.pageCount || "";
    form.elements.dayCount.value = marketing.dayCount || "";
    form.elements.relatedResourceIds.value = (marketing.relatedResourceIds || []).join(", ");
    form.elements.basePrintCopies.value = product?.base_print_copies || 20;
    form.elements.printPackSize.value = product?.print_pack_size || 10;
    form.elements.printPackPrice.value = product?.print_pack_price ?? 3000;
    state.editorOriginals = (resource ? resourceFiles(resource.id) : []).map((item) => ({ ...item, source: "stored", status: "complete" }));
    state.editorPreviews = (resource ? resourcePreviews(resource.id) : []).map((item) => ({ ...item, source: "stored", status: "complete" }));
    state.editorPreviewReplacements = [];
    state.pdfPreviewGenerating = false;
    state.pdfPreviewGenerationError = "";
    const title = document.querySelector("[data-editor-title]");
    if (title) title.textContent = resource ? "자료 수정" : "새 자료 등록";
    setStatus(uploadStatus, "");
    setEditorStep(1);
    syncAccessFields();
    syncPreviewUploadMode();
    renderTagSuggestions();
    renderEditorFiles();
    renderPublishChecklist();
    if (!editor.open) editor.showModal();
    form.elements.title.focus();
    if (resource?.type === "pdf" && state.editorOriginals.length && !state.editorPreviews.length) {
      window.setTimeout(() => generatePdfPagePreviews(), 0);
    }
  }

  function closeEditor() {
    if (state.loading) return;
    editor.close();
    state.editorOriginals = [];
    state.editorPreviews = [];
    state.editorPreviewReplacements = [];
    state.pdfPreviewGenerating = false;
    state.pdfPreviewGenerationError = "";
  }

  function setEditorStep(step) {
    state.editorStep = Math.max(1, Math.min(3, Number(step) || 1));
    document.querySelectorAll("[data-editor-step]").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.editorStep) === state.editorStep));
    document.querySelectorAll("[data-editor-panel]").forEach((panelElement) => {
      const active = Number(panelElement.dataset.editorPanel) === state.editorStep;
      panelElement.hidden = !active;
      panelElement.classList.toggle("is-active", active);
    });
    const previous = document.querySelector("[data-editor-previous]");
    const next = document.querySelector("[data-editor-next]");
    if (previous) previous.hidden = state.editorStep === 1;
    if (next) next.hidden = state.editorStep === 3;
  }

  function renderTagSuggestions() {
    const root = document.querySelector("[data-admin-tag-suggestions]");
    if (!root) return;
    const selected = new Set(tagsFrom(form.elements.tags.value));
    const tags = allKnownTags();
    root.innerHTML = tags.length
      ? tags.map((tag) => `<button class="${selected.has(tag) ? "is-selected" : ""}" type="button" data-suggested-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")
      : '<span class="muted">등록된 키워드가 없습니다.</span>';
  }

  function isAudioPreview(item) {
    return /^audio\/(mpeg|mp3)$/i.test(String(item?.mime_type || "")) || /\.mp3$/i.test(String(item?.file_name || ""));
  }

  function isImagePreview(item) {
    return /^image\/(jpeg|png|webp)$/i.test(String(item?.mime_type || "")) || /\.(jpe?g|png|webp)$/i.test(String(item?.file_name || ""));
  }

  function previewFilesValid({ requireAudio = false, requirePdf = false } = {}) {
    const isPdf = form.elements.type.value === "pdf";
    const isAudio = form.elements.type.value === "audio";
    if (isAudio) {
      return (!requireAudio || state.editorPreviews.length === 1)
        && state.editorPreviews.length <= 1
        && state.editorPreviews.every((item) => isAudioPreview(item) && Number(item.file_size || 0) <= AUDIO_PREVIEW_MAX_BYTES);
    }
    const maximum = isPdf ? PDF_PREVIEW_LIMIT : IMAGE_PREVIEW_LIMIT;
    return (!isPdf || !requirePdf || state.editorPreviews.length === PDF_PREVIEW_LIMIT)
      && state.editorPreviews.length <= maximum
      && state.editorPreviews.every((item) => isImagePreview(item) && Number(item.file_size || 0) <= IMAGE_PREVIEW_MAX_BYTES);
  }

  function syncPreviewUploadMode() {
    if (!previewInput || !form) return;
    const isPdf = form.elements.type.value === "pdf";
    const isAudio = form.elements.type.value === "audio";
    const title = document.querySelector("[data-preview-file-title]");
    const description = document.querySelector("[data-preview-file-description]");
    const picker = document.querySelector("[data-preview-file-picker]");
    previewInput.accept = isAudio ? "audio/mpeg,audio/mp3,.mp3" : "image/jpeg,image/png,image/webp";
    previewInput.multiple = !isAudio;
    if (title) title.textContent = isAudio ? "공개 미리듣기 MP3" : isPdf ? "PDF 1~4페이지 공개 미리보기" : "공개 미리보기 이미지";
    if (description) description.textContent = isAudio
      ? "원본과 분리된 미리듣기용 MP3 파일을 1개 등록합니다. 웹페이지에서 스트리밍으로 재생됩니다."
      : isPdf
        ? "PDF 원본을 선택하면 앞 4페이지가 공개용 WEBP 이미지로 자동 생성됩니다. 필요하면 다른 이미지로 교체할 수 있습니다."
        : "원본과 분리된 표지 또는 미리보기 이미지를 최대 3장 등록합니다.";
    if (picker) picker.textContent = isAudio ? "미리듣기 MP3 선택 또는 드래그앤드롭" : isPdf ? "다른 미리보기 이미지 선택 또는 드래그앤드롭" : "미리보기 이미지 선택 또는 드래그앤드롭";
    renderPdfPreviewControls();
    renderPublishChecklist();
  }

  function addFiles(kind, fileList) {
    const files = [...fileList];
    if (!files.length) return;
    const target = kind === "preview" ? state.editorPreviews : state.editorOriginals;
    if (kind === "preview") {
      const isAudio = form.elements.type.value === "audio";
      const maximum = isAudio ? 1 : form.elements.type.value === "pdf" ? PDF_PREVIEW_LIMIT : IMAGE_PREVIEW_LIMIT;
      if (target.length + files.length > maximum) {
        setStatus(uploadStatus, isAudio ? "공개 미리듣기 MP3는 1개만 등록할 수 있습니다." : `공개 미리보기 이미지는 최대 ${maximum}장까지 등록할 수 있습니다.`, true);
        return;
      }
      const invalidType = files.some((file) => isAudio
        ? !(/^audio\/(mpeg|mp3)$/i.test(file.type) || /\.mp3$/i.test(file.name))
        : !(/^image\/(jpeg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)));
      if (invalidType) {
        setStatus(uploadStatus, isAudio ? "미리듣기 파일은 MP3 형식만 등록할 수 있습니다." : "미리보기 파일은 JPG, PNG, WEBP 이미지만 등록할 수 있습니다.", true);
        return;
      }
      const maximumBytes = isAudio ? AUDIO_PREVIEW_MAX_BYTES : IMAGE_PREVIEW_MAX_BYTES;
      if (files.some((file) => file.size > maximumBytes)) {
        setStatus(uploadStatus, isAudio ? "미리듣기 MP3는 15MB 이하로 등록해 주세요." : "미리보기 이미지는 파일당 5MB 이하로 등록해 주세요.", true);
        return;
      }
    }
    files.forEach((file) => {
      const mimeType = kind === "preview" && form.elements.type.value === "audio" && /\.mp3$/i.test(file.name)
        ? "audio/mpeg"
        : file.type || "application/octet-stream";
      target.push({ key: makeKey(), source: "pending", file, file_name: file.name, file_size: file.size, mime_type: mimeType, status: "queued", progress: 0 });
    });
    renderEditorFiles();
    renderPublishChecklist();
    if (kind === "original" && form.elements.type.value === "pdf" && files.length === 1) {
      generatePdfPagePreviews(target[target.length - 1]);
    }
  }

  function renderEditorFiles() {
    renderFileCollection("original", state.editorOriginals, document.querySelector("[data-original-file-list]"));
    renderFileCollection("preview", state.editorPreviews, document.querySelector("[data-preview-file-list]"));
    renderPdfPreviewControls();
  }

  function renderPdfPreviewControls() {
    const root = document.querySelector("[data-pdf-preview-actions]");
    const button = document.querySelector("[data-generate-pdf-previews]");
    const status = document.querySelector("[data-pdf-preview-status]");
    if (!root || !button || !status || !form) return;
    const isPdf = form.elements.type.value === "pdf";
    root.hidden = !isPdf;
    if (!isPdf) return;
    const previewCount = state.editorPreviews.filter(isImagePreview).length;
    button.disabled = state.pdfPreviewGenerating || !state.editorOriginals.some((item) => fileMatchesType("pdf", item));
    status.classList.toggle("is-error", Boolean(state.pdfPreviewGenerationError));
    status.textContent = state.pdfPreviewGenerating
      ? "PDF 앞 1~4페이지를 공개 미리보기로 만들고 있습니다."
      : state.pdfPreviewGenerationError
        ? state.pdfPreviewGenerationError
        : previewCount
          ? `공개 미리보기 ${previewCount}장이 준비되었습니다. 저장하면 신앙자료 페이지에 표시됩니다.`
          : "PDF 원본을 선택하면 앞 1~4페이지가 자동으로 준비됩니다.";
  }

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = import(PDFJS_MODULE_URL).then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return pdfjs;
      }).catch((error) => {
        pdfJsPromise = null;
        throw error;
      });
    }
    return pdfJsPromise;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PDF 미리보기 이미지를 만들지 못했습니다.")), type, quality);
    });
  }

  async function loadPdfSource(source) {
    if (source?.file) return source.file;
    if (!source?.object_path) throw new Error("PDF 원본 파일을 찾지 못했습니다.");
    const { data, error } = await client.storage.from(source.bucket_id || ORIGINAL_BUCKET).download(source.object_path);
    if (error || !data) throw error || new Error("PDF 원본 파일을 읽지 못했습니다.");
    return data;
  }

  async function createPdfPreviewFiles(source) {
    const pdfjs = await loadPdfJs();
    const blob = await loadPdfSource(source);
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
    const pdfDocument = await loadingTask.promise;
    const files = [];
    try {
      const pageCount = Math.min(pdfDocument.numPages, PDF_PREVIEW_LIMIT);
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.max(1, Math.min(2.5, PDF_PREVIEW_TARGET_WIDTH / baseViewport.width));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { alpha: false });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const previewBlob = await canvasToBlob(canvas, "image/webp", 0.86);
        page.cleanup();
        canvas.width = 1;
        canvas.height = 1;
        if (previewBlob.size > IMAGE_PREVIEW_MAX_BYTES) throw new Error(`${pageNumber}페이지 미리보기가 5MB를 초과했습니다.`);
        const fileName = `page-${pageNumber}.webp`;
        const file = new File([previewBlob], fileName, { type: "image/webp" });
        files.push({ key: makeKey(), source: "pending", generatedFromPdf: true, file, file_name: fileName, file_size: file.size, mime_type: file.type, status: "queued", progress: 0 });
      }
    } finally {
      await loadingTask.destroy();
    }
    if (!files.length) throw new Error("PDF에서 공개할 페이지를 찾지 못했습니다.");
    return files;
  }

  async function generatePdfPagePreviews(source = null) {
    if (state.pdfPreviewGenerating || form.elements.type.value !== "pdf") return;
    const pdfSource = source || state.editorOriginals.find((item) => fileMatchesType("pdf", item));
    if (!pdfSource) {
      state.pdfPreviewGenerationError = "PDF 원본을 먼저 선택해 주세요.";
      renderPdfPreviewControls();
      return;
    }
    state.pdfPreviewGenerating = true;
    state.pdfPreviewGenerationError = "";
    renderPdfPreviewControls();
    try {
      const generated = await createPdfPreviewFiles(pdfSource);
      const storedPreviews = state.editorPreviews.filter((item) => item.source === "stored");
      const knownReplacementIds = new Set(state.editorPreviewReplacements.map((item) => item.id || item.object_path));
      storedPreviews.forEach((item) => {
        const key = item.id || item.object_path;
        if (!knownReplacementIds.has(key)) state.editorPreviewReplacements.push(item);
      });
      state.editorPreviews = generated;
      setStatus(uploadStatus, `PDF 앞 ${generated.length}페이지 미리보기가 준비되었습니다. 저장하면 공개 페이지에 반영됩니다.`);
    } catch (error) {
      state.pdfPreviewGenerationError = `PDF 미리보기를 만들지 못했습니다. ${error.message || "다시 시도해 주세요."}`;
      setStatus(uploadStatus, state.pdfPreviewGenerationError, true);
    } finally {
      state.pdfPreviewGenerating = false;
      renderEditorFiles();
      renderPublishChecklist();
    }
  }

  function renderFileCollection(kind, items, root) {
    if (!root) return;
    if (!items.length) {
      root.innerHTML = '<p class="muted">등록된 파일이 없습니다.</p>';
      return;
    }
    root.innerHTML = items.map((item, index) => {
      const statusText = item.status === "uploading" ? "업로드 중" : item.status === "error" ? "업로드 실패" : item.source === "pending" ? "저장 대기" : "저장됨";
      return `<div class="admin-file-item is-${escapeHtml(item.status || "complete")}" data-file-kind="${kind}" data-file-index="${index}"><div><strong>${escapeHtml(item.file_name)}</strong><span>${escapeHtml(formatBytes(item.file_size))} · ${statusText}</span>${item.status === "uploading" ? `<div class="admin-upload-progress"><span style="width:${Number(item.progress || 0)}%"></span></div>` : ""}</div><div class="admin-file-item-actions"><button type="button" data-file-move="up" aria-label="위로 이동" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-file-move="down" aria-label="아래로 이동" ${index === items.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-file-remove aria-label="파일 제거">×</button></div></div>`;
    }).join("");
  }

  function moveEditorFile(kind, index, direction) {
    const items = kind === "preview" ? state.editorPreviews : state.editorOriginals;
    const targetIndex = index + (direction === "up" ? -1 : 1);
    if (targetIndex < 0 || targetIndex >= items.length) return;
    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
    renderEditorFiles();
    renderPublishChecklist();
  }

  async function removeEditorFile(kind, index) {
    const items = kind === "preview" ? state.editorPreviews : state.editorOriginals;
    const item = items[index];
    if (!item) return;
    if (item.source === "pending") {
      items.splice(index, 1);
      renderEditorFiles();
      renderPublishChecklist();
      return;
    }
    if (!window.confirm(`“${item.file_name}” 파일을 삭제할까요?`)) return;
    const resourceId = form.elements.resourceId.value;
    try {
      if (kind === "original") await setResourceState(resourceId, "draft");
      const bucket = kind === "preview" ? PREVIEW_BUCKET : ORIGINAL_BUCKET;
      const table = kind === "preview" ? "resource_preview_files" : "resource_files";
      const { error: storageError } = await client.storage.from(bucket).remove([item.object_path]);
      if (storageError) throw storageError;
      const { error: metadataError } = await client.from(table).delete().eq("id", item.id);
      if (metadataError) throw metadataError;
      items.splice(index, 1);
      await persistFileOrder(kind, items);
      renderEditorFiles();
      renderPublishChecklist();
      await loadDashboard();
    } catch (error) {
      setStatus(uploadStatus, `파일을 삭제하지 못했습니다. ${error.message}`, true);
    }
  }

  function fileMatchesType(type, item) {
    const name = String(item.file_name || "");
    const mime = String(item.mime_type || "");
    if (type === "pdf") return mime === "application/pdf" || /\.pdf$/i.test(name);
    if (type === "audio") return /^audio\//.test(mime) || /\.mp3$/i.test(name);
    return /^image\//.test(mime) || /\.(jpe?g|png|webp)$/i.test(name);
  }

  function originalFilesValid() {
    const type = form.elements.type.value;
    const items = state.editorOriginals;
    if (!items.length || items.some((item) => !fileMatchesType(type, item))) return false;
    if (type === "pdf") return items.length === 1;
    if (type === "card") return items.length >= 10 && items.length <= 12;
    return true;
  }

  function renderPublishChecklist() {
    const root = document.querySelector("[data-publish-checklist]");
    if (!root || !form) return;
    const tags = tagsFrom(form.elements.tags.value);
    const accessLevel = form.elements.accessLevel.value;
    const saleStatus = accessLevel === "free" ? "inquiry" : form.elements.saleStatus.value;
    const price = Number(form.elements.priceAmount.value || 0);
    const checks = [
      { ready: form.elements.title.value.trim().length >= 2 && form.elements.summary.value.trim().length >= 2 && form.elements.description.value.trim().length >= 2, label: "기본 정보와 상세 설명" },
      { ready: tags.length > 0, label: "키워드 1개 이상" },
      { ready: originalFilesValid(), label: form.elements.type.value === "card" ? "기도카드 이미지 10~12장" : "자료 유형에 맞는 원본 파일" },
      { ready: accessLevel === "free" || saleStatus === "inquiry" || (saleStatus === "available" && price > 0 && state.workerReady), label: accessLevel === "free" ? "무료다운 설정" : "판매 상태와 가격" },
      { ready: !state.pdfPreviewGenerating && previewFilesValid({ requireAudio: form.elements.type.value === "audio", requirePdf: form.elements.type.value === "pdf" }), label: form.elements.type.value === "audio" ? "공개 미리듣기 MP3 1개" : form.elements.type.value === "pdf" ? "PDF 1~4페이지 공개 미리보기" : "공개 미리보기 이미지 3장 이하" }
    ];
    root.innerHTML = checks.map((check) => `<p class="${check.ready ? "is-ready" : ""}">${check.ready ? "완료" : "확인 필요"} · ${escapeHtml(check.label)}</p>`).join("");
  }

  function syncAccessFields() {
    const free = form.elements.accessLevel.value === "free";
    const saleField = document.querySelector("[data-paid-sale-field]");
    const priceField = document.querySelector("[data-paid-price-field]");
    const help = document.querySelector("[data-access-level-help]");
    if (free) form.elements.saleStatus.value = "inquiry";
    form.elements.saleStatus.disabled = free;
    if (saleField) saleField.hidden = free;
    if (priceField) priceField.hidden = free;
    if (help) help.textContent = free
      ? "로그인 회원이 결제 없이 원본 자료를 내려받을 수 있습니다. 비회원에게는 회원가입 안내가 표시됩니다."
      : "유료 판매는 판매 상태와 가격을 설정합니다.";
    const available = !free && form.elements.saleStatus.value === "available";
    form.elements.priceAmount.disabled = !available;
    form.elements.priceAmount.required = available;
    if (!available) form.elements.priceAmount.value = "";
    const isPdf = form.elements.type.value === "pdf";
    document.querySelectorAll("[data-pdf-product-field]").forEach((field) => { field.hidden = !isPdf; });
    renderPublishChecklist();
  }

  function validateEditor({ publishing = false } = {}) {
    const title = form.elements.title.value.trim();
    const summary = form.elements.summary.value.trim();
    const description = form.elements.description.value.trim();
    const previewItemsText = form.elements.previewItems.value;
    const tags = tagsFrom(form.elements.tags.value);
    const accessLevel = form.elements.accessLevel.value;
    const saleStatus = accessLevel === "free" ? "inquiry" : form.elements.saleStatus.value;
    const price = Number(form.elements.priceAmount.value || 0);
    if (state.pdfPreviewGenerating) return "PDF 공개 미리보기가 준비될 때까지 기다려 주세요.";
    if (title.length < 2 || summary.length < 2 || description.length < 2) return "기본 정보와 상세 설명을 입력해 주세요.";
    if (previewItemsText.length > PREVIEW_ITEMS_MAX_LENGTH) return `공개 자료 구성은 ${PREVIEW_ITEMS_MAX_LENGTH.toLocaleString("ko-KR")}자 이하로 입력해 주세요.`;
    if (!tags.length) return "키워드를 하나 이상 입력해 주세요.";
    if (tags.length > 12 || tags.some((tag) => tag.length > 40)) return "키워드는 12개 이하, 각 40자 이하로 입력해 주세요.";
    if (accessLevel !== "free" && saleStatus === "available" && (!Number.isInteger(price) || price <= 0)) return "온라인 구매 자료의 가격을 입력해 주세요.";
    if (accessLevel !== "free" && saleStatus === "available" && !state.workerReady) return "결제 Worker 연결이 확인된 뒤 온라인 구매 상태를 사용할 수 있습니다.";
    if (!previewFilesValid()) return form.elements.type.value === "audio"
      ? "공개 미리듣기는 15MB 이하 MP3 파일 1개로 등록해 주세요."
      : `공개 미리보기는 파일당 5MB 이하 JPG, PNG, WEBP 이미지 ${form.elements.type.value === "pdf" ? PDF_PREVIEW_LIMIT : IMAGE_PREVIEW_LIMIT}장 이하로 등록해 주세요.`;
    if (publishing && form.elements.type.value === "audio" && !previewFilesValid({ requireAudio: true })) return "기도 오디오북을 공개하려면 15MB 이하 미리듣기 MP3 파일 1개를 등록해 주세요.";
    if (publishing && form.elements.type.value === "pdf" && !previewFilesValid({ requirePdf: true })) return "기도문 PDF를 공개하려면 앞 1~4페이지 공개 미리보기 4장을 준비해 주세요.";
    if (publishing && form.elements.type.value === "card" && !originalFilesValid()) return "기도카드는 이미지 10~12장을 등록해야 공개할 수 있습니다.";
    if (publishing && !originalFilesValid()) return "자료 유형에 맞는 원본 파일 구성을 확인해 주세요.";
    if (publishing && accessLevel !== "free" && saleStatus === "unavailable") return "판매 비노출 자료는 공개할 수 없습니다.";
    return "";
  }

  async function saveResource({ publishing = false } = {}) {
    if (!client || !state.user || state.loading) return;
    if (form.elements.type.value === "pdf" && !state.pdfPreviewGenerating && !previewFilesValid({ requirePdf: true })) {
      setStatus(uploadStatus, "PDF 앞 1~4페이지 공개 미리보기를 준비하고 있습니다.");
      await generatePdfPagePreviews();
    }
    const validation = validateEditor({ publishing });
    if (validation) {
      setStatus(uploadStatus, validation, true);
      return;
    }
    state.loading = true;
    const resourceIdInput = form.elements.resourceId;
    let resourceId = resourceIdInput.value;
    const title = form.elements.title.value.trim();
    const summary = form.elements.summary.value.trim();
    const type = form.elements.type.value;
    const tags = tagsFrom(form.elements.tags.value);
    const previewItems = previewItemsFrom(form.elements.previewItems.value);
    const accessLevel = form.elements.accessLevel.value;
    const saleStatus = accessLevel === "free" ? "inquiry" : form.elements.saleStatus.value;
    const priceAmount = saleStatus === "available" ? Number(form.elements.priceAmount.value) : null;
    const isPdf = type === "pdf";
    const marketingDetails = isPdf ? marketingDetailsFromForm() : {};
    const basePrintCopies = isPdf ? Number(form.elements.basePrintCopies.value || 20) : 1;
    const printPackSize = isPdf ? Number(form.elements.printPackSize.value || 10) : 10;
    const printPackPrice = isPdf ? Number(form.elements.printPackPrice.value || 3000) : 0;
    const currentResource = state.resources.find((item) => item.id === resourceId);
    setStatus(uploadStatus, "자료 정보를 저장하고 있습니다.");
    try {
      if (!resourceId) {
        const maxOrder = state.resources.filter((item) => item.type === type && item.status !== "archived").reduce((max, item) => Math.max(max, Number(item.display_order || 0)), -1);
        const { data, error } = await client.from("faith_resources").insert({
          type,
          title,
          summary,
          tags,
          access_level: accessLevel,
          status: "draft",
          published: false,
          display_order: maxOrder + 1,
          created_by: state.user.id,
          updated_by: state.user.id
        }).select("id").single();
        if (error) throw error;
        resourceId = data.id;
        resourceIdInput.value = resourceId;
      } else {
        const { error } = await client.from("faith_resources").update({ title, summary, tags, access_level: accessLevel, updated_by: state.user.id }).eq("id", resourceId);
        if (error) throw error;
      }

      const { data: savedDetails, error: detailsError } = await client.from("faith_resource_private_details").upsert({
        resource_id: resourceId,
        description: form.elements.description.value.trim(),
        preview_items: previewItems,
        gallery_items: [],
        updated_at: new Date().toISOString()
      }, { onConflict: "resource_id" }).select("preview_items").single();
      if (detailsError) throw detailsError;
      if (!previewItemsMatch(savedDetails?.preview_items, previewItems)) throw new Error("공개 자료 구성이 모두 저장되지 않았습니다. 입력 내용을 유지한 채 다시 시도해 주세요.");

      const hasPendingOriginals = state.editorOriginals.some((item) => item.source === "pending");
      if (currentResource?.status === "published" && hasPendingOriginals) {
        await setResourceState(resourceId, "draft");
      }
      const productPublished = currentResource?.status === "published" && !hasPendingOriginals && saleStatus !== "unavailable";
      const { data: savedProduct, error: productError } = await client.from("faith_products").upsert({
        id: resourceId,
        resource_id: resourceId,
        type,
        title,
        summary,
        preview_items: previewItems,
        sale_status: saleStatus,
        price_amount: priceAmount,
        currency: "KRW",
        purchasable: saleStatus === "available",
        published: productPublished,
        marketing_details: marketingDetails,
        base_print_copies: basePrintCopies,
        print_pack_size: printPackSize,
        print_pack_price: printPackPrice
      }, { onConflict: "id" }).select("preview_items").single();
      if (productError) throw productError;
      if (!previewItemsMatch(savedProduct?.preview_items, previewItems)) throw new Error("상품의 공개 자료 구성이 모두 저장되지 않았습니다. 입력 내용을 유지한 채 다시 시도해 주세요.");

      await uploadCollection("original", resourceId, state.editorOriginals, title);
      if (type === "card" && !state.editorPreviews.length && originalFilesValid()) {
        setStatus(uploadStatus, "기도카드 공개 미리보기 2장을 만들고 있습니다.");
        await queueRandomCardPreviews();
      }
      await uploadCollection("preview", resourceId, state.editorPreviews, title);

      if (publishing) {
        setStatus(uploadStatus, "공개 조건을 확인하고 있습니다.");
        const { error } = await client.rpc("publish_faith_resource", { p_resource_id: resourceId });
        if (error) throw error;
      }

      setStatus(uploadStatus, publishing ? "자료를 저장하고 공개했습니다." : "자료를 저장했습니다.");
      state.loading = false;
      await loadDashboard();
      if (publishing) {
        closeEditor();
        setStatus(globalStatus, "자료를 저장하고 공개했습니다.");
      } else {
        window.setTimeout(closeEditor, 350);
      }
    } catch (error) {
      setStatus(uploadStatus, `저장하지 못했습니다. ${error.message || "다시 시도해 주세요."}`, true);
    } finally {
      state.loading = false;
    }
  }

  async function uploadCollection(kind, resourceId, items, title) {
    const bucket = kind === "preview" ? PREVIEW_BUCKET : ORIGINAL_BUCKET;
    const table = kind === "preview" ? "resource_preview_files" : "resource_files";
    const pending = items.filter((item) => item.source === "pending");
    const stored = items.filter((item) => item.source === "stored");

    if (kind === "preview" && (pending.length || items.some((item, index) => item.source === "stored" && item.sort_order !== index))) {
      await Promise.all(stored.map((item, index) => client.from(table).update({ sort_order: 100 + index }).eq("id", item.id).then(({ error }) => { if (error) throw error; })));
    }

    let completed = 0;
    for (const item of pending) {
      item.status = "uploading";
      item.progress = Math.round((completed / Math.max(pending.length, 1)) * 100);
      renderEditorFiles();
      const objectPath = `${resourceId}/${makeKey()}-${safeFileName(item.file_name)}`;
      const { error: uploadError } = await client.storage.from(bucket).upload(objectPath, item.file, {
        cacheControl: kind === "preview" ? "86400" : "3600",
        contentType: item.mime_type || undefined,
        upsert: false
      });
      if (uploadError) {
        item.status = "error";
        renderEditorFiles();
        throw uploadError;
      }
      const sortOrder = items.indexOf(item);
      const payload = kind === "preview"
        ? { resource_id: resourceId, object_path: objectPath, file_name: item.file_name, mime_type: item.mime_type, file_size: item.file_size, alt_text: `${title} 미리보기 ${sortOrder + 1}`, sort_order: sortOrder }
        : { resource_id: resourceId, object_path: objectPath, file_name: item.file_name, mime_type: item.mime_type, file_size: item.file_size, sort_order: sortOrder };
      const { data, error: metadataError } = await client.from(table).insert(payload).select("*").single();
      if (metadataError) {
        await client.storage.from(bucket).remove([objectPath]);
        item.status = "error";
        renderEditorFiles();
        throw metadataError;
      }
      Object.assign(item, data, { source: "stored", status: "complete", progress: 100 });
      delete item.file;
      completed += 1;
      renderEditorFiles();
    }
    if (kind === "preview" && state.editorPreviewReplacements.length && pending.length && pending.every((item) => item.source === "stored")) {
      const replaced = [...state.editorPreviewReplacements];
      const replacedPaths = replaced.map((item) => item.object_path).filter(Boolean);
      const replacedIds = replaced.map((item) => item.id).filter(Boolean);
      if (replacedPaths.length) {
        const { error } = await client.storage.from(PREVIEW_BUCKET).remove(replacedPaths);
        if (error) throw error;
      }
      if (replacedIds.length) {
        const { error } = await client.from("resource_preview_files").delete().in("id", replacedIds);
        if (error) throw error;
      }
      state.editorPreviewReplacements = [];
    }
    await persistFileOrder(kind, items);
  }

  function randomItems(items, count) {
    const pool = [...items];
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      const target = values[0] % (index + 1);
      [pool[index], pool[target]] = [pool[target], pool[index]];
    }
    return pool.slice(0, count);
  }

  async function queueRandomCardPreviews() {
    const sources = randomItems(state.editorOriginals.filter((item) => item.source === "stored" && fileMatchesType("card", item)), 2);
    if (sources.length < 2) throw new Error("공개 미리보기용 기도카드 이미지 2장을 선택하지 못했습니다.");
    const previews = await Promise.all(sources.map(async (source, index) => {
      const { data: blob, error } = await client.storage.from(source.bucket_id || ORIGINAL_BUCKET).download(source.object_path);
      if (error || !blob) throw error || new Error("기도카드 미리보기 원본을 읽지 못했습니다.");
      const fileName = `preview-${index + 1}-${source.file_name}`;
      const file = new File([blob], fileName, { type: source.mime_type || blob.type || "image/jpeg" });
      return { key: makeKey(), source: "pending", file, file_name: fileName, file_size: file.size, mime_type: file.type, status: "queued", progress: 0 };
    }));
    state.editorPreviews.push(...previews);
    renderEditorFiles();
    renderPublishChecklist();
  }

  async function persistFileOrder(kind, items) {
    const table = kind === "preview" ? "resource_preview_files" : "resource_files";
    const stored = items.filter((item) => item.source === "stored");
    if (kind === "preview") {
      await Promise.all(stored.map((item, index) => client.from(table).update({ sort_order: 100 + index }).eq("id", item.id).then(({ error }) => { if (error) throw error; })));
    }
    for (const [index, item] of stored.entries()) {
      const { error } = await client.from(table).update({ sort_order: index }).eq("id", item.id);
      if (error) throw error;
      item.sort_order = index;
    }
  }

  async function setResourceState(resourceId, status) {
    const published = status === "published";
    const { error: resourceError } = await client.from("faith_resources").update({ status, published, updated_by: state.user.id }).eq("id", resourceId);
    if (resourceError) throw resourceError;
    const { error: productError } = await client.from("faith_products").update({ published }).eq("resource_id", resourceId);
    if (productError) throw productError;
  }

  async function publishResource(resourceId) {
    const resource = state.resources.find((item) => item.id === resourceId);
    if (resource?.type === "pdf" && !resourcePreviews(resourceId).some(isImagePreview)) {
      throw new Error("PDF 자료 수정에서 1~3페이지 공개 미리보기를 먼저 만들어 주세요.");
    }
    setStatus(globalStatus, "공개 조건을 확인하고 있습니다.");
    const { error } = await client.rpc("publish_faith_resource", { p_resource_id: resourceId });
    if (error) throw error;
    setStatus(globalStatus, "자료를 공개했습니다.");
    await loadDashboard();
  }

  async function deleteResource(resourceId) {
    const resource = state.resources.find((item) => item.id === resourceId);
    if (!resource) return;
    const { count, error: countError } = await client.from("faith_orders").select("id", { count: "exact", head: true }).eq("resource_id", resourceId);
    if (countError) throw countError;
    if (count) throw new Error("주문 이력이 있는 자료는 영구 삭제할 수 없습니다. 보관 상태를 사용해 주세요.");
    if (!window.confirm(`“${resource.title}” 자료와 연결된 파일을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;

    const originals = resourceFiles(resourceId).map((item) => item.object_path);
    const previews = resourcePreviews(resourceId).map((item) => item.object_path);
    if (originals.length) {
      const { error } = await client.storage.from(ORIGINAL_BUCKET).remove(originals);
      if (error) throw error;
    }
    if (previews.length) {
      const { error } = await client.storage.from(PREVIEW_BUCKET).remove(previews);
      if (error) throw error;
    }
    const { error: productError } = await client.from("faith_products").delete().eq("resource_id", resourceId);
    if (productError) throw productError;
    const { error: resourceError } = await client.from("faith_resources").delete().eq("id", resourceId);
    if (resourceError) throw resourceError;
    await loadDashboard();
  }

  async function persistResourceOrder(ids) {
    if (!isReorderMode()) return;
    setStatus(globalStatus, "노출 순서를 저장하고 있습니다.");
    const { error } = await client.rpc("reorder_faith_resources", { p_type: state.activeView, p_ordered_ids: ids });
    if (error) throw error;
    setStatus(globalStatus, "노출 순서를 저장했습니다.");
    await loadDashboard();
  }

  async function moveResource(resourceId, direction) {
    const rows = visibleResources();
    const index = rows.findIndex((item) => item.id === resourceId);
    const targetIndex = index + (direction === "up" ? -1 : 1);
    if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) return;
    [rows[index], rows[targetIndex]] = [rows[targetIndex], rows[index]];
    await persistResourceOrder(rows.map((item) => item.id));
  }

  async function handleResourceAction(button, row) {
    const resourceId = row.dataset.resourceId;
    const action = button.dataset.action;
    try {
      if (action === "edit") return openEditor(resourceId);
      if (action === "preview") return window.open(`prayer-cards.html?resource=${encodeURIComponent(resourceId)}`, "_blank", "noopener");
      if (action === "publish") return await publishResource(resourceId);
      if (action === "unpublish") await setResourceState(resourceId, "draft");
      if (action === "archive") await setResourceState(resourceId, "archived");
      if (action === "recover") await setResourceState(resourceId, "draft");
      if (action === "delete") return await deleteResource(resourceId);
      setStatus(globalStatus, action === "archive" ? "자료를 보관했습니다." : action === "recover" ? "자료를 초안으로 복구했습니다." : "공개 상태를 변경했습니다.");
      await loadDashboard();
    } catch (error) {
      setStatus(globalStatus, error.message || "작업을 완료하지 못했습니다.", true);
    }
  }

  document.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => {
    state.activeView = button.dataset.adminView;
    state.statusFilter = "all";
    state.saleFilter = "all";
    state.search = "";
    document.querySelector("[data-admin-search]").value = "";
    document.querySelector("[data-admin-status-filter]").value = "all";
    document.querySelector("[data-admin-sale-filter]").value = "all";
    renderDashboard();
  }));

  document.querySelector("[data-admin-search]")?.addEventListener("input", (event) => { state.search = event.target.value; renderDashboard(); });
  document.querySelector("[data-admin-status-filter]")?.addEventListener("change", (event) => { state.statusFilter = event.target.value; renderDashboard(); });
  document.querySelector("[data-admin-sale-filter]")?.addEventListener("change", (event) => { state.saleFilter = event.target.value; renderDashboard(); });
  document.querySelector("[data-admin-new-resource]")?.addEventListener("click", () => openEditor());
  document.querySelector("[data-editor-close]")?.addEventListener("click", closeEditor);
  document.querySelector("[data-editor-previous]")?.addEventListener("click", () => setEditorStep(state.editorStep - 1));
  document.querySelector("[data-editor-next]")?.addEventListener("click", () => setEditorStep(state.editorStep + 1));
  document.querySelectorAll("[data-editor-step]").forEach((button) => button.addEventListener("click", () => setEditorStep(button.dataset.editorStep)));
  document.querySelector("[data-publish-resource]")?.addEventListener("click", () => saveResource({ publishing: true }));
  document.querySelector("[data-generate-pdf-previews]")?.addEventListener("click", () => generatePdfPagePreviews());
  form?.addEventListener("submit", (event) => { event.preventDefault(); saveResource(); });
  form?.elements.tags.addEventListener("input", () => { renderTagSuggestions(); renderPublishChecklist(); });
  form?.elements.title.addEventListener("input", renderPublishChecklist);
  form?.elements.summary.addEventListener("input", renderPublishChecklist);
  form?.elements.description.addEventListener("input", renderPublishChecklist);
  form?.elements.previewItems.addEventListener("input", syncPreviewItemsCount);
  form?.elements.previewItems.addEventListener("paste", preventOversizedPreviewItemsPaste);
  form?.elements.type.addEventListener("change", syncPreviewUploadMode);
  form?.elements.accessLevel.addEventListener("change", syncAccessFields);
  form?.elements.saleStatus.addEventListener("change", syncAccessFields);
  form?.elements.priceAmount.addEventListener("input", renderPublishChecklist);

  document.querySelector("[data-admin-tag-suggestions]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggested-tag]");
    if (!button) return;
    const tags = new Set(tagsFrom(form.elements.tags.value));
    const tag = button.dataset.suggestedTag;
    if (tags.has(tag)) tags.delete(tag); else tags.add(tag);
    form.elements.tags.value = [...tags].join(", ");
    renderTagSuggestions();
    renderPublishChecklist();
  });

  document.querySelectorAll("[data-file-picker]").forEach((dropzone) => {
    const kind = dropzone.dataset.filePicker;
    const input = kind === "preview" ? previewInput : originalInput;
    dropzone.addEventListener("click", () => input.click());
    ["dragenter", "dragover"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add("is-dragging"); }));
    ["dragleave", "drop"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove("is-dragging"); }));
    dropzone.addEventListener("drop", (event) => addFiles(kind, event.dataTransfer?.files || []));
  });
  originalInput?.addEventListener("change", (event) => { addFiles("original", event.target.files); event.target.value = ""; });
  previewInput?.addEventListener("change", (event) => { addFiles("preview", event.target.files); event.target.value = ""; });

  document.addEventListener("click", (event) => {
    const fileItem = event.target.closest("[data-file-kind]");
    if (!fileItem) return;
    const kind = fileItem.dataset.fileKind;
    const index = Number(fileItem.dataset.fileIndex);
    const moveButton = event.target.closest("[data-file-move]");
    if (moveButton) moveEditorFile(kind, index, moveButton.dataset.fileMove);
    if (event.target.closest("[data-file-remove]")) removeEditorFile(kind, index);
  });

  resourceList?.addEventListener("click", async (event) => {
    const row = event.target.closest("[data-resource-id]");
    if (!row) return;
    const toggle = event.target.closest("[data-resource-toggle]");
    if (toggle) {
      toggleResourceDetails(row, toggle);
      return;
    }
    const moveButton = event.target.closest("[data-move]");
    if (moveButton) {
      try { await moveResource(row.dataset.resourceId, moveButton.dataset.move); }
      catch (error) { setStatus(globalStatus, error.message, true); }
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (actionButton && !actionButton.disabled) handleResourceAction(actionButton, row);
  });

  resourceList?.addEventListener("dragstart", (event) => {
    const row = event.target.closest('[draggable="true"]');
    if (!row) return;
    state.draggedResourceId = row.dataset.resourceId;
    row.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
  });
  resourceList?.addEventListener("dragover", (event) => {
    const row = event.target.closest('[draggable="true"]');
    if (!row || row.dataset.resourceId === state.draggedResourceId) return;
    event.preventDefault();
    resourceList.querySelectorAll(".is-drop-target").forEach((item) => item.classList.remove("is-drop-target"));
    row.classList.add("is-drop-target");
  });
  resourceList?.addEventListener("drop", async (event) => {
    const row = event.target.closest('[draggable="true"]');
    if (!row || !state.draggedResourceId) return;
    event.preventDefault();
    const rows = visibleResources();
    const fromIndex = rows.findIndex((item) => item.id === state.draggedResourceId);
    const toIndex = rows.findIndex((item) => item.id === row.dataset.resourceId);
    if (fromIndex >= 0 && toIndex >= 0) {
      const [moved] = rows.splice(fromIndex, 1);
      rows.splice(toIndex, 0, moved);
      try { await persistResourceOrder(rows.map((item) => item.id)); }
      catch (error) { setStatus(globalStatus, error.message, true); }
    }
  });
  resourceList?.addEventListener("dragend", () => {
    state.draggedResourceId = "";
    resourceList.querySelectorAll(".is-dragging,.is-drop-target").forEach((item) => item.classList.remove("is-dragging", "is-drop-target"));
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(loginStatus, "로그인하고 있습니다.");
    const data = new FormData(loginForm);
    const { error } = await client.auth.signInWithPassword({ email: data.get("email"), password: data.get("password") });
    if (error) return setStatus(loginStatus, error.message, true);
    await refreshAdminAccess();
  });

  document.querySelector("[data-admin-reset-password]")?.addEventListener("click", async () => {
    const email = loginForm?.elements.email.value.trim();
    if (!email) return setStatus(loginStatus, "재설정할 이메일을 입력해 주세요.", true);
    const redirectTo = new URL("reset-password.html", window.location.href).href;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    setStatus(loginStatus, error ? error.message : "비밀번호 재설정 메일을 보냈습니다.", Boolean(error));
  });

  document.querySelector("[data-admin-logout]")?.addEventListener("click", async () => {
    await client?.auth.signOut();
    await refreshAdminAccess();
  });

  editor?.addEventListener("cancel", (event) => { event.preventDefault(); closeEditor(); });
  client?.auth.onAuthStateChange(() => window.setTimeout(refreshAdminAccess, 0));
  refreshAdminAccess();
})();
